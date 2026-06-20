using System.Data;
using Dapper;
using LeungyouErp.Api;

namespace LeungyouErp.Api.Data;

/// <summary>
/// Base class for any 1对多 (master/detail) repository. Provides:
///
///   - Transactional save: upsert header + replace-all lines
///   - Refresh-after-write by calling header + line selection procs/SQL
///
/// Concrete subclasses declare table/PK/fields for both header and detail,
/// plus the two read methods (header + lines) which differ per provider.
/// </summary>
public abstract class MultiRepoBase(IDbFactory factory) : IMasterDetailRepository
{
    protected readonly IDbFactory Factory = factory;

    // ---- Header config -------------------------------------------------------
    protected abstract string HTable { get; }
    protected abstract string HKey { get; }
    protected abstract string[] HStrFields { get; }
    protected abstract string[] HNumFields { get; }
    protected virtual   string[] HDateFields => Array.Empty<string>();
    /** Column auto-updated to "now" on every save. Override null to skip. */
    protected virtual   string? UpdateDateColumn => "update_date";

    // ---- Detail config -------------------------------------------------------
    protected abstract string LTable { get; }
    /** Detail column that holds the FK back to the header PK (e.g. bom_l.bl_pptno). */
    protected abstract string LParentRef { get; }
    /** Detail "line number" column used to order lines (e.g. bl_srno, sl_srno). */
    protected abstract string LSrNo { get; }
    protected abstract string[] LStrFields { get; }
    protected abstract string[] LNumFields { get; }
    protected virtual   string[] LDateFields => Array.Empty<string>();

    // ---- Read methods (provider-specific) ------------------------------------
    protected abstract Task<IEnumerable<dynamic>> ExecSearchHeadersAsync(IDbConnection c, string? q);
    protected abstract Task<dynamic?>             ExecGetHeaderAsync(IDbConnection c, string key);
    protected abstract Task<IEnumerable<dynamic>> ExecGetLinesAsync(IDbConnection c, string key);

    public async Task<IEnumerable<dynamic>> SearchHeadersAsync(string? q)
    {
        using var c = Factory.Open();
        return await ExecSearchHeadersAsync(c, q);
    }

    public async Task<AggregateView?> GetWithLinesAsync(string key)
    {
        using var c = Factory.Open();
        var h = await ExecGetHeaderAsync(c, key);
        if (h is null) return null;
        var l = await ExecGetLinesAsync(c, key);
        return new AggregateView(h, l);
    }

    public async Task<AggregateView> SaveAsync(
        string key,
        IDictionary<string, object?> headerRaw,
        IEnumerable<IDictionary<string, object?>> linesRaw)
    {
        using var conn = Factory.Open();
        using var tx = conn.BeginTransaction();
        try
        {
            // ---- header upsert -------------------------------------------------
            var hRow = NormalizeHeader(headerRaw);
            hRow[HKey] = key;

            var exists = await conn.ExecuteScalarAsync<int>(
                $"SELECT COUNT(1) FROM {HTable} WHERE {HKey}=@{HKey}", hRow, tx);

            if (exists == 0)
            {
                var cols = string.Join(", ", HAllFields);
                var vals = string.Join(", ", HAllFields.Select(f => "@" + f));
                // create_date / update_date come from table DEFAULTs on insert.
                await conn.ExecuteAsync(
                    $"INSERT INTO {HTable} ({cols}) VALUES ({vals})", hRow, tx);
            }
            else
            {
                var setClause = string.Join(", ",
                    HAllFields.Where(f => f != HKey).Select(f => $"{f}=@{f}"));
                if (UpdateDateColumn is { } col) setClause += $", {col}=@__now";
                hRow["__now"] = DateTime.UtcNow;
                await conn.ExecuteAsync(
                    $"UPDATE {HTable} SET {setClause} WHERE {HKey}=@{HKey}", hRow, tx);
            }

            // ---- delete-all + insert-all lines ---------------------------------
            await conn.ExecuteAsync(
                $"DELETE FROM {LTable} WHERE {LParentRef}=@key", new { key }, tx);

            int srno = 1;
            var lAll = LAllFields.ToList();
            var lCols = string.Join(", ", lAll);
            var lVals = string.Join(", ", lAll.Select(f => "@" + f));
            foreach (var raw in linesRaw)
            {
                var lRow = NormalizeLine(raw);
                lRow[LParentRef] = key;
                lRow[LSrNo] = JsonHelpers.AsInt(raw.TryGetValue(LSrNo, out var snv) ? snv : null) ?? srno;
                await conn.ExecuteAsync($"INSERT INTO {LTable} ({lCols}) VALUES ({lVals})", lRow, tx);
                srno++;
            }

            tx.Commit();
        }
        catch
        {
            tx.Rollback();
            throw;
        }

        // refresh via the read procs/SQL (matches VFP's UpdateCmdRefreshCmd)
        using var c = Factory.Open();
        return new AggregateView(
            await ExecGetHeaderAsync(c, key) ?? throw new InvalidOperationException("header missing after save"),
            await ExecGetLinesAsync(c, key));
    }

    public async Task<int> DeleteAsync(string key)
    {
        using var conn = Factory.Open();
        using var tx = conn.BeginTransaction();
        await conn.ExecuteAsync($"DELETE FROM {LTable} WHERE {LParentRef}=@key", new { key }, tx);
        var n = await conn.ExecuteAsync($"DELETE FROM {HTable} WHERE {HKey}=@key", new { key }, tx);
        tx.Commit();
        return n;
    }

    // ---- Normalize -----------------------------------------------------------
    protected virtual Dictionary<string, object?> NormalizeHeader(IDictionary<string, object?> raw)
        => Normalize(raw, HStrFields, HNumFields, HDateFields);

    protected virtual Dictionary<string, object?> NormalizeLine(IDictionary<string, object?> raw)
        => Normalize(raw, LStrFields, LNumFields, LDateFields);

    private static Dictionary<string, object?> Normalize(
        IDictionary<string, object?> raw, string[] strs, string[] nums, string[] dates)
    {
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var k in strs)  dict[k] = JsonHelpers.AsString(raw.TryGetValue(k, out var sv) ? sv : null)  ?? "";
        foreach (var k in nums)  dict[k] = JsonHelpers.AsDecimal(raw.TryGetValue(k, out var nv) ? nv : null) ?? 0m;
        foreach (var k in dates) dict[k] = JsonHelpers.AsString(raw.TryGetValue(k, out var dv) ? dv : null);
        return dict;
    }

    private IEnumerable<string> HAllFields => HStrFields.Concat(HNumFields).Concat(HDateFields);
    // Detail INSERT always includes parent-FK + line-no; subclass declares the rest.
    private IEnumerable<string> LAllFields =>
        new[] { LParentRef, LSrNo }
            .Concat(LStrFields).Concat(LNumFields).Concat(LDateFields)
            .Distinct();
}
