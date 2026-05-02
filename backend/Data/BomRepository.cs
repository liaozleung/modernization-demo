using System.Data;
using Dapper;

namespace LeungyouErp.Api.Data;

/// <summary>
/// Entity config for BOM. Header lives in <c>bom_h</c>, lines in <c>bom_l</c>;
/// the FK from line back to header is <c>bom_l.bl_pptno</c>. Mirrors the cursor
/// schema observed in FORMS\bom.SCT.
/// </summary>
public abstract class BomRepoBase(IDbFactory f) : MultiRepoBase(f), IBomRepository
{
    protected override string HTable     => "bom_h";
    protected override string HKey       => "bh_ptno";
    protected override string[] HStrFields => ["bh_ptno","bh_ver","bh_dept"];
    protected override string[] HNumFields => Array.Empty<string>();

    protected override string LTable     => "bom_l";
    protected override string LParentRef => "bl_pptno";
    protected override string LSrNo      => "bl_srno";
    protected override string[] LStrFields => ["bl_ptno","bl_loca"];
    protected override string[] LNumFields => ["bl_qty","bl_rate"];
}

/// <summary>SQL Server impl — reads via <c>bom_h_selection</c> / <c>bom_l_selection</c>.</summary>
public sealed class SqlServerBomRepository(IDbFactory f) : BomRepoBase(f)
{
    protected override Task<IEnumerable<dynamic>> ExecSearchHeadersAsync(IDbConnection c, string? q)
    {
        var any = string.IsNullOrEmpty(q) ? "%" : $"%{q}%";
        return c.QueryAsync("EXEC bom_h_selection @bhptno=@any, @blptno='%'", new { any });
    }

    protected override Task<dynamic?> ExecGetHeaderAsync(IDbConnection c, string key)
        => c.QueryFirstOrDefaultAsync(
            "EXEC bom_h_selection @bhptno=@key, @ByKeyExactQuery=1", new { key });

    protected override Task<IEnumerable<dynamic>> ExecGetLinesAsync(IDbConnection c, string key)
        => c.QueryAsync("EXEC bom_l_selection @blpptno=@key", new { key });
}

/// <summary>SQLite impl — inline SQL with the same join pattern the procs do.</summary>
public sealed class SqliteBomRepository(IDbFactory f) : BomRepoBase(f)
{
    protected override Task<IEnumerable<dynamic>> ExecSearchHeadersAsync(IDbConnection c, string? q)
    {
        var sql = string.IsNullOrEmpty(q)
            ? @"select h.bh_ptno, h.bh_ver, h.bh_dept, h.create_date, h.update_date,
                       p.pt_desc, p.pt_spec, p.pt_unit
                from bom_h h left join part p on p.pt_no=h.bh_ptno
                order by h.bh_ptno"
            : @"select h.bh_ptno, h.bh_ver, h.bh_dept, h.create_date, h.update_date,
                       p.pt_desc, p.pt_spec, p.pt_unit
                from bom_h h left join part p on p.pt_no=h.bh_ptno
                where h.bh_ptno like @qLike or p.pt_desc like @qLike
                order by h.bh_ptno";
        return c.QueryAsync(sql, new { qLike = $"%{q}%" });
    }

    protected override Task<dynamic?> ExecGetHeaderAsync(IDbConnection c, string key)
        => c.QueryFirstOrDefaultAsync(@"
            select h.bh_ptno, h.bh_ver, h.bh_dept, h.create_date, h.update_date,
                   p.pt_desc, p.pt_spec, p.pt_unit
            from bom_h h left join part p on p.pt_no=h.bh_ptno
            where h.bh_ptno=@key", new { key });

    protected override Task<IEnumerable<dynamic>> ExecGetLinesAsync(IDbConnection c, string key)
        => c.QueryAsync(@"
            select l.bl_srno, l.bl_ptno, p.pt_desc, p.pt_unit, p.pt_type,
                   l.bl_qty, l.bl_rate, l.bl_loca, l.bl_pptno
            from bom_l l left join part p on p.pt_no=l.bl_ptno
            where l.bl_pptno=@key order by l.bl_srno", new { key });
}
