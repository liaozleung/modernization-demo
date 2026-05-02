using Dapper;
using LeungyouErp.Api.Data;

namespace LeungyouErp.Api.Endpoints;

public static class BomEndpoints
{
    public static void MapBomEndpoints(this IEndpointRouteBuilder app)
    {
        var g = app.MapGroup("/api/bom");

        // List headers (joined with part for description display in the grid)
        g.MapGet("/", async (string? q, IDbFactory f) =>
        {
            using var c = f.Open();
            var sql = string.IsNullOrWhiteSpace(q)
                ? @"select h.bh_ptno, h.bh_ver, h.bh_dept, h.create_date, h.update_date,
                           p.pt_desc, p.pt_spec, p.pt_unit
                    from bom_h h left join part p on p.pt_no=h.bh_ptno
                    order by h.bh_ptno"
                : @"select h.bh_ptno, h.bh_ver, h.bh_dept, h.create_date, h.update_date,
                           p.pt_desc, p.pt_spec, p.pt_unit
                    from bom_h h left join part p on p.pt_no=h.bh_ptno
                    where h.bh_ptno like @q or p.pt_desc like @q
                    order by h.bh_ptno";
            var rows = await c.QueryAsync(sql, new { q = $"%{q}%" });
            return Results.Ok(rows);
        });

        // Full master+detail load for a given header id
        g.MapGet("/{bhPtno}", async (string bhPtno, IDbFactory f) =>
        {
            using var c = f.Open();
            var header = await c.QuerySingleOrDefaultAsync(@"
                select h.bh_ptno, h.bh_ver, h.bh_dept, h.create_date, h.update_date,
                       p.pt_desc, p.pt_spec, p.pt_unit
                from bom_h h left join part p on p.pt_no=h.bh_ptno
                where h.bh_ptno=@bhPtno", new { bhPtno });
            if (header is null) return Results.NotFound();

            var lines = await c.QueryAsync(@"
                select bl_pptno, bl_srno, bl_ptno, bl_qty, bl_rate, bl_loca
                from bom_l where bl_pptno=@bhPtno order by bl_srno", new { bhPtno });

            return Results.Ok(new { header, lines });
        });

        // Save = insert-or-update header + replace-all lines (transactional).
        // The entire master+detail aggregate is sent up as one payload — same
        // mental model as the VFP form's "save" button.
        g.MapPut("/{bhPtno}", async (string bhPtno, BomSaveDto dto, IDbFactory f) =>
        {
            using var conn = f.Open();
            using var tx = conn.BeginTransaction();
            try
            {
                var header = JsonHelpers.AsDict(dto.Header);
                header["bh_ptno"] = bhPtno;
                var hver  = JsonHelpers.AsString(header.GetValueOrDefault("bh_ver"))  ?? "A";
                var hdept = JsonHelpers.AsString(header.GetValueOrDefault("bh_dept")) ?? "";

                var exists = await conn.ExecuteScalarAsync<long>(
                    "select count(1) from bom_h where bh_ptno=@bhPtno",
                    new { bhPtno }, tx);

                var now = DateTime.UtcNow;
                if (exists == 0)
                    await conn.ExecuteAsync(
                        @"insert into bom_h (bh_ptno, bh_ver, bh_dept, create_date, update_date)
                          values (@bh_ptno, @bh_ver, @bh_dept, @now, @now)",
                        new { bh_ptno = bhPtno, bh_ver = hver, bh_dept = hdept, now }, tx);
                else
                    await conn.ExecuteAsync(
                        @"update bom_h set bh_ver=@bh_ver, bh_dept=@bh_dept, update_date=@now
                          where bh_ptno=@bh_ptno",
                        new { bh_ptno = bhPtno, bh_ver = hver, bh_dept = hdept, now }, tx);

                await conn.ExecuteAsync(
                    "delete from bom_l where bl_pptno=@bhPtno", new { bhPtno }, tx);

                int srno = 1;
                foreach (var raw in dto.Lines ?? [])
                {
                    var line = JsonHelpers.AsDict(raw);
                    await conn.ExecuteAsync(@"
                        insert into bom_l (bl_pptno, bl_srno, bl_ptno, bl_qty, bl_rate, bl_loca)
                        values (@bl_pptno, @bl_srno, @bl_ptno, @bl_qty, @bl_rate, @bl_loca)",
                        new
                        {
                            bl_pptno = bhPtno,
                            bl_srno  = JsonHelpers.AsInt(line.GetValueOrDefault("bl_srno")) ?? srno,
                            bl_ptno  = JsonHelpers.AsString(line.GetValueOrDefault("bl_ptno")) ?? "",
                            bl_qty   = JsonHelpers.AsDecimal(line.GetValueOrDefault("bl_qty"))  ?? 1m,
                            bl_rate  = JsonHelpers.AsDecimal(line.GetValueOrDefault("bl_rate")) ?? 0m,
                            bl_loca  = JsonHelpers.AsString(line.GetValueOrDefault("bl_loca")) ?? ""
                        }, tx);
                    srno++;
                }

                tx.Commit();
                return Results.NoContent();
            }
            catch
            {
                tx.Rollback();
                throw;
            }
        });

        g.MapDelete("/{bhPtno}", async (string bhPtno, IDbFactory f) =>
        {
            using var conn = f.Open();
            using var tx = conn.BeginTransaction();
            await conn.ExecuteAsync("delete from bom_l where bl_pptno=@bhPtno", new { bhPtno }, tx);
            var n = await conn.ExecuteAsync("delete from bom_h where bh_ptno=@bhPtno", new { bhPtno }, tx);
            tx.Commit();
            return n == 0 ? Results.NotFound() : Results.NoContent();
        });
    }
}

public sealed record BomSaveDto(Dictionary<string, object?> Header, List<Dictionary<string, object?>>? Lines);
