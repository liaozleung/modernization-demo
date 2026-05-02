using System.Data;
using Dapper;

namespace LeungyouErp.Api.Data;

/// <summary>
/// Entity config for the `customer` master table. Mirrors the field set
/// observed in FORMS\customer.SCT (vcustomer.cu_*).
/// </summary>
public abstract class CustomerRepoBase(IDbFactory f) : MasterRepoBase(f), ICustomerRepository
{
    protected override string Table      => "customer";
    protected override string PrimaryKey => "cu_code";
    protected override string[] StrFields =>
        ["cu_code","cu_name","cu_short_name","cu_add","cu_phone","cu_dirphone",
         "cu_fax","cu_contact","cu_currency","cu_payment","cu_term","cu_supportor"];
    protected override string[] NumFields => ["cu_tax"];
}

/// <summary>SQL Server impl — reads via the legacy <c>Customer_selection</c> proc.</summary>
public sealed class SqlServerCustomerRepository(IDbFactory f) : CustomerRepoBase(f)
{
    protected override Task<IEnumerable<dynamic>> ExecSearchAsync(IDbConnection c, string? q)
    {
        var any = string.IsNullOrEmpty(q) ? "%" : $"%{q}%";
        return c.QueryAsync(
            "EXEC Customer_selection @CUCODE=@any, @cuname=@any, @salesman='%'", new { any });
    }

    protected override Task<dynamic?> ExecGetByKeyAsync(IDbConnection c, string key)
        => c.QueryFirstOrDefaultAsync(
            "EXEC Customer_selection @CUCODE=@key, @cuname='%', @salesman='%', @ByKeyExactQuery=1",
            new { key });
}

/// <summary>SQLite impl — inline SQL.</summary>
public sealed class SqliteCustomerRepository(IDbFactory f) : CustomerRepoBase(f)
{
    protected override Task<IEnumerable<dynamic>> ExecSearchAsync(IDbConnection c, string? q)
    {
        var sql = string.IsNullOrEmpty(q)
            ? "select * from customer order by cu_code"
            : "select * from customer where cu_code like @qLike or cu_name like @qLike or cu_short_name like @qLike order by cu_code";
        return c.QueryAsync(sql, new { qLike = $"%{q}%" });
    }

    protected override Task<dynamic?> ExecGetByKeyAsync(IDbConnection c, string key)
        => c.QueryFirstOrDefaultAsync("select * from customer where cu_code=@key", new { key });
}
