using LeungyouErp.Api;

namespace LeungyouErp.Api.Data;

// =============================================================================
// Base contracts every CRUD repository implements. Picked to match the VFP
// data-environment behavior:
//
//   - Search/Get go through the legacy *_selection stored procedures (proc
//     impls live in SQL Server; SQLite impls inline-SQL approximate).
//   - Insert/Update normalize the raw JSON body internally, write to base
//     tables, then re-call the selection proc to return the refreshed row
//     (computed/joined columns included). This is the Insert/UpdateCmdRefreshCmd
//     equivalent — concrete repos own that logic so endpoints stay entity-
//     agnostic.
// =============================================================================

public interface IMasterRepository
{
    Task<IEnumerable<dynamic>> SearchAsync(string? q);
    Task<dynamic?> GetByKeyAsync(string key);
    /** Returns the refreshed row (post-insert SELECT via selection proc). */
    Task<dynamic?> InsertAsync(IDictionary<string, object?> rawBody);
    /** Returns the refreshed row, or null if the key was not found. */
    Task<dynamic?> UpdateAsync(string key, IDictionary<string, object?> rawBody);
    Task<int> DeleteAsync(string key);
}

public interface IMasterDetailRepository
{
    Task<IEnumerable<dynamic>> SearchHeadersAsync(string? q);
    Task<AggregateView?> GetWithLinesAsync(string key);
    /** Transactional upsert of header + replace-all of lines. Returns the
        refreshed aggregate (header + lines) via the selection procs. */
    Task<AggregateView> SaveAsync(
        string key,
        IDictionary<string, object?> headerRaw,
        IEnumerable<IDictionary<string, object?>> linesRaw);
    Task<int> DeleteAsync(string key);
}

public sealed record AggregateView(dynamic Header, IEnumerable<dynamic> Lines);

// Marker interfaces — let DI distinguish between repositories of different
// entities (each registered as its own concrete service).
public interface IPartRepository     : IMasterRepository {}
public interface ICustomerRepository : IMasterRepository {}
public interface IBomRepository      : IMasterDetailRepository {}
public interface ISoRepository       : IMasterDetailRepository {}
