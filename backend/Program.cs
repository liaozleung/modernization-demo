using LeungyouErp.Api.Data;
using LeungyouErp.Api.Endpoints;

var builder = WebApplication.CreateBuilder(args);

// --- DB factory --------------------------------------------------------------
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

// --- Repositories — provider-specific impls per entity. ----------------------
// Adding a new screen later = drop in `XxxRepository.cs` (3 small classes:
// XxxRepoBase + SqlServerXxxRepository + SqliteXxxRepository) and one Pick<>
// line below.
static T Pick<T>(IServiceProvider sp, Func<IDbFactory, T> sql, Func<IDbFactory, T> lite) where T : class
{
    var f = sp.GetRequiredService<IDbFactory>();
    return f.Provider == "SqlServer" ? sql(f) : lite(f);
}

builder.Services.AddScoped<IPartRepository>(sp =>
    Pick<IPartRepository>(sp, f => new SqlServerPartRepository(f), f => new SqlitePartRepository(f)));
builder.Services.AddScoped<ICustomerRepository>(sp =>
    Pick<ICustomerRepository>(sp, f => new SqlServerCustomerRepository(f), f => new SqliteCustomerRepository(f)));
builder.Services.AddScoped<IBomRepository>(sp =>
    Pick<IBomRepository>(sp, f => new SqlServerBomRepository(f), f => new SqliteBomRepository(f)));
builder.Services.AddScoped<ISoRepository>(sp =>
    Pick<ISoRepository>(sp, f => new SqlServerSoRepository(f), f => new SqliteSoRepository(f)));

builder.Services.AddCors(o => o.AddDefaultPolicy(p =>
    p.WithOrigins("http://localhost:5173").AllowAnyHeader().AllowAnyMethod()));

var app = builder.Build();
app.UseCors();

await DbInitializer.EnsureCreatedAsync(app.Services);

// --- Endpoints — one line per screen. ----------------------------------------
app.MapSchemaEndpoints();
app.MapMainCrud<IPartRepository>("/api/part");
app.MapMainCrud<ICustomerRepository>("/api/customer");
app.MapMultiCrud<IBomRepository>("/api/bom");
app.MapMultiCrud<ISoRepository>("/api/so");

app.MapGet("/", () => Results.Redirect("/api/schema/part"));

app.Run();
