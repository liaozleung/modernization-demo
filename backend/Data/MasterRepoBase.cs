using System.Data;
using Dapper;
using LeungyouErp.Api;

namespace LeungyouErp.Api.Data;

/// <summary>
/// Base class for any 1对1 (single-record) repository. Provides the shared
/// orchestration:
///
///   - Normalize JSON body → CLR types Dapper can bind
///   - Build INSERT/UPDATE/DELETE SQL from the entity's column list
///   - Refresh-after-write by calling the entity's selection proc/SQL
///
/// Concrete subclasses (`SqlServerPartRepository`, `SqliteCustomerRepository`,
/// ...) only need to declare the entity's table/PK/fields and implement the
/// two read methods (which differ per provider — proc vs inline SQL).
/// </summary>
public abstract class MasterRepoBase(IDbFactory factory) : IMasterRepository
{
    protected readonly IDbFactory Factory = factory;

    protected abstract string Table { get; }
    protected abstract string PrimaryKey { get; }
    protected abstract string[] StrFields { get; }
    protected abstract string[] NumFields { get; }
    protected virtual   string[] DateFields => Array.Empty<string>();

    protected abstract Task<IEnumerable<dynamic>> ExecSearchAsync(IDbConnection c, string? q);
    protected abstract Task<dynamic?>             ExecGetByKeyAsync(IDbConnection c, string key);

    public async Task<IEnumerable<dynamic>> SearchAsync(string? q)
    {
        using var c = Factory.Open();
        return await ExecSearchAsync(c, q);
    }

    public async Task<dynamic?> GetByKeyAsync(string key)
    {
        using var c = Factory.Open();
        return await ExecGetByKeyAsync(c, key);
    }

    public async Task<dynamic?> InsertAsync(IDictionary<string, object?> rawBody)
    {
        var row = Normalize(rawBody);
        var cols = string.Join(", ", AllFields);
        var vals = string.Join(", ", AllFields.Select(f => "@" + f));
        using var c = Factory.Open();
        await c.ExecuteAsync($"INSERT INTO {Table} ({cols}) VALUES ({vals})", row);
        return await ExecGetByKeyAsync(c, (string)row[PrimaryKey]!);
    }

    public async Task<dynamic?> UpdateAsync(string key, IDictionary<string, object?> rawBody)
    {
        var row = Normalize(rawBody);
        row[PrimaryKey] = key;
        var setClause = string.Join(", ",
            AllFields.Where(f => f != PrimaryKey).Select(f => $"{f}=@{f}"));
        using var c = Factory.Open();
        var n = await c.ExecuteAsync(
            $"UPDATE {Table} SET {setClause} WHERE {PrimaryKey}=@{PrimaryKey}", row);
        return n == 0 ? null : await ExecGetByKeyAsync(c, key);
    }

    public async Task<int> DeleteAsync(string key)
    {
        using var c = Factory.Open();
        return await c.ExecuteAsync(
            $"DELETE FROM {Table} WHERE {PrimaryKey}=@key", new { key });
    }

    protected virtual Dictionary<string, object?> Normalize(IDictionary<string, object?> raw)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var k in StrFields)  dict[k] = JsonHelpers.AsString(raw.GetValueOrDefault(k))  ?? "";
        foreach (var k in NumFields)  dict[k] = JsonHelpers.AsDecimal(raw.GetValueOrDefault(k)) ?? 0m;
        foreach (var k in DateFields) dict[k] = JsonHelpers.AsString(raw.GetValueOrDefault(k));   // ISO string; let provider convert
        return dict;
    }

    private IEnumerable<string> AllFields => StrFields.Concat(NumFields).Concat(DateFields);
}
