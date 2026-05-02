using Dapper;
using LeungyouErp.Api.Data;

namespace LeungyouErp.Api.Endpoints;

public static class PartEndpoints
{
    public static void MapPartEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/part");

        g.MapGet("/", async (string? q, IDbFactory f) =>
        {
            using var c = f.Open();
            var sql = string.IsNullOrWhiteSpace(q)
                ? "select * from part order by pt_no"
                : "select * from part where pt_no like @q or pt_desc like @q order by pt_no";
            var rows = await c.QueryAsync(sql, new { q = $"%{q}%" });
            return Results.Ok(rows);
        });

        g.MapGet("/{ptNo}", async (string ptNo, IDbFactory f) =>
        {
            using var c = f.Open();
            var row = await c.QuerySingleOrDefaultAsync(
                "select * from part where pt_no=@ptNo", new { ptNo });
            return row is null ? Results.NotFound() : Results.Ok(row);
        });

        g.MapPost("/", async (Dictionary<string, object?> body, IDbFactory f) =>
        {
            using var c = f.Open();
            await c.ExecuteAsync(@"
                insert into part (pt_no, pt_desc, pt_spec, pt_unit, pt_type, pt_category,
                                  pt_weight, safe_stock, pt_drawno, pt_rmk)
                values (@pt_no, @pt_desc, @pt_spec, @pt_unit, @pt_type, @pt_category,
                        @pt_weight, @safe_stock, @pt_drawno, @pt_rmk)", Normalize(body));
            return Results.Created($"/api/part/{body["pt_no"]}", body);
        });

        g.MapPut("/{ptNo}", async (string ptNo, Dictionary<string, object?> body, IDbFactory f) =>
        {
            using var c = f.Open();
            body["pt_no"] = ptNo;
            var n = await c.ExecuteAsync(@"
                update part set pt_desc=@pt_desc, pt_spec=@pt_spec, pt_unit=@pt_unit,
                                pt_type=@pt_type, pt_category=@pt_category, pt_weight=@pt_weight,
                                safe_stock=@safe_stock, pt_drawno=@pt_drawno, pt_rmk=@pt_rmk
                where pt_no=@pt_no", Normalize(body));
            return n == 0 ? Results.NotFound() : Results.NoContent();
        });

        g.MapDelete("/{ptNo}", async (string ptNo, IDbFactory f) =>
        {
            using var c = f.Open();
            var n = await c.ExecuteAsync("delete from part where pt_no=@ptNo", new { ptNo });
            return n == 0 ? Results.NotFound() : Results.NoContent();
        });
    }

    // Frontend posts whatever the schema declares. Coerce JsonElement values
    // and supply defaults so Dapper can bind the named parameters.
    private static Dictionary<string, object?> Normalize(Dictionary<string, object?> body)
    {
        string[] strFields = ["pt_no","pt_desc","pt_spec","pt_unit","pt_type","pt_category","pt_drawno","pt_rmk"];
        string[] numFields = ["pt_weight","safe_stock"];
        var dict = new Dictionary<string, object?>(StringComparer.OrdinalIgnoreCase);
        foreach (var k in strFields) dict[k] = JsonHelpers.AsString(body.GetValueOrDefault(k)) ?? "";
        foreach (var k in numFields) dict[k] = JsonHelpers.AsDecimal(body.GetValueOrDefault(k)) ?? 0m;
        return dict;
    }
}
