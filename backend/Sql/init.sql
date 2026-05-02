-- SQLite seed for the modernization demo. Mirrors the relevant subset of the
-- VFP/SQL Server PART, BOM_H, BOM_L, CUSTOMER, SO_H, SO_L tables.
-- T-SQL equivalents in Sql/init.mssql.sql.

-- ============================================================================
-- PART (1对1) — referenced from FORMS/part.scx
-- ============================================================================
CREATE TABLE IF NOT EXISTS part (
    pt_no        TEXT PRIMARY KEY,
    pt_desc      TEXT NOT NULL DEFAULT '',
    pt_spec      TEXT NOT NULL DEFAULT '',
    pt_unit      TEXT NOT NULL DEFAULT '',
    pt_type      TEXT NOT NULL DEFAULT '',
    pt_category  TEXT NOT NULL DEFAULT '',
    pt_weight    REAL NOT NULL DEFAULT 0,
    safe_stock   REAL NOT NULL DEFAULT 0,
    pt_drawno    TEXT NOT NULL DEFAULT '',
    pt_rmk       TEXT NOT NULL DEFAULT '',
    create_date  TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- BOM (1对多) — referenced from FORMS/bom.scx
-- ============================================================================
CREATE TABLE IF NOT EXISTS bom_h (
    bh_ptno      TEXT PRIMARY KEY,
    bh_ver       TEXT NOT NULL DEFAULT 'A',
    bh_dept      TEXT NOT NULL DEFAULT '',
    create_date  TEXT NOT NULL DEFAULT (datetime('now')),
    update_date  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (bh_ptno) REFERENCES part(pt_no)
);

CREATE TABLE IF NOT EXISTS bom_l (
    bl_pptno     TEXT NOT NULL,
    bl_srno      INTEGER NOT NULL,
    bl_ptno      TEXT NOT NULL,
    bl_qty       REAL NOT NULL DEFAULT 1,
    bl_rate      REAL NOT NULL DEFAULT 0,
    bl_loca      TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (bl_pptno, bl_srno),
    FOREIGN KEY (bl_pptno) REFERENCES bom_h(bh_ptno),
    FOREIGN KEY (bl_ptno)  REFERENCES part(pt_no)
);

-- ============================================================================
-- CUSTOMER (1对1) — referenced from FORMS/customer.scx
-- ============================================================================
CREATE TABLE IF NOT EXISTS customer (
    cu_code        TEXT PRIMARY KEY,
    cu_name        TEXT NOT NULL DEFAULT '',
    cu_short_name  TEXT NOT NULL DEFAULT '',
    cu_add         TEXT NOT NULL DEFAULT '',
    cu_phone       TEXT NOT NULL DEFAULT '',
    cu_dirphone    TEXT NOT NULL DEFAULT '',
    cu_fax         TEXT NOT NULL DEFAULT '',
    cu_contact     TEXT NOT NULL DEFAULT '',
    cu_currency    TEXT NOT NULL DEFAULT 'CNY',
    cu_payment     TEXT NOT NULL DEFAULT '',
    cu_term        TEXT NOT NULL DEFAULT '',
    cu_supportor   TEXT NOT NULL DEFAULT '',
    cu_tax         REAL NOT NULL DEFAULT 0,
    create_date    TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ============================================================================
-- SO (1对多) — referenced from FORMS/so.scx
-- ============================================================================
CREATE TABLE IF NOT EXISTS so_h (
    sh_no        TEXT PRIMARY KEY,
    sh_cust      TEXT NOT NULL DEFAULT '',
    sh_type      TEXT NOT NULL DEFAULT '正常',
    sh_state     TEXT NOT NULL DEFAULT '草稿',
    sh_date      TEXT NOT NULL DEFAULT (date('now')),
    creator      TEXT NOT NULL DEFAULT '',
    create_date  TEXT NOT NULL DEFAULT (datetime('now')),
    update_date  TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (sh_cust) REFERENCES customer(cu_code)
);

CREATE TABLE IF NOT EXISTS so_l (
    sl_no        TEXT NOT NULL,
    sl_srno      INTEGER NOT NULL,
    sl_partno    TEXT NOT NULL DEFAULT '',
    sl_po        TEXT NOT NULL DEFAULT '',
    sl_custptno  TEXT NOT NULL DEFAULT '',
    sl_qty       REAL NOT NULL DEFAULT 0,
    sl_price     REAL NOT NULL DEFAULT 0,
    sl_duedate   TEXT,
    sl_rmk       TEXT NOT NULL DEFAULT '',
    PRIMARY KEY (sl_no, sl_srno),
    FOREIGN KEY (sl_no)     REFERENCES so_h(sh_no),
    FOREIGN KEY (sl_partno) REFERENCES part(pt_no)
);

-- ============================================================================
-- Sample data
-- ============================================================================
INSERT OR IGNORE INTO part (pt_no, pt_desc, pt_spec, pt_unit, pt_type, pt_category, pt_weight, safe_stock, pt_drawno, pt_rmk) VALUES
    ('FG-001', '成品-外壳总成', '180x120x40', 'PCS', 'FG', '成品',  0.85, 50,  'D-FG-001', ''),
    ('SUB-101','半成品-上盖',   '180x120x10', 'PCS', 'SUB','半成品',0.20, 100, 'D-SUB-101',''),
    ('SUB-102','半成品-下盖',   '180x120x20', 'PCS', 'SUB','半成品',0.30, 100, 'D-SUB-102',''),
    ('RM-201', '原料-ABS塑胶',  '颗粒',       'KG',  'RM', '原料',  0,    500, '',          '黑色'),
    ('RM-202', '原料-不锈钢板', '1.0mm',      'KG',  'RM', '原料',  0,    300, '',          ''),
    ('PK-301', '包装-瓦楞箱',   'L380xW260',  'PCS', 'PK', '包装',  0.10, 200, 'D-PK-301',  '');

INSERT OR IGNORE INTO bom_h (bh_ptno, bh_ver, bh_dept) VALUES
    ('FG-001', 'A', '工程部');

INSERT OR IGNORE INTO bom_l (bl_pptno, bl_srno, bl_ptno, bl_qty, bl_rate, bl_loca) VALUES
    ('FG-001', 1, 'SUB-101', 1, 0.5, 'A-01'),
    ('FG-001', 2, 'SUB-102', 1, 0.5, 'A-02'),
    ('FG-001', 3, 'PK-301',  1, 1.0, 'B-05');

INSERT OR IGNORE INTO customer (cu_code, cu_name, cu_short_name, cu_add, cu_phone, cu_contact, cu_currency, cu_payment, cu_supportor, cu_tax) VALUES
    ('C0001', '深圳市华为技术有限公司',     '华为',     '深圳市龙岗区坂田华为基地', '0755-28780808', '李工', 'CNY', '月结30天', '张三', 13),
    ('C0002', '小米通讯技术有限公司',       '小米',     '北京市海淀区清河中街68号', '010-60606666',  '王工', 'CNY', '月结60天', '李四', 13),
    ('C0003', 'Panasonic Industrial Devices','Panasonic','大阪市中央区',           '+81-6-6908-1131','Sato', 'JPY', 'NET 45',   '王五',  0);

INSERT OR IGNORE INTO so_h (sh_no, sh_cust, sh_type, sh_state, sh_date, creator) VALUES
    ('SO20260501001', 'C0001', '正常', '已审核', '2026-05-01', '张三'),
    ('SO20260502002', 'C0002', '正常', '草稿',   '2026-05-02', '李四');

INSERT OR IGNORE INTO so_l (sl_no, sl_srno, sl_partno, sl_po, sl_custptno, sl_qty, sl_price, sl_duedate, sl_rmk) VALUES
    ('SO20260501001', 1, 'FG-001', 'PO-HW-2026-0517', 'HW-FG-001', 1000, 56.80, '2026-06-15', '紧急'),
    ('SO20260501001', 2, 'PK-301', 'PO-HW-2026-0517', 'HW-PK-301', 1000,  3.20, '2026-06-15', ''),
    ('SO20260502002', 1, 'FG-001', 'PO-MI-2026-0428', 'MI-FG-001',  500, 58.00, '2026-06-30', '');
