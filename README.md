# 粮裕 ERP 现代化重构 — 第一阶段最小可跑 Demo

本目录是 VFP9 ERP 现代化方案的第一阶段端到端验证,覆盖 **4 个真实模块**:

| 模块 | 类型 | VFP 源 | 等价于继承 |
|---|---|---|---|
| 物料档案 (PART) | 1对1 | `FORMS\part.scx` | `tsmainform` |
| 客户档案 (CUSTOMER) | 1对1 | `FORMS\customer.scx` | `tsmainform` |
| 物料清单 (BOM) | 1对多 | `FORMS\bom.scx` | `multiform` |
| 销售订单 (SO) | 1对多 | `FORMS\so.scx` | `multiform` |

目标:**用一份 schema 驱动一组通用基类组件**,验证旧 `tsbase`/`fields_dict` 的"继承红利"在新栈下落地。**新增一屏 = 复制 schema + 三段约 50 行的 repo 配置 + 一行 DI + 一行路由 + 一句 2 行的 page 文件**。

## 技术栈

| 层 | 技术 |
|----|------|
| 后端 | ASP.NET Core 8 minimal API + Dapper |
| DB(开发) | SQLite(自动建表 + 种子数据,零安装) |
| DB(生产) | SQL Server(切 `appsettings.json` 即可,T-SQL 见 `backend/Sql/init.mssql.sql`) |
| 前端 | React 18 + TypeScript + Vite + Ant Design + ProComponents |
| Schema | `backend/Schemas/*.json`(下一阶段迁到 `fields_dict` 表,API 契约不变) |

## 一键启动

需要 .NET 8 SDK 和 Node 20+。

```bash
# 终端 1 — 后端 (http://localhost:5050)
cd backend
dotnet run

# 终端 2 — 前端 (http://localhost:5173)
cd frontend
npm install
npm run dev
```

打开 http://localhost:5173,左侧菜单点 "物料档案" / "BOM" 即可。SQLite 数据库 `leungyou-demo.db` 在后端首次启动时自动创建并插入示例数据(物料 6 条 + BOM 1 张)。

## 数据访问:**走存储过程,不直拍基表**

VFP 表单的数据环境(part.scx / bom.scx)用的是远程视图:

```
SelectCmd            = exec part_selection   @ptno=?,@ptdesc=?,...,[@ByKeyExactQuery=1]
SelectCmd            = exec bom_h_selection  @bhptno=?,@blptno=?,[@ByKeyExactQuery=1]
SelectCmd            = exec bom_l_selection  @blpptno=?
UpdateNameList       = BH_PTNO bom_h.bh_ptno, BH_VER bom_h.BH_VER, ...
InsertCmdRefreshCmd  = exec bom_h_selection @bhptno=?,@ByKeyExactQuery=1
```

**读 = 调 `*_selection` 存储过程,写 = 直拍基表(VFP 自动生成 INSERT/UPDATE/DELETE),写完再调一次 `*_selection` 把 join 出来的计算列(`pt_desc`/`pt_spec`/`pt_unit` 等)刷回前端。**

全项目 330+ 表单一共引用了 72 个 `*_selection` 过程,且没有任何 `_save / _update / _insert` 类写过程。新后端必须沿用这个契约 —— `Data/Repositories.cs` 里 `SqlServerPartRepository` / `SqlServerBomRepository` 就是这么做的:

```csharp
// 读 — 调存储过程
public async Task<IEnumerable<dynamic>> SearchAsync(string? q) =>
    await c.QueryAsync(@"EXEC part_selection
        @ptno=@any, @ptdesc=@any, @ptspec=@any, @ptrawmatl='%', ...", new { any });

public async Task<dynamic?> GetByKeyAsync(string ptNo) =>
    await c.QueryFirstOrDefaultAsync(
        "EXEC part_selection @ptno=@ptno, @ByKeyExactQuery=1", new { ptno = ptNo });

// 写 — 直接 SQL,然后 endpoint 再调一次 GetByKeyAsync 刷新
```

**SQLite 实现是 dev-only 替身**:它用内联 SELECT 模拟过程返回值,**不复制**真实过程里可能有的访问过滤、审计、额外业务规则。本地开发够用,生产必须连 SQL Server 跑真过程。

## 切换到 SQL Server(连你现网或本地实例)

