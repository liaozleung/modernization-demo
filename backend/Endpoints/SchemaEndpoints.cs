using LeungyouErp.Api.Data;
using Dapper;

namespace LeungyouErp.Api.Endpoints;

public static class SchemaEndpoints
{
    public static void MapSchemaEndpoints(this IEndpointRouteBuilder app)
    {
        // GET /api/schema/{name}  -> raw schema JSON from Schemas/<name>.json
        // This is the modern equivalent of the VFP `fields_dict` lookup. In the
        // next phase we move these rows into a SQL table and return them from
        // the DB; the contract stays the same so the frontend doesn't change.
        app.MapGet("/api/schema/{name}", (string name) =>
        {
            var path = Path.Combine(AppContext.BaseDirectory, "Schemas", $"{name}.json");
            if (!File.Exists(path)) return Results.NotFound(new { error = $"schema '{name}' not found" });
            var json = File.ReadAllText(path);
            return Results.Content(json, "application/json");
        });

        // Generic lookup endpoint used by `lookup` typed fields in the schema.
        // Whitelist tables so this isn't a SQL-injection vector.
        app.MapGet("/api/lookup/{table}", async (string table, string? q, IDbFactory factory) =>
        {
            var (selectSql, keyCol, labelCol) = table.ToLowerInvariant() switch
            {
                "part" => ("select pt_no as value, pt_desc as label, pt_spec, pt_unit from part",
                           "pt_no", "pt_desc"),
                "customer" => ("select cu_code as value, cu_short_name as label, cu_name from customer",
                               "cu_code", "cu_short_name"),
                _ => (null!, null!, null!)
            };
            if (selectSql is null) return Results.BadRequest(new { error = $"lookup '{table}' not allowed" });

            using var conn = factory.Open();
            var (top, limit) = factory.Provider == "SqlServer" ? (" top 50", "") : ("", " limit 50");
            // selectSql starts with "select"; inject TOP after it for SQL Server.
            var sel = selectSql.Replace("select ", $"select{top} ");
            var sql = string.IsNullOrWhiteSpace(q)
                ? $"{sel} order by {keyCol}{limit}"
                : $"{sel} where {keyCol} like @q or {labelCol} like @q order by {keyCol}{limit}";
            var rows = await conn.QueryAsync(sql, new { q = $"%{q}%" });
            return Results.Ok(rows);
        });
    }
}
