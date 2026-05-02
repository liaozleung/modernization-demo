using System.Data;
using Dapper;

namespace LeungyouErp.Api.Data;

/// <summary>
/// Entity config for sales orders. Header lives in <c>so_h</c>, lines in
/// <c>so_l</c>; the FK from line back to header is <c>so_l.sl_no</c>.
/// Mirrors the cursor schema observed in FORMS\so.SCT.
/// </summary>
public abstract class SoRepoBase(IDbFactory f) : MultiRepoBase(f), ISoRepository
{
    protected override string HTable     => "so_h";
    protected override string HKey       => "sh_no";
    protected override string[] HStrFields =>
        ["sh_no","sh_cust","sh_type","sh_state","creator"];
    protected override string[] HNumFields => Array.Empty<string>();
    protected override string[] HDateFields => ["sh_date"];

    protected override string LTable     => "so_l";
    protected override string LParentRef => "sl_no";
    protected override string LSrNo      => "sl_srno";
    protected override string[] LStrFields => ["sl_partno","sl_po","sl_custptno","sl_rmk"];
    protected override string[] LNumFields => ["sl_qty","sl_price"];
    protected override string[] LDateFields => ["sl_duedate"];
}

/// <summary>SQL Server impl — reads via <c>So_h_selection</c> / <c>So_l_selection</c>.</summary>
public sealed class SqlServerSoRepository(IDbFactory f) : SoRepoBase(f)
{
    protected override Task<IEnumerable<dynamic>> ExecSearchHeadersAsync(IDbConnection c, string? q)
    {
        var any = string.IsNullOrEmpty(q) ? "%" : $"%{q}%";
        return c.QueryAsync(@"EXEC So_h_selection
            @shno=@any, @shcust='%', @shstatus='%',
            @slpo='%', @slpartno='%', @slcustptno='%',
            @shfmdate=NULL, @shenddate=NULL, @shcreator='%'", new { any });
    }

    protected override Task<dynamic?> ExecGetHeaderAsync(IDbConnection c, string key)
        => c.QueryFirstOrDefaultAsync(@"EXEC So_h_selection
            @shno=@key, @shcust='%', @shstatus='%',
            @slpo='%', @slpartno='%', @slcustptno='%',
            @shfmdate=NULL, @shenddate=NULL, @shcreator='%', @ByKeyExactQuery=1",
            new { key });

    protected override Task<IEnumerable<dynamic>> ExecGetLinesAsync(IDbConnection c, string key)
        => c.QueryAsync("EXEC So_l_selection @slno=@key", new { key });
}

/// <summary>SQLite impl — inline SQL.</summary>
public sealed class SqliteSoRepository(IDbFactory f) : SoRepoBase(f)
{
    protected override Task<IEnumerable<dynamic>> ExecSearchHeadersAsync(IDbConnection c, string? q)
    {
        var sql = string.IsNullOrEmpty(q)
            ? @"select h.sh_no, h.sh_cust, c.cu_short_name, h.sh_type, h.sh_state, h.sh_date,
                       h.creator, h.create_date, h.update_date
                from so_h h left join customer c on c.cu_code=h.sh_cust
                order by h.sh_no desc"
            : @"select h.sh_no, h.sh_cust, c.cu_short_name, h.sh_type, h.sh_state, h.sh_date,
                       h.creator, h.create_date, h.update_date
                from so_h h left join customer c on c.cu_code=h.sh_cust
                where h.sh_no like @qLike or c.cu_short_name like @qLike or c.cu_name like @qLike
                order by h.sh_no desc";
        return c.QueryAsync(sql, new { qLike = $"%{q}%" });
    }

    protected override Task<dynamic?> ExecGetHeaderAsync(IDbConnection c, string key)
        => c.QueryFirstOrDefaultAsync(@"
            select h.sh_no, h.sh_cust, c.cu_short_name, h.sh_type, h.sh_state, h.sh_date,
                   h.creator, h.create_date, h.update_date
            from so_h h left join customer c on c.cu_code=h.sh_cust
            where h.sh_no=@key", new { key });

    protected override Task<IEnumerable<dynamic>> ExecGetLinesAsync(IDbConnection c, string key)
        => c.QueryAsync(@"
            select l.sl_srno, l.sl_partno, p.pt_desc, p.pt_unit,
                   l.sl_qty, l.sl_price, l.sl_duedate, l.sl_po, l.sl_custptno, l.sl_rmk, l.sl_no
            from so_l l left join part p on p.pt_no=l.sl_partno
            where l.sl_no=@key order by l.sl_srno", new { key });
}
