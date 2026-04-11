/**
 * Cliente da API pública DataJud (CNJ). Camada 2 — não substitui o teor do PDF.
 *
 * Estrutura de `_source` e tipos: glossário oficial CNJ (`DATAJUD_WIKI_GLOSSARIO_URL` em `datajudGlossario.js`).
 * Parametrização do **painel estatístico** (situações datamart, classes, indicadores): `DATAJUD_URL_PARAMETRIZACAO`
 * e `datajudParametrizacaoCnj.js` — não confundir com o contrato técnico do `_search` por tribunal.
 * O endpoint DataJud é Elasticsearch `_search` com **Query DSL** (JSON), não **ES|QL** (linguagem de consulta à parte).
 * Por analogia com a doc. Elastic ES|QL: **filtrar** ≈ correspondência exacta / sem ranking (ex.: `term` em keyword);
 * **pesquisar** ≈ texto analisado e `_score` (ex.: `match`, `query_string`). Para um CNJ concreto o resultado é
 * tipicamente 0 ou 1 documento; usamos `match` alinhado ao tutorial CNJ e `term` como reforço em variantes de campo.
 * @see https://www.elastic.co/guide/en/elasticsearch/reference/current/search-search.html
 * @see https://www.elastic.co/guide/en/elasticsearch/reference/current/esql.html
 *
 * **Async Search (Elastic):** o motor suporta pesquisas longas via submit/get/delete async search; a API pública
 * DataJud documentada pelo CNJ expõe `POST …/_search` síncrono. Este cliente não usa async search (sem endpoint
 * CNJ equivalente documentado); pesquisas pesadas devem usar `search_after`, `size` moderado e eventualmente
 * orquestração no **backend** com timeouts/cancelamento.
 * @see https://www.elastic.co/guide/en/elasticsearch/reference/current/async-search.html
 *
 * **Retrievers (Elastic ≥ 8.14):** o `_search` pode usar uma árvore `retriever` (RRF, kNN, linear, reranking semântico,
 * `collapse`, `aggs`, etc.) em vez do bloco clássico `query`. Os exemplos hands-on na doc. Elastic são tutoriais
 * sobre índices de demonstração — **não** correspondem ao contrato da API pública DataJud (tutorial CNJ: `query`).
 * Este cliente não envia `retriever` (sem documentação CNJ).
 * @see https://www.elastic.co/docs/solutions/search/retrievers-overview
 * @see https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers
 * @see https://www.elastic.co/docs/reference/elasticsearch/rest-apis/retrievers/retrievers-examples
 *
 * **Vários índices / padrões (Elastic):** o `_search` aceita lista separada por vírgulas, wildcards (`my-*`),
 * exclusões e `indices_boost` no corpo. Na **API pública DataJud** o CNJ documenta **um alias por tribunal**
 * por URL (`…/api_publica_tjgo/_search`, etc.); `resolverTribunalDatajudPorCnj` escolhe um único `apiIndex` por CNJ.
 * Cruzar tribunais implica **vários pedidos** (ou alargar o produto no backend se o CNJ expuser outro contrato).
 * @see https://www.elastic.co/docs/reference/elasticsearch/rest-apis/search-multiple-data-streams-indices
 *
 * Em desenvolvimento, use o proxy em `vite.config` (`/datajud-proxy`) e `DATAJUD_API_KEY` ou `VITE_DATAJUD_API_KEY` no .env
 * (preferir `DATAJUD_API_KEY` — não entra no bundle) para injetar `Authorization: APIKey …` no servidor de dev.
 *
 * Em produção, configure o mesmo proxy no gateway ou um endpoint backend.
 */

import { DATAJUD_CAMPO } from './datajudGlossario.js';
import { mtdNormalizarListaString } from './datajudMtd12.js';
import { datajudBoletimLegendaMovimento } from './datajudParametrizacaoCnj.js';
import {
  cnjParaNumeroUnicoVinteDigitos,
  parseSegmentosCnj,
  resolverTribunalDatajudPorCnj,
} from './publicacoesCnjTribunal.js';

