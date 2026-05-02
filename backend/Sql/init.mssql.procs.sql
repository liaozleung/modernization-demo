-- Reference stored-procedure definitions matching the VFP data-environment
-- contracts observed in:
--   FORMS\part.SCT      ->  EXEC part_selection      @ptno, @ptdesc, ..., [@ByKeyExactQuery=1]
--   FORMS\bom.SCT       ->  EXEC bom_h_selection     @bhptno, @blptno, [@ByKeyExactQuery=1]
--                       ->  EXEC bom_l_selection     @blpptno
--   FORMS\customer.SCT  ->  EXEC Customer_selection  @CUCODE, @cuname, @salesman, [@ByKeyExactQuery=1]
--   FORMS\so.SCT        ->  EXEC So_h_selection      @shno, @shcust, @shstatus, @slpo, @slpartno,
--                                                    @slcustptno, @shfmdate, @shenddate, @shcreator, [@ByKeyExactQuery=1]
--                       ->  EXEC So_l_selection      @slno
--
-- IMPORTANT: in your real ldx / zj database these procs already exist and may
-- include extra business logic (access filtering, audit, additional joins).
-- Call the EXISTING procs — do NOT replace them with these stubs. The stubs
-- here are only for spinning up a brand-new SQL Server demo DB from scratch.

IF OBJECT_ID('dbo.part_selection','P') IS NOT NULL DROP PROCEDURE dbo.part_selection;
GO
CREATE PROCEDURE dbo.part_selection
    @ptno varchar(25)='%', @ptdesc nvarchar(110)='%', @ptspec nvarchar(110)='%',
    @ptrawmatl varchar(15)='%', @pttx varchar(10)='%', @ptcx varchar(20)='%',
    @ptyx varchar(20)='%', @ptcolor varchar(50)='%', @ptstd varchar(20)='%',
    @pttype varchar(10)='%', @pcategory nvarchar(40)='%',
    @ByKeyExactQuery bit=0
AS
BEGIN
    SET NOCOUNT ON;
    IF @ByKeyExactQuery = 1
    BEGIN SELECT * FROM dbo.part WHERE pt_no=@ptno; RETURN; END;
    SELECT * FROM dbo.part
     WHERE pt_no LIKE @ptno AND pt_desc LIKE @ptdesc AND pt_spec LIKE @ptspec
       AND pt_type LIKE @pttype AND pt_category LIKE @pcategory
     ORDER BY pt_no;
END;
GO

IF OBJECT_ID('dbo.bom_h_selection','P') IS NOT NULL DROP PROCEDURE dbo.bom_h_selection;
GO
CREATE PROCEDURE dbo.bom_h_selection
    @bhptno varchar(20)='%', @blptno varchar(20)='%', @ByKeyExactQuery bit=0
AS
BEGIN
    SET NOCOUNT ON;
    IF @ByKeyExactQuery = 1
    BEGIN
        SELECT h.bh_ptno, p.pt_desc, p.pt_spec, p.pt_unit,
               h.bh_ver, h.bh_dept, h.create_date, h.update_date
          FROM dbo.bom_h h LEFT JOIN dbo.part p ON p.pt_no=h.bh_ptno
         WHERE h.bh_ptno=@bhptno;
        RETURN;
    END;
    SELECT DISTINCT h.bh_ptno, p.pt_desc, p.pt_spec, p.pt_unit,
                    h.bh_ver, h.bh_dept, h.create_date, h.update_date
      FROM dbo.bom_h h
      LEFT JOIN dbo.part p  ON p.pt_no=h.bh_ptno
      LEFT JOIN dbo.bom_l l ON l.bl_pptno=h.bh_ptno
     WHERE h.bh_ptno LIKE @bhptno
       AND (@blptno = '%' OR l.bl_ptno LIKE @blptno)
     ORDER BY h.bh_ptno;
END;
GO

IF OBJECT_ID('dbo.bom_l_selection','P') IS NOT NULL DROP PROCEDURE dbo.bom_l_selection;
GO
CREATE PROCEDURE dbo.bom_l_selection @blpptno varchar(20) AS
BEGIN
    SET NOCOUNT ON;
    SELECT l.bl_srno, l.bl_ptno, p.pt_desc, p.pt_unit, p.pt_type,
           l.bl_qty, l.bl_rate, l.bl_loca, l.bl_pptno
      FROM dbo.bom_l l LEFT JOIN dbo.part p ON p.pt_no=l.bl_ptno
     WHERE l.bl_pptno=@blpptno
     ORDER BY l.bl_srno;
