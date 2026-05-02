using System.Data;
using Microsoft.Data.Sqlite;
using Microsoft.Data.SqlClient;

namespace LeungyouErp.Api.Data;

public interface IDbFactory
{
    IDbConnection Open();
    string Provider { get; }
}

public sealed class SqliteDbFactory(string connStr) : IDbFactory
{
    public string Provider => "Sqlite";
    public IDbConnection Open()
    {
        var c = new SqliteConnection(connStr);
        c.Open();
        return c;
    }
}

public sealed class SqlServerDbFactory(string connStr) : IDbFactory
{
    public string Provider => "SqlServer";
    public IDbConnection Open()
    {
        var c = new SqlConnection(connStr);
        c.Open();
        return c;
    }
}

public static class DbInitializer
{
    public static async Task EnsureCreatedAsync(IServiceProvider sp)
    {
        var factory = sp.GetRequiredService<IDbFactory>();
        if (factory.Provider != "Sqlite") return;

        var sqlPath = Path.Combine(AppContext.BaseDirectory, "Sql", "init.sql");
        if (!File.Exists(sqlPath)) return;

        var sql = await File.ReadAllTextAsync(sqlPath);
        using var conn = factory.Open();
        using var cmd = conn.CreateCommand();
        cmd.CommandText = sql;
        cmd.ExecuteNonQuery();
    }
}
