# Passo a passo — Integrações (lab) DataJud · TJGO

A tela **Integrações (lab) → DataJud (CNJ) · TJGO** no React consulta a **API pública DataJud (CNJ)** para processos do **Tribunal de Justiça de Goiás** (índice `api_publica_tjgo`). Não exige a API .NET para este fluxo.

**Glossário de dados** (estrutura `_source`, tipos, `id`, `numeroProcesso`, `movimentos`, controlo `@timestamp`, etc.): [Datajud-Wiki — Glossário](https://datajud-wiki.cnj.jus.br/api-publica/glossario/). No código React: `e-vilareal-react-web/src/data/datajudGlossario.js` (`DATAJUD_WIKI_GLOSSARIO_URL`, `DATAJUD_CAMPO`).

**MTD 1.2 (CNJ):** boletim de ocorrência, inquérito policial, `parte.prioridade` (ex. tipo `ID` idoso + `dataConcessao`) e `racaCor` nas pessoas — constantes e normalização em `e-vilareal-react-web/src/data/datajudMtd12.js`; o hit normalizado em `datajudApiClient.js` expõe `numerosBoletimOcorrencia`, `numerosInqueritoPolicial` e `partes` quando o índice os tiver.

**Painel de estatísticas / parametrização (dez/2025+):** ficheiros como *Situações Datamart*, *Parametrização classes*, *Indicadores e dicionário*, boletim de mudanças e guia v3.1 descrevem o **datamart** e regras de situações — ver [Parametrização DataJud](https://www.cnj.jus.br/sistemas/datajud/parametrizacao/). No código: `e-vilareal-react-web/src/data/datajudParametrizacaoCnj.js` (`DATAJUD_URL_PARAMETRIZACAO`, exemplos do boletim, `datajudBoletimLegendaMovimento` para cruzar códigos TPU do último movimento).

## 1. Chave DataJud e proxy (React)

1. No **`e-vilareal-react-web/.env.development`** (ou `.env.homolog`), garantir a chave usada pelo proxy Vite (formato oficial: `Authorization: APIKey <chave>` — [wiki Acesso](https://datajud-wiki.cnj.jus.br/api-publica/acesso/)):
   ```env
   DATAJUD_API_KEY=sua_chave_api_publica
   ```
   Preferir **`DATAJUD_API_KEY`**: não é embutida no bundle do browser. Alternativa: `VITE_DATAJUD_API_KEY` (só se precisar da chave no cliente, p.ex. URL absoluta sem proxy).
   O `vite.config.js` injeta o cabeçalho nos pedidos a `https://api-publica.datajud.cnj.jus.br` via prefixo **`/datajud-proxy`**.
2. Ativar o menu / tela lab (nome histórico da variável):
   ```env
   VITE_SHOW_TRIBUNAL_SCRAPER_LAB=true
   ```
3. Reiniciar o Vite após alterar `.env`.

**Porta ocupada (ex. 5174):** use o URL que o Vite imprimir; o proxy DataJud continua na mesma origem.

**Pesquisa por classe + órgão (wiki Ex. 2):** `datajudCorpoPesquisaClasseEOrgaoJulgador(codigoClasse, codigoOrgaoJulgador, opts?)` monta o `bool.must` com `match` em `classe.codigo` e `orgaoJulgador.codigo`; o alias do tribunal (`api_publica_tjgo`, etc.) vai só no URL do `_search`.

**Paginação (wiki Ex. 3 — `sort` + `search_after`):** o lab consulta **um** CNJ (poucos hits). Para listagens grandes no mesmo índice, use em `e-vilareal-react-web/src/data/datajudApiClient.js` as exportações `DATAJUD_SORT_TIMESTAMP_ASC`, `datajudCorpoComPaginacaoTimestamp` e `extrairSortUltimoHitParaSearchAfter` (mesmo padrão da documentação CNJ: `size` até 10000, mesmo `sort` em todas as páginas, `search_after` com o array `sort` do último hit da página anterior).

## 2. Testar no browser

1. `npm run dev` em `e-vilareal-react-web`.
2. Abrir **Integrações (lab) → DataJud (CNJ) · TJGO**.
3. Colar um CNJ válido de processo **TJGO** (deve conter o segmento **`.8.09.`**).
4. **Consultar DataJud** — deve aparecer metadados ou mensagem «não encontrado» se o índice não tiver o processo.

## 3. Permissões no menu

- Em **Usuários → permissões**, o módulo continua com o id **`integracoes/scraper-lab`** (compatibilidade); o grupo é **`integracoes-grupo`**.

## 4. Produção / build estático

- O proxy do Vite **não existe** no `npm run build` servido por ficheiros estáticos. Configure no gateway **o mesmo tipo de proxy** para `/datajud-proxy` ou defina **`VITE_DATAJUD_BASE`** apontando para um backend que faça o forward com a chave.
- Só mantenha `VITE_SHOW_TRIBUNAL_SCRAPER_LAB=true` em produção se quiser esta tela acessível.

## 5. Alargar a outros tribunais

1. Mapear TR no ficheiro **`e-vilareal-react-web/src/data/publicacoesCnjTribunal.js`** (`TJ_TR_PARA_API` e índice `api_publica_tj…`).
2. Na tela lab (`IntegracoesTribunalScraperLab.jsx`), alargar a validação CNJ (hoje só **`.8.09.`** / TJGO) e o copy.
3. Opcional: duplicar entrada no menu (`navConfig.js`) por tribunal quando fizer sentido.

---

## Apêndice — API .NET `e-vilareal-tribunal-scraper` (scraping / OAB)

Projeto **separado** para experimentação com HTML/Puppeteer; **não** é necessário para o lab DataJud TJGO.

```bash
cd e-vilareal-tribunal-scraper
dotnet run --project src/Vilareal.TribunalScraper.Api/Vilareal.TribunalScraper.Api.csproj
```

Variáveis opcionais no front para esse serviço: `VITE_TRIBUNAL_SCRAPER_DEV_PROXY_TARGET`, `VITE_TRIBUNAL_SCRAPER_URL` (ver `tribunalScraperApiService.js`).

## Checklist rápido (DataJud TJGO)

| Passo | Você faz |
|--------|-----------|
| `DATAJUD_API_KEY` (ou `VITE_DATAJUD_API_KEY`) + proxy | Sim (dev) |
| `VITE_SHOW_TRIBUNAL_SCRAPER_LAB=true` | Sim |
| Reiniciar Vite | Sim |
| Permissão `integracoes/scraper-lab` | Se necessário |
| Gateway / `VITE_DATAJUD_BASE` em produção | Quando publicar |