/** Uma correspondência por CNJ basta; reduz payload vs. o default ES (10 hits). */
const DATAJUD_CONSULTA_POR_CNJ_SIZE = 1;

/** Índice Elasticsearch DataJud para o Tribunal de Justiça de Goiás (J=8, TR=09). */
export const DATAJUD_API_INDEX_TJGO = 'api_publica_tjgo';

/**
 * True se o CNJ completo for de processo originário no TJGO (justiça estadual, órgão 09).
 * @param {string} cnjNormalizado
 */
export function cnjEhProcessoTjgo(cnjNormalizado) {
  const p = parseSegmentosCnj(cnjNormalizado);
  return Boolean(p && p.segmentoJ === '8' && p.tribunalTR === '09');
}

/** v4: normalização com parametrização painel (boletim) + MTD 1.2. */
const CACHE_PREFIX = 'vilareal.datajud.cache.v4.';
const TTL_MS = 24 * 60 * 60 * 1000;

function cacheGet(key) {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(CACHE_PREFIX + key);
    if (!raw) return null;
    const { t, data } = JSON.parse(raw);
    if (Date.now() - t > TTL_MS) {
      window.localStorage.removeItem(CACHE_PREFIX + key);
      return null;
    }
    return data;
  } catch {
    return null;
  }
}

function cacheSet(key, data) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(CACHE_PREFIX + key, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* ignore */
  }
}

export function getDatajudRequestBase() {
  const b = import.meta.env.VITE_DATAJUD_BASE;
  if (b && String(b).trim()) return String(b).replace(/\/$/, '');
  return '/datajud-proxy';
}

/**
 * Ex. 1 wiki DataJud: `POST …/{api_publica_tribunal}/_search` com
 * `Authorization: APIKey …`, `Content-Type: application/json` e corpo
 * `{ "query": { "match": { "numeroProcesso": "<20 dígitos>" } } }`.
 * O tutorial CNJ não inclui `size`; usamos `size: 1` (menos dados por hit) alinhado à paginação ES.
 * Não forçamos `track_total_hits`: o default Elastic (contagem exacta até 10k hits) chega para 0/1 resultado.
 * @param {string} n20 numeração única sem pontuação
 */
function corpoMatchNumeroProcesso(n20) {
  return {
    size: DATAJUD_CONSULTA_POR_CNJ_SIZE,
    query: { match: { [DATAJUD_CAMPO.numeroProcesso]: n20 } },
  };
}

/**
 * Consulta composta: CNJ formatado, 20 dígitos, term no campo raiz (mapping keyword)
 * e subcampo `.keyword` quando existir.
 */
function corpoPesquisaNumeroProcesso(numeroCnjFormatado) {
  const fmt = String(numeroCnjFormatado ?? '').trim().toUpperCase();
  const n20 = cnjParaNumeroUnicoVinteDigitos(fmt);
  const should = [
    { match: { [DATAJUD_CAMPO.numeroProcesso]: fmt } },
    { term: { [DATAJUD_CAMPO.numeroProcesso]: fmt } },
    { term: { [DATAJUD_CAMPO.numeroProcessoKeyword]: fmt } },
  ];
  if (n20) {
    should.push(
      { match: { [DATAJUD_CAMPO.numeroProcesso]: n20 } },
      { term: { [DATAJUD_CAMPO.numeroProcesso]: n20 } },
      { term: { [DATAJUD_CAMPO.numeroProcessoKeyword]: n20 } },
      {
        query_string: {
          default_field: DATAJUD_CAMPO.numeroProcesso,
          query: n20,
          default_operator: 'AND',
        },
      },
    );
  }
  return {
    size: DATAJUD_CONSULTA_POR_CNJ_SIZE,
    query: {
      bool: {
        should,
        minimum_should_match: 1,
      },
    },
  };
}