1. 数据库结构:你的现网 ldx/zj 库已有 PART/BOM_H/BOM_L 表 + `part_selection`/`bom_h_selection`/`bom_l_selection` 等过程,**直接用,不要替换**。
   全新空库才需要跑:
   - `backend/Sql/init.mssql.sql` — 建表
   - `backend/Sql/init.mssql.procs.sql` — 存储过程参考实现(VFP 数据环境契约的最小版本,你现网过程功能可能更多)
2. 改 `backend/appsettings.json`:

```jsonc
{
  "Database": { "Provider": "SqlServer" },
  "ConnectionStrings": {
    "Default": "Server=.;Database=zj;User Id=sa;Password=xxx;TrustServerCertificate=True"
  }
}
```

3. `dotnet run` 重启即可。前端无需改任何代码。

## 这份 demo 想验证什么

### 1. Schema 驱动 = 旧 `fields_dict` 的现代版

`backend/Schemas/part.json` / `bom.json` 是用一份 JSON 描述了一张表/一对主子表的所有字段:中文标签、类型、宽度、必填、外键 lookup。前端从 `/api/schema/{name}` 拉这份 JSON,**自动渲染列表 + 表单 + 校验**。后期把这些 JSON 行迁到 SQL Server 的 `fields_dict` 表,只需把 `SchemaEndpoints.cs` 里的 `File.ReadAllText` 换成一条 SELECT,前端零改动。

### 2. 继承链对齐 VFP:`tsbase` → `tsmainform` / `multiform` → 具体表单

VFP 类层级:

```
tsbase  (libs/tsbase.vcx)        ← 通用:CHKCONNECT、工具栏、save/delete、audit、CHKACC、错误处理
  ├─ tsmainform                  ← 1对1 增加:单记录列表 + 编辑表单
  └─ multiform                   ← 1对多 增加:主表 + 子表网格,事务保存
        │
        └─ part.scx / bom.scx / customer.scx / ...   只配 schema,几乎不写代码
```

新栈一一对应:

| VFP | 新栈 | 文件 |
|---|---|---|
| `tsbase` | `useTsbase` hook + `<TsBaseShell>` | `frontend/src/components/tsbase.tsx` |
| `tsmainform` | `<TsMainForm>` | `frontend/src/components/TsMainForm.tsx` |
| `multiform` | `<TsMultiForm>` | `frontend/src/components/TsMultiForm.tsx` |
| `part.scx` | `<PartPage>` | `frontend/src/pages/PartPage.tsx` |
| `bom.scx`  | `<BomPage>`  | `frontend/src/pages/BomPage.tsx`  |

`useTsbase` 把所有横切关注点收一起 ——  schema 加载 / 权限闸门(`CHKACC` 等价)/ 审计日志(`WriteLog(THISFORM.CAPTION,...)` 等价)/ 错误边界。`<TsBaseShell>` 是它的视觉外壳(loading / 403 / error 三种状态)。

`TsMainForm` 和 `TsMultiForm` 都通过 `useTsbase` + `<TsBaseShell>` 拿到这些公共能力,**只新增各自的列表 + 表单/抽屉 UI**。

每个新模块的"页面"长这样(`pages/PartPage.tsx`):

```tsx
export default function PartPage() {
  return <TsMainForm schemaName="part" apiBase="/api/part" />;
}
```

**两行代码** = `tsbase` 的所有公共能力 + `tsmainform` 的列表/编辑 UI + 这一屏特有的 schema。等价于你 VFP 里 "新建一个 SCX,设父类 tsmainform,绑数据环境,完事"。

### 3. "重写父类方法" 的现代版 = override hooks

旧 VFP 子表单会重写 `BeforeSave` / `AfterSave` / `BeforeDelete` 处理特殊业务。新栈给 `TsMainForm` / `TsMultiForm` 暴露同名 prop,**签名一一对应**:

| VFP 方法 | 新栈 prop |
|---|---|
| `BeforeSave()` | `onBeforeSave: (row, mode, t) => row` |
| `AfterSave()`  | `onAfterSave: (row, mode, t) => void` |
| `BeforeDelete()` | `onBeforeDelete: (row, t) => boolean` |
| 工具栏自定义按钮 | `extraToolbar: ReactNode` |
| 行级自定义按钮 | `rowExtraActions: (row, t) => ReactNode` |

