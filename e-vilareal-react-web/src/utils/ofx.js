function getTagValue(block, tag) {
  const re = new RegExp(`<${tag}>([\\s\\S]*?)(?:<\\/\\s*${tag}\\s*>|\\r?\\n|$)`, 'i');
  const m = block.match(re);
  return m ? String(m[1]).trim() : '';
}

function parseOfxDate(dt) {
  // OFX comum: YYYYMMDD ou YYYYMMDDHHMMSS[.xxx][timezone]
  const s = String(dt ?? '').trim();
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  if (y.length !== 4 || m.length !== 2 || d.length !== 2) return '';
  return `${d}/${m}/${y}`;
}

function parseNumberBRLike(n) {
  const s = String(n ?? '').trim().replace(',', '.');
  const v = Number(s);
  return Number.isNaN(v) ? 0 : v;
}

function normalizeWhitespace(s) {
  return String(s ?? '').replace(/\s+/g, ' ').trim();
}

export function chaveDedupeLancamento(t) {
  const c = Math.round((Number(t.valor) || 0) * 100);
  return `${String(t.numero ?? '').trim()}|${String(t.data ?? '').trim()}|${c}`;
}

/** Quantos lançamentos de `novo` ainda não existem em `existente`. */
export function contarLancamentosNovos(existente, novo) {
  const keys = new Set((existente || []).map((t) => chaveDedupeLancamento(t)));
  let n = 0;
  for (const t of novo || []) {
    if (!keys.has(chaveDedupeLancamento(t))) n += 1;
  }
  return n;
}

/** Lista os lançamentos de `novo` cuja chave (FITID + data + valor) ainda não está em `existente`. */
export function listarLancamentosNovosDedupe(existente, novo) {
  const keys = new Set((existente || []).map((t) => chaveDedupeLancamento(t)));
  return (novo || []).filter((t) => !keys.has(chaveDedupeLancamento(t)));
}

/**
 * Mescla lançamentos de um novo OFX com o extrato já existente do banco.
 * Não remove linhas antigas; ignora duplicatas (mesmo Id./FITID + data + valor em centavos).
 * Recalcula saldo em ordem cronológica.
 */
export function mergeExtratoBancario(existente, novo) {
  const map = new Map();
  for (const t of existente || []) {
    map.set(chaveDedupeLancamento(t), { ...t });
  }
  for (const t of novo || []) {
    const k = chaveDedupeLancamento(t);
    if (!map.has(k)) {
      const row = { ...t };
      const L = String(row.letra ?? '').trim().toUpperCase();
      if (!L) row.letra = 'N';
      map.set(k, row);
    }
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => {
    const da = (a.data || '').split('/').reverse().join('-');
    const db = (b.data || '').split('/').reverse().join('-');
    const byDate = da.localeCompare(db);
    if (byDate !== 0) return byDate;
    return String(a.numero).localeCompare(String(b.numero));
  });
  let saldo = 0;
  for (const t of arr) {
    saldo += Number(t.valor) || 0;
    t.saldo = saldo;
  }
  return arr;
}

function strTrimExtrato(v) {
  return String(v ?? '').trim();
}

/**
 * API como base; campos de classificação vazios na API reaproveitam o cache local (edições / sync pendente).
 */
export function mesclarLinhaExtratoApiComLocal(apiT, locT) {
  const metaApi = apiT._financeiroMeta || {};
  const metaLoc = locT._financeiroMeta || {};
  const pick = (a, l) => {
    const sa = strTrimExtrato(a);
    if (sa !== '') return a;
    const sl = strTrimExtrato(l);
    return sl !== '' ? l : a;
  };
  const aLet = strTrimExtrato(apiT.letra).toUpperCase();
  const lLet = strTrimExtrato(locT.letra).toUpperCase();
  const letra =
    aLet && aLet !== 'N'
      ? apiT.letra
      : lLet
        ? locT.letra
        : apiT.letra || locT.letra || 'N';

  return {
    ...locT,
    ...apiT,
    letra,
    codCliente: pick(apiT.codCliente, locT.codCliente) ?? '',
    proc: pick(apiT.proc, locT.proc) ?? '',
    categoria: pick(apiT.categoria, locT.categoria),
    descricaoDetalhada: pick(apiT.descricaoDetalhada, locT.descricaoDetalhada),
    ref: pick(apiT.ref, locT.ref),
    dimensao: pick(apiT.dimensao, locT.dimensao),
    eq: pick(apiT.eq, locT.eq),
    parcela: pick(apiT.parcela, locT.parcela),
    _financeiroMeta: {
      ...metaLoc,
      ...metaApi,
      clienteId: metaApi.clienteId ?? metaLoc.clienteId ?? null,
      processoId: metaApi.processoId ?? metaLoc.processoId ?? null,
      contaContabilId: metaApi.contaContabilId ?? metaLoc.contaContabilId ?? null,
      classificacaoFinanceiraId: metaApi.classificacaoFinanceiraId ?? metaLoc.classificacaoFinanceiraId ?? null,
      eloFinanceiroId: metaApi.eloFinanceiroId ?? metaLoc.eloFinanceiroId ?? null,
    },
  };
}