/**
 * Ordem: (1) match tutorial 20 dígitos; (2) bool amplo; (3) só CNJ formatado.
 * @param {string} numeroCnjFormatado
 * @returns {Array<{ id: string, body: object }>}
 */
function corposPesquisaEmSequencia(numeroCnjFormatado) {
  const fmt = String(numeroCnjFormatado ?? '').trim().toUpperCase();
  const n20 = cnjParaNumeroUnicoVinteDigitos(fmt);
  const out = [];
  if (n20) {
    out.push({ id: 'match_n20_tutorial', body: corpoMatchNumeroProcesso(n20) });
    out.push({ id: 'bool_should', body: corpoPesquisaNumeroProcesso(fmt) });
  }
  out.push({
    id: 'match_fmt',
    body: {
      size: DATAJUD_CONSULTA_POR_CNJ_SIZE,
      query: { match: { [DATAJUD_CAMPO.numeroProcesso]: fmt } },
    },
  });
  return out;
}

function erroElasticsearchNoJson(json) {
  const e = json?.error;
  if (!e) return null;
  if (typeof e === 'string') return e;
  const reason = e.reason ?? e.type;
  return reason ? String(reason) : JSON.stringify(e).slice(0, 300);
}

function extrairPrimeiroHit(json) {
  const hits = json?.hits?.hits;
  if (!Array.isArray(hits) || hits.length === 0) return null;
  return hits[0];
}

function extrairChavesFonte(src) {
  return src && typeof src === 'object' && !Array.isArray(src) ? Object.keys(src).sort() : [];
}

/**
 * Normaliza um hit `_search` para UI / pipeline (campos frequentes + resumo para laboratório).
 * @param {object} hit — elemento de `hits.hits[]`
 * @param {string} [cnjHint] — CNJ ou número de processo esperado (fallback de exibição)
 */
export function normalizarHitDatajud(hit, cnjHint) {
  const cnj = String(cnjHint ?? '').trim().toUpperCase() || null;
  const src = hit?._source ?? hit?.source ?? {};
  const movs = Array.isArray(src.movimentos) ? src.movimentos : [];
  const ultimo = movs.length > 0 ? movs[movs.length - 1] : null;
  const ojMov = ultimo?.orgaoJulgador;
  return {
    /** Glossário: `Tribunal_Classe_Grau_OrgaoJulgador_NumeroProcesso` */
    id: src.id ?? hit?._id ?? null,
    numeroProcesso: src.numeroProcesso ?? cnj,
    tribunal: src.tribunal ?? src.siglaTribunal ?? null,
    classe: src.classe?.nome ?? src.classeProcessual ?? null,
    classeCodigo: src.classe?.codigo ?? null,
    assuntos: src.assuntos ?? null,
    orgaoJulgador: src.orgaoJulgador?.nome ?? src.orgaoJulgador ?? null,
    orgaoJulgadorCodigo: src.orgaoJulgador?.codigo ?? null,
    grau: src.grau ?? null,
    nivelSigilo: src.nivelSigilo ?? src.sigilo ?? null,
    dataAjuizamento: src.dataAjuizamento ?? null,
    ultimoMovimentoTexto: ultimo?.complemento ?? ultimo?.nome ?? ultimo?.descricao ?? null,
    ultimoMovimentoData: ultimo?.dataHora ?? ultimo?.data ?? null,
    /** Capa: `nome`; movimento (glossário): `nomeOrgao` — alguns índices ainda enviam `nome`. */
    ultimoMovimentoOrgao: ojMov?.nome ?? ojMov?.nomeOrgao ?? null,
    ultimoMovimentoCodigo: ultimo?.codigo ?? null,
    /** Cruzamento opcional com boletim parametrização painel (dez/2025). */
    boletimPainelLegenda: datajudBoletimLegendaMovimento(ultimo?.codigo),
    /** MTD 1.2 — cabeçalho processual (multivalor no XSD). */
    numerosBoletimOcorrencia: mtdNormalizarListaString(src.numeroBoletimOcorrencia),
    numerosInqueritoPolicial: mtdNormalizarListaString(src.numeroInqueritoPolicial),
    /** MTD 1.2 — `prioridade` / `racaCor` aninhados nas partes (estrutura tribunal-específica). */
    partes: src.partes ?? null,
    sistema: src.sistema ?? null,
    formato: src.formato ?? null,
    dataHoraUltimaAtualizacao: src.dataHoraUltimaAtualizacao ?? null,
    timestampIndice: src['@timestamp'] ?? null,
    movimentosCount: movs.length,
    movimentosResumo: movs.slice(-5).map((m) => ({
      dataHora: m.dataHora ?? m.data ?? null,
      codigo: m.codigo ?? null,
      nome: m.nome ?? m.descricao ?? null,
      complemento: m.complemento ?? null,
    })),
    chavesSource: extrairChavesFonte(src),
    score: hit?._score ?? null,
    rawHit: src,
  };
}

