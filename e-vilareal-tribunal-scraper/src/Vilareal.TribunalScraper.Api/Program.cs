using System.Text.Json.Serialization;
using Vilareal.Core.Integrations.TribunalScraper.Abstractions;
using Vilareal.Core.Integrations.TribunalScraper.Exceptions;
using Vilareal.Core.Integrations.TribunalScraper.Models;
using Vilareal.Core.Integrations.TribunalScraper.Monitoring;
using Vilareal.Infrastructure.Integrations.TribunalScraper;

var builder = WebApplication.CreateBuilder(args);

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddVilarealTribunalScraper();

builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",
                "http://127.0.0.1:5173",
                "http://localhost:5174",
                "http://127.0.0.1:5174",
                "http://localhost:3000",
                "http://127.0.0.1:3000")
            .AllowAnyHeader()
            .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();

app.MapGet("/", () => Results.Redirect("/api/scraper"));

app.MapGet("/api/scraper", () => Results.Ok(new
{
    service = "Vilareal Tribunal Scraper API",
    version = "1.0",
    endpoints = new[] { "POST /api/scraper/busca-advogado", "GET /api/scraper/tribunais", "GET /api/scraper/health" },
}));

app.MapGet("/api/scraper/tribunais", (ITribunalScraperFactory factory) =>
{
    var list = factory.GetAvailableTribunals()
        .Select(t => new { t.Code, t.Name, t.Sphere, t.Family, t.Active })
        .ToList();
    return Results.Ok(list);
});

app.MapGet("/api/scraper/health", async (TribunalHealthMonitor monitor, CancellationToken ct) =>
{
    var checks = await monitor.GetAllHealthAsync(ct);
    return Results.Ok(checks);
});

app.MapPost("/api/scraper/busca-advogado", async (
    LawyerSearchRequest body,
    ITribunalScraperService scraper,
    CancellationToken ct) =>
{
    try
    {
        var processos = await scraper.SearchByLawyerAsync(body, ct);
        return Results.Ok(new BuscaAdvogadoResponse
        {
            Count = processos.Count,
            Processos = processos.ToList(),
        });
    }
    catch (InvalidOabNumberException ex)
    {
        return Results.BadRequest(new ErrorResponse { Error = "oab_invalida", Message = ex.Motivo });
    }
});

app.Run();

/// <summary>Envelope de resposta para o front (camelCase via JSON options).</summary>
internal sealed class BuscaAdvogadoResponse
{
    public int Count { get; set; }

    public List<ProcessoScrapedDto> Processos { get; set; } = new();
}

internal sealed class ErrorResponse
{
    public string Error { get; set; } = string.Empty;

    public string Message { get; set; } = string.Empty;
}