END;
GO

IF OBJECT_ID('dbo.Customer_selection','P') IS NOT NULL DROP PROCEDURE dbo.Customer_selection;
GO
CREATE PROCEDURE dbo.Customer_selection
    @CUCODE varchar(10)='%', @cuname nvarchar(80)='%', @salesman varchar(20)='%',
    @ByKeyExactQuery bit=0
AS
BEGIN
    SET NOCOUNT ON;
    IF @ByKeyExactQuery = 1
    BEGIN SELECT * FROM dbo.customer WHERE cu_code=@CUCODE; RETURN; END;
    SELECT * FROM dbo.customer
     WHERE cu_code LIKE @CUCODE
       AND (cu_name LIKE @cuname OR cu_short_name LIKE @cuname)
       AND cu_supportor LIKE @salesman
     ORDER BY cu_code;
END;
GO

IF OBJECT_ID('dbo.So_h_selection','P') IS NOT NULL DROP PROCEDURE dbo.So_h_selection;
GO
-- Cursor schema in FORMS\so.SCT: SH_NO, SH_CUST, CU_SHORT_NAME (joined),
-- SH_TYPE, SH_STATE, SH_DATE, CREATOR, CREATE_DATE, AUDITOR (omitted for demo),
-- AUDIT_DATE (omitted), UPDATE_DATE
CREATE PROCEDURE dbo.So_h_selection
    @shno varchar(10)='%', @shcust varchar(10)='%', @shstatus varchar(10)='%',
    @slpo varchar(30)='%', @slpartno varchar(25)='%', @slcustptno varchar(30)='%',
    @shfmdate date=NULL, @shenddate date=NULL, @shcreator varchar(16)='%',
    @ByKeyExactQuery bit=0
AS
BEGIN
    SET NOCOUNT ON;
    IF @ByKeyExactQuery = 1
    BEGIN
        SELECT h.sh_no, h.sh_cust, c.cu_short_name, h.sh_type, h.sh_state, h.sh_date,
               h.creator, h.create_date, h.update_date
          FROM dbo.so_h h LEFT JOIN dbo.customer c ON c.cu_code=h.sh_cust
         WHERE h.sh_no=@shno;
        RETURN;
    END;
    SELECT DISTINCT h.sh_no, h.sh_cust, c.cu_short_name, h.sh_type, h.sh_state, h.sh_date,
                    h.creator, h.create_date, h.update_date
      FROM dbo.so_h h
      LEFT JOIN dbo.customer c ON c.cu_code=h.sh_cust
      LEFT JOIN dbo.so_l l ON l.sl_no=h.sh_no
     WHERE h.sh_no LIKE @shno
       AND h.sh_cust LIKE @shcust
       AND h.sh_state LIKE @shstatus
       AND h.creator LIKE @shcreator
       AND (@slpo = '%' OR l.sl_po LIKE @slpo)
       AND (@slpartno = '%' OR l.sl_partno LIKE @slpartno)
       AND (@slcustptno = '%' OR l.sl_custptno LIKE @slcustptno)
       AND (@shfmdate IS NULL OR h.sh_date >= @shfmdate)
       AND (@shenddate IS NULL OR h.sh_date <= @shenddate)
     ORDER BY h.sh_no DESC;
END;
GO

IF OBJECT_ID('dbo.So_l_selection','P') IS NOT NULL DROP PROCEDURE dbo.So_l_selection;
GO
CREATE PROCEDURE dbo.So_l_selection @slno varchar(10) AS
BEGIN
    SET NOCOUNT ON;
    SELECT l.sl_srno, l.sl_partno, p.pt_desc, p.pt_unit,
           l.sl_qty, l.sl_price, l.sl_duedate, l.sl_po, l.sl_custptno, l.sl_rmk, l.sl_no
      FROM dbo.so_l l LEFT JOIN dbo.part p ON p.pt_no=l.sl_partno
     WHERE l.sl_no=@slno
     ORDER BY l.sl_srno;
END;
GO