function datajudAuthHeaders() {
  const headers = { 'Content-Type': 'application/json' };
  if (import.meta.env.DEV && !import.meta.env.VITE_DATAJUD_BASE) {
    /* Chave aplicada pelo proxy Vite; não enviar do browser. */
  } else if (import.meta.env.VITE_DATAJUD_API_KEY) {
    headers.Authorization = `APIKey ${import.meta.env.VITE_DATAJUD_API_KEY}`;
  }
  return headers;
}

/** Lista bruta `hits.hits` da resposta Elasticsearch. */
export function extrairHitsArrayDatajud(json) {
  const hits = json?.hits?.hits;
  return Array.isArray(hits) ? hits : [];
}

export function extrairTotalHitsDatajud(json) {
  const t = json?.hits?.total;
  if (typeof t === 'object' && t != null && typeof t.value === 'number') return t.value;
  if (typeof t === 'number') return t;
  return null;
}

/**
 * Uma chamada `POST …/{apiIndex}/_search` sem cache (laboratório / exploração).
 * @param {{ apiIndex: string, body: object, signal?: AbortSignal }} opts
 */
export async function executarDatajudSearch(opts) {
  const apiIndex = String(opts?.apiIndex ?? '').trim();
  if (!apiIndex) {
    return { ok: false, motivo: 'sem_api_index', mensagem: 'Indique o índice (ex.: api_publica_tjgo).' };
  }
  const url = `${getDatajudRequestBase()}/${apiIndex}/_search`;
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: datajudAuthHeaders(),
      body: JSON.stringify(opts?.body ?? {}),
      signal: opts?.signal,
    });

    if (res.status === 401 || res.status === 403) {
      return {
        ok: false,
        motivo: 'nao_autorizado',
        statusHttp: res.status,
        mensagem: 'API DataJud: verifique a API Key e o proxy.',
      };
    }

    const txt = await res.text();
    let json;
    try {
      json = JSON.parse(txt);
    } catch {
      return {
        ok: false,
        motivo: 'resposta_nao_json',
        statusHttp: res.status,
        mensagem: txt.slice(0, 400),
      };
    }

    if (!res.ok) {
      return {
        ok: false,
        motivo: 'http_erro',
        statusHttp: res.status,
        mensagem: typeof json?.error === 'object' ? JSON.stringify(json.error).slice(0, 400) : txt.slice(0, 400),
        jsonBruto: json,
      };
    }

    const esErr = erroElasticsearchNoJson(json);
    if (esErr) {
      return {
        ok: false,
        motivo: 'es_query_erro',
        statusHttp: res.status,
        mensagem: esErr,
        jsonBruto: json,
      };
    }

    const hitsRaw = extrairHitsArrayDatajud(json);
    const hitsNormalizados = hitsRaw.map((h) =>
      normalizarHitDatajud(h, h?._source?.numeroProcesso ?? h?._source?.id ?? ''),
    );

    return {
      ok: true,
      motivo: 'ok',
      statusHttp: res.status,
      jsonBruto: json,
      hitsRaw,
      hitsNormalizados,
      totalHits: extrairTotalHitsDatajud(json),
    };
  } catch (e) {
    return {
      ok: false,
      motivo: e?.name === 'AbortError' ? 'abort' : 'rede',
      mensagem: String(e?.message ?? e),
    };
  }
}