/**
 * Após GET na API financeira: `apiRows` reflete o servidor; `localRows` é cache (localStorage) ou base.
 * Entram todos os lançamentos da API; do local permanecem só os que **não** têm par na API
 * (mesma {@link chaveDedupeLancamento} ou mesmo `apiId`), para não sumirem OFX ainda não persistidos.
 * Linhas com a mesma chave: mescla classificações locais quando a API ainda não as preencheu.
 */
export function mergeExtratoApiComLocal(apiRows, localRows) {
  const mapLocal = new Map();
  for (const t of localRows || []) {
    mapLocal.set(chaveDedupeLancamento(t), t);
  }
  const map = new Map();
  const apiIds = new Set();
  for (const t of apiRows || []) {
    const k = chaveDedupeLancamento(t);
    const apiRow = { ...t };
    const loc = mapLocal.get(k);
    map.set(k, loc ? mesclarLinhaExtratoApiComLocal(apiRow, loc) : apiRow);
    const id = Number(t.apiId ?? t.id);
    if (Number.isFinite(id) && id > 0) apiIds.add(id);
  }
  for (const t of localRows || []) {
    const k = chaveDedupeLancamento(t);
    if (map.has(k)) continue;
    const aid = Number(t.apiId);
    if (Number.isFinite(aid) && aid > 0 && apiIds.has(aid)) continue;
    map.set(k, { ...t });
  }
  const arr = Array.from(map.values());
  arr.sort((a, b) => {
    const da = (a.data || '').split('/').reverse().join('-');
    const db = (b.data || '').split('/').reverse().join('-');
    const byDate = da.localeCompare(db);
    if (byDate !== 0) return byDate;
    return String(a.numero).localeCompare(String(b.numero));
  });
  let saldo = 0;
  for (const t of arr) {
    saldo += Number(t.valor) || 0;
    t.saldo = saldo;
  }
  return arr;
}

export function parseOfxToExtrato(ofxText, options = {}) {
  const txt = String(ofxText ?? '');
  const nomeBanco = String(options?.nomeBanco ?? '').toUpperCase();

  // Ledger balance (saldo final) se existir
  const ledgerBlockMatch = txt.match(/<LEDGERBAL>[\s\S]*?<\/LEDGERBAL>/i);
  const ledgerBlock = ledgerBlockMatch ? ledgerBlockMatch[0] : '';
  const saldoFinal = ledgerBlock ? parseNumberBRLike(getTagValue(ledgerBlock, 'BALAMT')) : null;

  // Captura cada transação
  const stmts = [];
  const reTrn = /<STMTTRN>[\s\S]*?<\/STMTTRN>/gi;
  let m;
  while ((m = reTrn.exec(txt)) !== null) {
    stmts.push(m[0]);
  }

  const transacoes = stmts.map((b, idx) => {
    const trnAmt = parseNumberBRLike(getTagValue(b, 'TRNAMT'));
    const dtPosted = parseOfxDate(getTagValue(b, 'DTPOSTED'));
    const fitid = getTagValue(b, 'FITID');
    const checkNum = getTagValue(b, 'CHECKNUM');
    const id = normalizeWhitespace(checkNum || fitid || String(idx + 1));
    const name = normalizeWhitespace(getTagValue(b, 'NAME'));
    const memo = normalizeWhitespace(getTagValue(b, 'MEMO'));
    const descricao = memo || name || 'LANÇAMENTO';
    const trnType = normalizeWhitespace(getTagValue(b, 'TRNTYPE'));

    const mockCod = String((idx % 1000) + 1);
    const mockProc = String((idx % 10) + 1);
    return {
      /** Conta contábil "Conta Não Identificados" — permanece até reclassificar no extrato ou via Parear compensações. */
      letra: 'N',
      numero: id,
      data: dtPosted,
      descricao: descricao,
      valor: trnAmt,
      saldo: 0,
      saldoDesc: '',
      descricaoDetalhada: trnType ? `${trnType}${memo ? ` — ${memo}` : ''}` : memo,
      categoria: '',
      codCliente: nomeBanco === 'CORA' ? mockCod : '',
      proc: nomeBanco === 'CORA' ? mockProc : '',
      dimensao: '',
      parcela: '',
      ref: '',
      eq: '',
    };
  });

  // Ordena por data + número para cálculo de saldo
  transacoes.sort((a, b) => {
    const da = a.data.split('/').reverse().join('-');
    const db = b.data.split('/').reverse().join('-');
    const byDate = da.localeCompare(db);
    if (byDate !== 0) return byDate;
    return String(a.numero).localeCompare(String(b.numero));
  });

  // Calcula saldo por linha se houver saldo final
  if (typeof saldoFinal === 'number' && !Number.isNaN(saldoFinal)) {
    const soma = transacoes.reduce((s, t) => s + (Number(t.valor) || 0), 0);
    let saldo = saldoFinal - soma;
    for (const t of transacoes) {
      saldo += Number(t.valor) || 0;
      t.saldo = saldo;
    }
  } else {
    let saldo = 0;
    for (const t of transacoes) {
      saldo += Number(t.valor) || 0;
      t.saldo = saldo;
    }
  }

  return transacoes;
}
