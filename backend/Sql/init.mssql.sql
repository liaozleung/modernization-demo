-- T-SQL equivalent of init.sql. Use against SQL Server when you flip
-- "Database:Provider" to "SqlServer". Field types match the VFP source schema
-- as inferred from FORMS\part.SCT, FORMS\bom.SCT, FORMS\customer.SCT,
-- FORMS\so.SCT (cursor schema lines).

IF OBJECT_ID('dbo.so_l','U') IS NULL
CREATE TABLE dbo.so_l (
    sl_no       varchar(10) NOT NULL,
    sl_srno     int         NOT NULL,
    sl_partno   varchar(25) NOT NULL DEFAULT(''),
    sl_po       varchar(30) NOT NULL DEFAULT(''),
    sl_custptno varchar(30) NOT NULL DEFAULT(''),
    sl_qty      decimal(12,4) NOT NULL DEFAULT(0),
    sl_price    decimal(12,4) NOT NULL DEFAULT(0),
    sl_duedate  date        NULL,
    sl_rmk      nvarchar(40) NOT NULL DEFAULT(''),
    CONSTRAINT pk_so_l PRIMARY KEY (sl_no, sl_srno)
);

IF OBJECT_ID('dbo.so_h','U') IS NULL
CREATE TABLE dbo.so_h (
    sh_no       varchar(10)  NOT NULL PRIMARY KEY,
    sh_cust     varchar(10)  NOT NULL DEFAULT(''),
    sh_type     varchar(12)  NOT NULL DEFAULT(N'正常'),
    sh_state    varchar(10)  NOT NULL DEFAULT(N'草稿'),
    sh_date     date         NOT NULL DEFAULT(GETDATE()),
    creator     varchar(16)  NOT NULL DEFAULT(''),
    create_date datetime     NOT NULL DEFAULT(GETDATE()),
    update_date datetime     NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.customer','U') IS NULL
CREATE TABLE dbo.customer (
    cu_code       varchar(10)   NOT NULL PRIMARY KEY,
    cu_name       nvarchar(80)  NOT NULL DEFAULT(''),
    cu_short_name nvarchar(20)  NOT NULL DEFAULT(''),
    cu_add        nvarchar(120) NOT NULL DEFAULT(''),
    cu_phone      varchar(40)   NOT NULL DEFAULT(''),
    cu_dirphone   varchar(40)   NOT NULL DEFAULT(''),
    cu_fax        varchar(40)   NOT NULL DEFAULT(''),
    cu_contact    nvarchar(40)  NOT NULL DEFAULT(''),
    cu_currency   varchar(8)    NOT NULL DEFAULT('CNY'),
    cu_payment    nvarchar(40)  NOT NULL DEFAULT(''),
    cu_term       nvarchar(40)  NOT NULL DEFAULT(''),
    cu_supportor  nvarchar(20)  NOT NULL DEFAULT(''),
    cu_tax        decimal(5,2)  NOT NULL DEFAULT(0),
    create_date   datetime      NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.bom_l','U') IS NULL
CREATE TABLE dbo.bom_l (
    bl_pptno  varchar(20) NOT NULL,
    bl_srno   int         NOT NULL,
    bl_ptno   varchar(20) NOT NULL,
    bl_qty    decimal(12,4) NOT NULL DEFAULT(1),
    bl_rate   decimal(12,4) NOT NULL DEFAULT(0),
    bl_loca   varchar(20) NOT NULL DEFAULT(''),
    CONSTRAINT pk_bom_l PRIMARY KEY (bl_pptno, bl_srno)
);

IF OBJECT_ID('dbo.bom_h','U') IS NULL
CREATE TABLE dbo.bom_h (
    bh_ptno     varchar(20) NOT NULL PRIMARY KEY,
    bh_ver      varchar(10) NOT NULL DEFAULT('A'),
    bh_dept     varchar(20) NOT NULL DEFAULT(''),
    create_date datetime    NOT NULL DEFAULT(GETDATE()),
    update_date datetime    NOT NULL DEFAULT(GETDATE())
);

IF OBJECT_ID('dbo.part','U') IS NULL
CREATE TABLE dbo.part (
    pt_no       varchar(20)  NOT NULL PRIMARY KEY,
    pt_desc     nvarchar(110) NOT NULL DEFAULT(''),
    pt_spec     nvarchar(110) NOT NULL DEFAULT(''),
    pt_unit     varchar(6)   NOT NULL DEFAULT(''),
    pt_type     varchar(10)  NOT NULL DEFAULT(''),
    pt_category nvarchar(40) NOT NULL DEFAULT(''),
    pt_weight   decimal(12,4) NOT NULL DEFAULT(0),
    safe_stock  decimal(12,4) NOT NULL DEFAULT(0),
    pt_drawno   varchar(40)  NOT NULL DEFAULT(''),
    pt_rmk      nvarchar(255) NOT NULL DEFAULT(''),
    create_date datetime     NOT NULL DEFAULT(GETDATE())
);
