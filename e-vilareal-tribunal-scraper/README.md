# Vilareal — Tribunal Scraper (LINHA 2, isolada)

Solução **.NET 10** (`TargetFramework: net10.0`) com projetos **Core**, **Infrastructure** e testes **xUnit**, conforme o prompt de scraping por OAB (MVP sintético; produção exige URLs reais, conformidade com `robots.txt` e revisão jurídica).

## O que depende de você (checklist)

Veja **[PASSOS_USUARIO.md](./PASSOS_USUARIO.md)** (subir API, variáveis Vite, permissões, produção).

## Pré-requisitos

- [.NET SDK 10](https://dotnet.microsoft.com/download) (ou superior) na máquina — necessário para executar testes; o SDK 10 compila este repo.

## Compilar e testar

```bash
cd /caminho/para/villareal/e-vilareal-tribunal-scraper
dotnet restore
dotnet build
dotnet test
```

## API HTTP (consumo pelo React ou outro cliente)

Subir o host mínimo:

```bash
cd e-vilareal-tribunal-scraper
dotnet run --project src/Vilareal.TribunalScraper.Api/Vilareal.TribunalScraper.Api.csproj
```

Padrão: **http://localhost:5288**

| Método | Rota | Descrição |
|--------|------|-----------|
| `GET` | `/api/scraper` | Metadados e lista de rotas |
| `GET` | `/api/scraper/tribunais` | Tribunais ativos na config |
| `GET` | `/api/scraper/health` | Health por tribunal |
| `POST` | `/api/scraper/busca-advogado` | Corpo JSON: `{ "lawyerName", "oabNumber", "spheres": [] }` |

Exemplo:

```bash
curl -s -X POST http://localhost:5288/api/scraper/busca-advogado \
  -H "Content-Type: application/json" \
  -d '{"lawyerName":"Fulano","oabNumber":"123456/SP","spheres":[]}'
```

CORS liberado para `localhost:5173` e `localhost:3000` (Vite/React comum).

## Integração no host Blazor (biblioteca)

No `Program.cs` do aplicativo web:

```csharp
using Vilareal.Infrastructure.Integrations.TribunalScraper;

builder.Services.AddVilarealTribunalScraper();
```

Garanta que `tribunals-scraping-config.json` seja copiado para o diretório de saída (API e Infrastructure já copiam).

## Menu Blazor

No projeto Blazor, rotas que injetem `ITribunalScraperService` ou chamadas à API acima.

## Troubleshooting

- **`FileNotFoundException` em `tribunals-scraping-config.json`:** confira `CopyToOutputDirectory` e o caminho `AppContext.BaseDirectory`.
- **Puppeteer:** a implementação ativa é `PuppeteerStubService`; habilite PuppeteerSharp numa camada separada após aprovação de dependências e CI.
- **Testes:** fixtures em `tests/.../Fixtures/html` são HTML/JSON **fictícios** para parsing estável, não páginas reais de tribunais.