第三个参数 `t: TsbaseHandle` 提供 `audit()` / `canEdit` 等基类服务 —— 等价于 VFP 里 `THISFORM.WriteLog()` 那种父类方法访问。

举例(给 PART 加一个"自动生成物料号 + Excel 导入按钮"的子类):

```tsx
export default function PartPage() {
  return <TsMainForm
    schemaName="part" apiBase="/api/part"
    onBeforeSave={async (row, mode) => {
      if (mode === 'create' && !row.pt_no) row.pt_no = await nextPartNo(row.pt_type);
      return row;
    }}
    extraToolbar={<Button onClick={importExcel}>Excel 导入</Button>}
  />;
}
```

碰到真正特殊的屏(条码扫描、QC 工序卡)—— **别硬塞 schema/hook**,直接写普通 React 组件,等价于 VFP 里完全自定义的 SCX(不继承 tsmainform/multiform)。

### 3. 留逃生口 = 旧 VFP "重写父类方法"的现代版

VFP 子表单可以重写 `BeforeSave` 等方法处理业务规则。新方案给两个通用组件留了同样的 hook:

```tsx
<MasterForm
  schemaName="part"
  apiBase="/api/part"
  beforeSave={async (row, mode) => {
    // 例如:补默认值、调用编号生成接口、审计写日志
    if (mode === 'create' && !row.pt_no) row.pt_no = await nextPartNo(row.pt_type);
    return row;
  }}
  extraToolbar={<MyImportButton />}        // 例如 Excel 导入按钮
  rowExtraActions={(row) => <PrintLabelLink row={row} />}  // 例如打印 ZPL 标签
/>
```

碰到 30% 真正特殊的屏(条码扫描、QC 工序卡),**别硬塞进 schema** —— 直接写个普通 React 组件就行,等价于 VFP 里完全自定义的 SCX。

## 目录结构(完整)

```
modernization-demo/
├── README.md
├── backend/
│   ├── LeungyouErp.Api.csproj
│   ├── Program.cs                       # DI / 路由组装
│   ├── appsettings.json                 # Provider + 连接串
│   ├── Properties/launchSettings.json   # 监听 5050
│   ├── Data/Db.cs                       # IDbFactory(Sqlite/SqlServer 双实现)+ 自动建表
│   ├── Models/JsonHelpers.cs            # JsonElement → 强类型转换
│   ├── Data/
│   │   ├── Db.cs                        # IDbFactory(Sqlite/SqlServer 双实现)
│   │   ├── RepositoryContracts.cs       # IMaster/IMasterDetailRepository + 4 个 marker 接口
│   │   ├── MasterRepoBase.cs            # 1对1 通用基类(Insert/Update/Delete/Normalize)
│   │   ├── MultiRepoBase.cs             # 1对多 通用基类(事务 upsert + delete-all-insert-all)
│   │   ├── PartRepository.cs            # ← 每个新模块只是 3 个小类
│   │   ├── CustomerRepository.cs        #   PartRepoBase: Table/PK/StrFields/NumFields
│   │   ├── BomRepository.cs             #   SqlServerXxx:  read 走 EXEC *_selection
│   │   └── SoRepository.cs              #   SqliteXxx:     read 走内联 SQL
│   ├── Endpoints/
│   │   ├── SchemaEndpoints.cs           # GET /api/schema/{name},  GET /api/lookup/{table}
│   │   └── CrudEndpoints.cs             # MapMainCrud<T> / MapMultiCrud<T> — 每屏 1 行
│   ├── Schemas/
│   │   ├── part.json / customer.json    # 1对1 schema
│   │   └── bom.json  / so.json          # 1对多 schema
│   └── Sql/
│       ├── init.sql                     # SQLite 建表 + 种子
│       ├── init.mssql.sql               # SQL Server T-SQL 建表
│       └── init.mssql.procs.sql         # 参考用 *_selection 过程定义
└── frontend/
    ├── package.json / vite.config.ts / tsconfig.json / index.html
    └── src/
        ├── main.tsx / App.tsx           # 路由 + 侧边菜单(基础资料 / 业务单据 两组)
        ├── api.ts / types.ts
        ├── components/
        │   ├── tsbase.tsx               # ← 等价 VFP `tsbase`
        │   │                            #   useTsbase hook + TsBaseShell + TsBaseList + TsBaseFormProps
        │   ├── TsMainForm.tsx           # ← 等价 VFP `tsmainform`(1对1)
        │   ├── TsMultiForm.tsx          # ← 等价 VFP `multiform`(1对多)
        │   └── FieldInput.tsx           # 共享字段渲染器
        └── pages/
            ├── PartPage.tsx             # ← 等价 VFP `part.scx`,2 行
            ├── CustomerPage.tsx         # ← 等价 VFP `customer.scx`,2 行
            ├── BomPage.tsx              # ← 等价 VFP `bom.scx`,2 行
            └── SoPage.tsx               # ← 等价 VFP `so.scx`,2 行
```

