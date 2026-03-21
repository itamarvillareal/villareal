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
    if (!map.has(k)) map.set(k, { ...t });
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
      letra: 'N', // padrão: Não Identificados (editável na tela)
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
