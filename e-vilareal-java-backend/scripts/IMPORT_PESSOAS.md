# Importação rápida — Cadastro Pessoas (.xls)

Mesmo formato de planilha (cabeçalho linha 9, dados a partir da linha 11). Para **novas linhas** na mesma folha: basta voltar a correr o import; o que já existe na base (mesmo **ID** ou mesmo **CPF/CNPJ**) é ignorado.

## Configuração única (próximas vezes mais rápidas)

1. No backend, copie o exemplo e edite o caminho da planilha:
   ```bash
   cd e-vilareal-java-backend
   cp scripts/import-pessoas.local.env.example scripts/import-pessoas.local.env
   ```
2. Abra `scripts/import-pessoas.local.env` e ajuste `PLANILHA=` para o caminho absoluto do seu `.xls`.

## Comandos

**Só carregar config + correr** (usa `PLANILHA` do ficheiro local; não precisa de repetir o path):

```bash
cd e-vilareal-java-backend
./scripts/run-import-pessoas.sh
```

**Teste rápido** (dry-run, primeiras 50 linhas elegíveis — já é o padrão se `import-pessoas.local.env` tiver `DRY_RUN=true` e `LIMIT=50`):

```bash
./scripts/run-import-pessoas.sh
```

**Importação real de tudo o que for novo** (grava na base):

```bash
DRY_RUN=false LIMIT=0 ./scripts/run-import-pessoas.sh
```

**Ainda pode passar outro ficheiro** (ignora o `PLANILHA` do `.local.env` para essa execução):

```bash
./scripts/run-import-pessoas.sh "/outro/caminho/planilha.xls"
```

## Requisitos

- MySQL acessível (como no `application-dev.properties`).
- Pode manter a **API normal na porta 8080**; o perfil `import-pessoas` **não** abre servidor HTTP.

## Relatório

- CSV por defeito: `e-vilareal-java-backend/import-pessoas-report.csv` (ou o caminho em `VILAREAL_IMPORT_PESSOAS_REPORT_PATH` no `.local.env`).
- Colunas: `excel_row`, `planilha_id`, `tipo` (SKIP / ADJUST / ERROR), `mensagem`.

## Reimportar a mesma planilha com dados novos

- **Novos IDs** na coluna A + CPF/CNPJ novo → inseridos.
- **ID já na tabela `pessoa`** → linha ignorada (SKIP).
- **CPF já na base** (outro ID) → ignorada.
- **E-mail duplicado** na planilha ou já existente → grava-se `email` NULL nessa linha (ver relatório ADJUST).

Garanta que os **novos** registos na planilha têm **IDs únicos** e alinhados com a numeração do escritório (evita colisão com o que já importou).

## Não usar

Argumentos Maven com **vírgulas** e path com **espaços** numa única string (`enabled=true,--path=...`) — use sempre este script ou variáveis `VILAREAL_IMPORT_PESSOAS_*`.
