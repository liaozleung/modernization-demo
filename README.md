# 粮裕 ERP 现代化重构 — 第一阶段最小可跑 Demo

本目录是 VFP9 ERP 现代化方案的第一阶段端到端验证,覆盖 **物料档案 (PART, 1对1)** 与 **物料清单 (BOM, 1对多)** 两个模块。

目标只有一件事:**用一份 schema 驱动一组通用基类组件**,验证旧 `tsbase`/`fields_dict` 的"继承红利"在新栈下还能拿到。

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

## 切换到 SQL Server(连你现网或本地实例)

1. 在你的 SQL Server 上跑一遍 `backend/Sql/init.mssql.sql`(或直接对着已有的 PART/BOM_H/BOM_L 表用,字段名一致即可)。
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

### 2. 通用基类 = 旧 `tsbase` 1对1 / 1对多 的现代版

- `frontend/src/components/MasterForm.tsx` ← 对应你的 **1对1 表单库**
- `frontend/src/components/MasterDetailForm.tsx` ← 对应你的 **1对多 表单库**

每个新模块的"页面"长这样(看 `pages/PartPage.tsx`):

```tsx
export default function PartPage() {
  return <MasterForm schemaName="part" apiBase="/api/part" />;
}
```

**两行代码** = 工具栏 + 列表 + 搜索 + 分页 + 新增/修改/删除弹窗 + 字段校验 + 时间格式化 + 外键下拉 + lookup 搜索。这就是旧 `tsbase` 子表单"继承一下就有保存/删除/审核按钮"的等价物。

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
│   ├── Endpoints/
│   │   ├── SchemaEndpoints.cs           # GET /api/schema/{name},  GET /api/lookup/{table}
│   │   ├── PartEndpoints.cs             # PART CRUD
│   │   └── BomEndpoints.cs              # BOM 主+子事务保存
│   ├── Schemas/
│   │   ├── part.json                    # 物料档案 schema (1对1)
│   │   └── bom.json                     # BOM schema (1对多)
│   └── Sql/
│       ├── init.sql                     # SQLite 建表 + 种子
│       └── init.mssql.sql               # SQL Server T-SQL 等价
└── frontend/
    ├── package.json / vite.config.ts / tsconfig.json / index.html
    └── src/
        ├── main.tsx / App.tsx           # 路由 + 侧边菜单
        ├── api.ts / types.ts
        ├── components/
        │   ├── MasterForm.tsx           # 通用 1对1 基类组件
        │   └── MasterDetailForm.tsx     # 通用 1对多 基类组件
        └── pages/
            ├── PartPage.tsx             # 2 行代码 = 一张完整 PART 屏
            └── BomPage.tsx              # 2 行代码 = 一张完整 BOM 屏
```

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
