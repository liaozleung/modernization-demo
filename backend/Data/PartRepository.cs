using System.Data;
using Dapper;

namespace LeungyouErp.Api.Data;

/// <summary>Entity config for the `part` master table.</summary>
public abstract class PartRepoBase(IDbFactory f) : MasterRepoBase(f), IPartRepository
{
    protected override string Table      => "part";
    protected override string PrimaryKey => "pt_no";
    protected override string[] StrFields =>
        ["pt_no","pt_desc","pt_spec","pt_unit","pt_type","pt_category","pt_drawno","pt_rmk"];
    protected override string[] NumFields => ["pt_weight","safe_stock"];
}

/// <summary>SQL Server impl — reads via the legacy <c>part_selection</c> proc.</summary>
public sealed class SqlServerPartRepository(IDbFactory f) : PartRepoBase(f)
{
    protected override Task<IEnumerable<dynamic>> ExecSearchAsync(IDbConnection c, string? q)
    {
        var any = string.IsNullOrEmpty(q) ? "%" : $"%{q}%";
        return c.QueryAsync(@"EXEC part_selection
            @ptno=@any, @ptdesc=@any, @ptspec=@any,
            @ptrawmatl='%', @pttx='%', @ptcx='%', @ptyx='%',
            @ptcolor='%', @ptstd='%', @pttype='%', @pcategory='%'", new { any });
    }

    protected override Task<dynamic?> ExecGetByKeyAsync(IDbConnection c, string key)
        => c.QueryFirstOrDefaultAsync(
            "EXEC part_selection @ptno=@key, @ByKeyExactQuery=1", new { key });
}

/// <summary>SQLite impl — dev only, inline SQL (no procs in SQLite).</summary>
public sealed class SqlitePartRepository(IDbFactory f) : PartRepoBase(f)
{
    protected override Task<IEnumerable<dynamic>> ExecSearchAsync(IDbConnection c, string? q)
    {
        var sql = string.IsNullOrEmpty(q)
            ? "select * from part order by pt_no"
            : "select * from part where pt_no like @qLike or pt_desc like @qLike order by pt_no";
        return c.QueryAsync(sql, new { qLike = $"%{q}%" });
    }

    protected override Task<dynamic?> ExecGetByKeyAsync(IDbConnection c, string key)
        => c.QueryFirstOrDefaultAsync("select * from part where pt_no=@key", new { key });
}
