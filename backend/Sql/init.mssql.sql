-- T-SQL equivalent of init.sql. Use against SQL Server when you flip
-- "Database:Provider" to "SqlServer". Field types match the VFP source schema
-- as inferred from FORMS\part.SCT and FORMS\bom.SCT (cursor schema).

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
