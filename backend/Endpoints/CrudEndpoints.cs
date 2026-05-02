using LeungyouErp.Api;
using LeungyouErp.Api.Data;

namespace LeungyouErp.Api.Endpoints;

/**
 * Generic CRUD endpoint mappers. Adding a new screen is a one-liner in
 * Program.cs:
 *
 *   app.MapMainCrud<IPartRepository>("/api/part");
 *   app.MapMainCrud<ICustomerRepository>("/api/customer");
 *   app.MapMultiCrud<IBomRepository>("/api/bom");
 *   app.MapMultiCrud<ISoRepository>("/api/so");
 *
 * The repos own all entity-specific knowledge (table name, proc name, field
 * normalization, refresh-after-write); the endpoints just route HTTP to repo
 * methods and serialize results.
 */
public static class CrudEndpoints
{
    public static IEndpointRouteBuilder MapMainCrud<TRepo>(
        this IEndpointRouteBuilder app, string path)
        where TRepo : class, IMasterRepository
    {
        var g = app.MapGroup(path);

        g.MapGet("/", async (string? q, TRepo repo) =>
            Results.Ok(await repo.SearchAsync(q)));

        g.MapGet("/{key}", async (string key, TRepo repo) =>
            await repo.GetByKeyAsync(key) is { } row ? Results.Ok(row) : Results.NotFound());

        g.MapPost("/", async (Dictionary<string, object?> body, TRepo repo) =>
        {
            var saved = await repo.InsertAsync(body);
            return Results.Created($"{path}/", saved);
        });

        g.MapPut("/{key}", async (string key, Dictionary<string, object?> body, TRepo repo) =>
            await repo.UpdateAsync(key, body) is { } row ? Results.Ok(row) : Results.NotFound());

        g.MapDelete("/{key}", async (string key, TRepo repo) =>
            await repo.DeleteAsync(key) == 0 ? Results.NotFound() : Results.NoContent());

        return app;
    }

    public static IEndpointRouteBuilder MapMultiCrud<TRepo>(
        this IEndpointRouteBuilder app, string path)
        where TRepo : class, IMasterDetailRepository
    {
        var g = app.MapGroup(path);

        g.MapGet("/", async (string? q, TRepo repo) =>
            Results.Ok(await repo.SearchHeadersAsync(q)));

        g.MapGet("/{key}", async (string key, TRepo repo) =>
            await repo.GetWithLinesAsync(key) is { } v
                ? Results.Ok(new { header = v.Header, lines = v.Lines })
                : Results.NotFound());

        g.MapPut("/{key}", async (string key, AggregateSaveDto dto, TRepo repo) =>
        {
            var headerRaw = JsonHelpers.AsDict(dto.Header);
            var linesRaw  = (dto.Lines ?? []).Select(JsonHelpers.AsDict);
            var v = await repo.SaveAsync(key, headerRaw, linesRaw);
            return Results.Ok(new { header = v.Header, lines = v.Lines });
        });

        g.MapDelete("/{key}", async (string key, TRepo repo) =>
            await repo.DeleteAsync(key) == 0 ? Results.NotFound() : Results.NoContent());

        return app;
    }
}

public sealed record AggregateSaveDto(object Header, List<object>? Lines);
