using LeungyouErp.Api.Data;
using LeungyouErp.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSingleton<IDbFactory>(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var provider = cfg["Database:Provider"] ?? "Sqlite";
    var connStr = cfg.GetConnectionString("Default")
                  ?? throw new InvalidOperationException("ConnectionStrings:Default not set");
    return provider.Equals("SqlServer", StringComparison.OrdinalIgnoreCase)
        ? new SqlServerDbFactory(connStr)
        : new SqliteDbFactory(connStr);
});

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();

app.UseCors();

await DbInitializer.EnsureCreatedAsync(app.Services);

app.MapSchemaEndpoints();
app.MapPartEndpoints();
app.MapBomEndpoints();

app.MapGet("/", () => Results.Redirect("/api/schema/part"));

app.Run();