/**
 * Wiki DataJud **Ex. 2** — `bool.must` com `match` em `classe.codigo` e `orgaoJulgador.codigo`.
 * O tribunal define-se no URL (`…/api_publica_tjdft/_search`, `…/api_publica_tjgo/_search`, …), não no corpo.
 * Para grandes volumes, combine com {@link datajudCorpoComPaginacaoTimestamp}.
 *
 * @param {number} codigoClasse — ex. wiki TJDFT: 1116
 * @param {number|string} codigoOrgaoJulgador — ex. wiki: 13597; em `_source` pode vir string (ex. `"11400"`)
 * @param {{ size?: number, trackTotalHits?: boolean }} [opts] — por defeito o corpo coincide com a wiki (sem `size`); use `size` até 10000; `trackTotalHits: true` força contagem exacta de hits (custo em desempenho — ver doc. Elastic `track_total_hits`)
 * @returns {{ query: object, size?: number, track_total_hits?: boolean }}
 */
export function datajudCorpoPesquisaClasseEOrgaoJulgador(codigoClasse, codigoOrgaoJulgador, opts = {}) {
  const body = {
    query: {
      bool: {
        must: [
          { match: { [DATAJUD_CAMPO.classeCodigo]: codigoClasse } },
          { match: { [DATAJUD_CAMPO.orgaoJulgadorCodigo]: codigoOrgaoJulgador } },
        ],
      },
    },
  };
  if (Number.isFinite(opts.size) && opts.size > 0) {
    body.size = opts.size;
  }
  if (opts.trackTotalHits === true) {
    body.track_total_hits = true;
  }
  return body;
}

/**
 * Wiki DataJud **Ex. 3** — `sort` fixo em `@timestamp` ascendente, exigido com `search_after`.
 * A consulta por um CNJ (`consultarProcessoDatajud`) não usa isto (poucos hits).
 */
export const DATAJUD_SORT_TIMESTAMP_ASC = [{ [DATAJUD_CAMPO.timestamp]: { order: 'asc' } }];

/**
 * Monta corpo `POST …/_search` compatível com paginação Ex. 3 (mesmo `sort` em todas as páginas).
 *
 * @param {object} corpo — típico `{ size, query, … }` sem `sort` / `search_after`
 * @param {unknown[]|null|undefined} sortUltimoHit — `hits[hits.length-1].sort` da página anterior; omitir na 1.ª página
 * @returns {object}
 */
export function datajudCorpoComPaginacaoTimestamp(corpo, sortUltimoHit) {
  const out = {
    ...corpo,
    sort: DATAJUD_SORT_TIMESTAMP_ASC,
  };
  if (Array.isArray(sortUltimoHit) && sortUltimoHit.length > 0) {
    out.search_after = sortUltimoHit;
  }
  return out;
}

/**
 * Valores para `search_after` na página seguinte (último documento da resposta anterior).
 *
 * @param {object} json — resposta JSON do `_search`
 * @returns {unknown[]|null}
 */
export function extrairSortUltimoHitParaSearchAfter(json) {
  const hits = json?.hits?.hits;
  if (!Array.isArray(hits) || hits.length === 0) return null;
  const s = hits[hits.length - 1]?.sort;
  return Array.isArray(s) && s.length > 0 ? s : null;
}

/**
 * Consulta DataJud. Sem apiIndex ou sem rede → retorno com ok:false e motivo (não gera teor substituto).
 */
