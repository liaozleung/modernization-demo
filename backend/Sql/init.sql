-- SQLite seed for the modernization demo. Mirrors the relevant subset of the
-- VFP/SQL Server PART, BOM_H, BOM_L tables. T-SQL equivalents in Sql/init.mssql.sql.

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
