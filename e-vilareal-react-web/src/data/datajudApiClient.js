/**
 * Cliente da API pública DataJud (CNJ). Camada 2 — não substitui o teor do PDF.
 *
 * Em desenvolvimento, use o proxy em `vite.config` (`/datajud-proxy`) e `VITE_DATAJUD_API_KEY` no .env
 * para injetar o header Authorization no servidor de dev (evita expor chave no bundle).
 *
 * Em produção, configure o mesmo proxy no gateway ou um endpoint backend.
 */

import { resolverTribunalDatajudPorCnj } from './publicacoesCnjTribunal.js';

const CACHE_PREFIX = 'vilareal.datajud.cache.';
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
 * Monta consulta tipo Elasticsearch usada pelo DataJud (match no número do processo).
 */
function corpoPesquisaNumeroProcesso(numeroCnj) {
  return {
    size: 3,
    query: {
      bool: {
        should: [
          { match: { numeroProcesso: numeroCnj } },
          { term: { 'numeroProcesso.keyword': numeroCnj } },
        ],
        minimum_should_match: 1,
      },
    },
  };
}

function extrairPrimeiroHit(json) {
  const hits = json?.hits?.hits;
  if (!Array.isArray(hits) || hits.length === 0) return null;
  return hits[0];
}

function normalizarRespostaHit(hit, cnj) {
  const src = hit?._source ?? hit?.source ?? {};
  const movs = Array.isArray(src.movimentos) ? src.movimentos : [];
  const ultimo = movs.length > 0 ? movs[movs.length - 1] : null;
  return {
    numeroProcesso: src.numeroProcesso ?? cnj,
    tribunal: src.tribunal ?? src.siglaTribunal ?? null,
    classe: src.classe?.nome ?? src.classeProcessual ?? null,
    assuntos: src.assuntos ?? null,
    orgaoJulgador: src.orgaoJulgador?.nome ?? src.orgaoJulgador ?? null,
    grau: src.grau ?? null,
    nivelSigilo: src.nivelSigilo ?? src.sigilo ?? null,
    dataAjuizamento: src.dataAjuizamento ?? null,
    ultimoMovimentoTexto: ultimo?.complemento ?? ultimo?.nome ?? ultimo?.descricao ?? null,
    ultimoMovimentoData: ultimo?.dataHora ?? ultimo?.data ?? null,
    rawHit: src,
  };
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
  const body = corpoPesquisaNumeroProcesso(cnj);

  try {
    const headers = { 'Content-Type': 'application/json' };
    if (import.meta.env.DEV && !import.meta.env.VITE_DATAJUD_BASE) {
      /* Chave aplicada pelo proxy Vite; não enviar do browser. */
    } else if (import.meta.env.VITE_DATAJUD_API_KEY) {
      headers.Authorization = `APIKey ${import.meta.env.VITE_DATAJUD_API_KEY}`;
    }

    const ctrl = new AbortController();
    const to = window.setTimeout(() => ctrl.abort(), 28000);
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    window.clearTimeout(to);

    if (res.status === 401 || res.status === 403) {
      const out = {
        ok: false,
        motivo: 'nao_autorizado',
        hit: false,
        statusHttp: res.status,
        mensagem: 'API DataJud: verifique a API Key e o proxy.',
      };
      return out;
    }

    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return {
        ok: false,
        motivo: 'http_erro',
        hit: false,
        statusHttp: res.status,
        mensagem: txt.slice(0, 400),
      };
    }

    const json = await res.json();
    const first = extrairPrimeiroHit(json);
    if (!first) {
      return {
        ok: true,
        motivo: 'nao_encontrado',
        hit: false,
        tribunalResolvido: trib,
        jsonBruto: json,
      };
    }

    const norm = normalizarRespostaHit(first, cnj);
    const out = {
      ok: true,
      motivo: 'encontrado',
      hit: true,
      tribunalResolvido: trib,
      dados: norm,
      jsonBruto: json,
    };
    cacheSet(ck, out);
    return out;
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