export async function consultarProcessoDatajud(cnjNormalizado) {
  const cnj = String(cnjNormalizado ?? '').trim().toUpperCase();
  if (!cnj) {
    return { ok: false, motivo: 'sem_cnj', hit: false };
  }

  const ck = `cnj:${cnj}`;
  const cached = cacheGet(ck);
  if (cached) return { ...cached, fromCache: true };

  const trib = resolverTribunalDatajudPorCnj(cnj);
  const apiIndex = trib?.apiIndex;
  if (!apiIndex) {
    return {
      ok: false,
      motivo: 'tribunal_nao_mapeado',
      hit: false,
      tribunalResolvido: trib,
      mensagem: 'Índice DataJud não mapeado para este CNJ — configure a tabela ou processe manualmente.',
    };
  }

  const url = `${getDatajudRequestBase()}/${apiIndex}/_search`;
  const tentativas = corposPesquisaEmSequencia(cnj);

  try {
    const headers = datajudAuthHeaders();

    const ctrl = new AbortController();
    const to = window.setTimeout(() => ctrl.abort(), 28000);
    let ultimoJson = null;
    let ultimaEstrategia = null;

    try {
      for (const { id, body } of tentativas) {
        ultimaEstrategia = id;
        const res = await fetch(url, {
          method: 'POST',
          headers,
          body: JSON.stringify(body),
          signal: ctrl.signal,
        });

        if (res.status === 401 || res.status === 403) {
          window.clearTimeout(to);
          return {
            ok: false,
            motivo: 'nao_autorizado',
            hit: false,
            statusHttp: res.status,
            mensagem: 'API DataJud: verifique a API Key e o proxy.',
          };
        }

        if (!res.ok) {
          const txt = await res.text().catch(() => '');
          window.clearTimeout(to);
          return {
            ok: false,
            motivo: 'http_erro',
            hit: false,
            statusHttp: res.status,
            mensagem: txt.slice(0, 400),
          };
        }

        const json = await res.json();
        ultimoJson = json;
        const esErr = erroElasticsearchNoJson(json);
        if (esErr) {
          window.clearTimeout(to);
          return {
            ok: false,
            motivo: 'es_query_erro',
            hit: false,
            statusHttp: res.status,
            estrategiaQuery: id,
            mensagem: esErr,
            jsonBruto: json,
          };
        }

        const first = extrairPrimeiroHit(json);
        if (first) {
          window.clearTimeout(to);
          const norm = normalizarHitDatajud(first, cnj);
          const out = {
            ok: true,
            motivo: 'encontrado',
            hit: true,
            tribunalResolvido: trib,
            dados: norm,
            jsonBruto: json,
            estrategiaQuery: id,
          };
          cacheSet(ck, out);
          return out;
        }
      }
    } finally {
      window.clearTimeout(to);
    }

    return {
      ok: true,
      motivo: 'nao_encontrado',
      hit: false,
      tribunalResolvido: trib,
      jsonBruto: ultimoJson,
      estrategiaQuery: ultimaEstrategia,
      tentativasQuery: tentativas.map((t) => t.id),
    };
  } catch (e) {
    const out = {
      ok: false,
      motivo: e?.name === 'AbortError' ? 'timeout' : 'rede',
      hit: false,
      erro: String(e?.message ?? e),
    };
    return out;
  }
}

export { DATAJUD_CAMPO, DATAJUD_WIKI_GLOSSARIO_URL } from './datajudGlossario.js';
export {
  MTD_PRIORIDADE_IDOSO,
  MTD_RACA_COR,
  mtdDescricaoRacaCor,
  mtdNormalizarListaString,
} from './datajudMtd12.js';
export {
  DATAJUD_BOLETIM_2025_12_EXEMPLOS,
  DATAJUD_URL_PARAMETRIZACAO,
  datajudBoletimLegendaMovimento,
} from './datajudParametrizacaoCnj.js';