## 加一个新模块要改多少代码

**完成 customer (1对1) 与 so (1对多) 时的真实增量:**

| 新加的内容 | customer (1对1) | so (1对多) |
|---|---|---|
| `Data/XxxRepository.cs`(3 小类:base + sql + sqlite) | ~50 行 | ~70 行 |
| `Schemas/xxx.json` | ~20 行 | ~30 行 |
| `Sql/init.sql` 表 + 种子数据 | ~16 行 | ~30 行 |
| `Sql/init.mssql.sql` 表(若全新空库) | ~16 行 | ~30 行 |
| `Sql/init.mssql.procs.sql` 过程参考(若全新空库) | ~14 行 | ~40 行 |
| `Program.cs` DI 注册 | 1 行 | 1 行 |
| `Program.cs` endpoint 注册 | 1 行 | 1 行 |
| `Endpoints/SchemaEndpoints.cs` lookup 白名单(仅当被别的屏 lookup) | 1 行 | 0 行 |
| `pages/XxxPage.tsx` | **2 行** | **2 行** |
| `App.tsx` 菜单项 + 路由 | 2 行 | 2 行 |
| **合计** | **~110 行** | **~210 行** |

—— 对比 VFP 里"新建 SCX,设父类 tsmainform,绑数据环境"的工作量,**节奏接近**。
而所有横切关注点(权限 / 审计 / 错误外壳 / 工具栏 / 删除二次确认 / 写后回刷 / 事务 upsert)**都在基类里写过一次,4 个模块共享。**

## API 速查

| Method | URL | 说明 |
|--------|-----|------|
| GET    | `/api/schema/part`        | 取 PART 表单 schema |
| GET    | `/api/schema/bom`         | 取 BOM 表单 schema |
| GET    | `/api/lookup/part?q=xxx`  | 物料下拉(供 BOM 子表 lookup 用) |
| GET    | `/api/part?q=xxx`         | 物料列表 |
| GET    | `/api/part/{ptNo}`        | 单条物料 |
| POST   | `/api/part`               | 新增物料 |
| PUT    | `/api/part/{ptNo}`        | 修改物料 |
| DELETE | `/api/part/{ptNo}`        | 删除物料 |
| GET    | `/api/bom?q=xxx`          | BOM 主表列表 |
| GET    | `/api/bom/{bhPtno}`       | BOM 主+子完整加载 |
| PUT    | `/api/bom/{bhPtno}`       | 主+子事务保存(子表全删全插) |
| DELETE | `/api/bom/{bhPtno}`       | 删除整张 BOM |

## 下一步建议

跑通后再往这个底座上加(每一步都不影响 demo 已有功能):

1. **认证 / 权限** — 复用旧 `user_level` 表,给 endpoint 加 `[Authorize]`,前端按 schema 里的 `permission` 字段隐藏菜单 / 按钮。
2. **`fields_dict` 入库** — 把 `Schemas/*.json` 迁到 SQL Server 的一张表里,后台加管理界面让业务可改。
3. **审计日志** — 包一层 `auditedSave` hook,所有 `MasterForm`/`MasterDetailForm` 自动写日志(对应旧 `WriteLog`)。
4. **真实模块** — 拿 1-2 个纯 CRUD 字典表(如 `colour.scx` / `category.scx`)再跑一遍,验证 schema 通用性;碰到的特例再回头加 hook。
5. **打印 / 报表** — `barcode_*.prg` 的 ZPL 模板搬到后端,通过 `/api/print/{tpl}` 输出,前端用 BrowserPrint 推到 Zebra 打印机。
