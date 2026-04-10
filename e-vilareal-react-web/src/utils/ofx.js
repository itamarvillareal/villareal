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

/**
 * Alguns bancos (ex.: Cora) enviam CHECKNUM "0" ou só zeros como placeholder.
 * Isso não deve substituir um FITID real — em JS `"0"` é truthy e quebrava `checkNum || fitid`.
 */
function checkNumSignificativo(checkNum) {
  const c = normalizeWhitespace(checkNum);
  if (!c) return '';
  if (/^0+$/.test(c)) return '';
  return c;
}

/** Identificador único por transação OFX: FITID (preferencial), depois cheque real, depois índice no arquivo. */
function idLancamentoOfx(block, idx) {
  const fitid = normalizeWhitespace(getTagValue(block, 'FITID'));
  const check = checkNumSignificativo(getTagValue(block, 'CHECKNUM'));
  return normalizeWhitespace(fitid || check || String((idx ?? 0) + 1));
}

/**
 * Lê os primeiros bytes como ASCII (0–127) para interpretar o cabeçalho OFX sem depender da codificação do corpo.
 */
function decodeAsciiPrefixForOfxHeader(buffer, maxLen = 4096) {
  const u = new Uint8Array(buffer, 0, Math.min(buffer.byteLength, maxLen));
  let s = '';
  for (let i = 0; i < u.length; i += 1) {
    s += u[i] <= 127 ? String.fromCharCode(u[i]) : ' ';
  }
  return s;
}

function normalizeCharsetHint(raw) {
  if (!raw) return null;
  const u = String(raw).trim().toUpperCase().replace(/\s+/g, '');
  if (
    u === '1252' ||
    u === 'CP1252' ||
    u === 'WINDOWS-1252' ||
    u === 'WIN-1252' ||
    u === 'MS-ANSI'
  ) {
    return '1252';
  }
  if (
    u === '8859-1' ||
    u === 'ISO-8859-1' ||
    u === 'ISO8859-1' ||
    u === 'LATIN1' ||
    u === 'LATIN-1'
  ) {
    return '8859-1';
  }
  return u;
}

function parseOfxHeaderEncodingHints(buffer) {
  const prefix = decodeAsciiPrefixForOfxHeader(buffer, 4096);
  const enc = (prefix.match(/ENCODING:\s*(\S+)/i) || [])[1]?.trim() || null;
  const csRaw = (prefix.match(/CHARSET:\s*(\S+)/i) || [])[1]?.trim() || null;
  return {
    encoding: enc ? enc.toUpperCase() : null,
    charset: normalizeCharsetHint(csRaw),
  };
}

/**
 * @param {string | null} encoding ex.: USASCII, UTF-8
 * @param {string | null} charset ex.: 1252, 8859-1 (normalizado)
 */
function decoderLabelFromOfxHints(encoding, charset) {
  if (encoding === 'UTF-8') return 'utf-8';
  const cs = charset || '';
  if (cs === '1252') return 'windows-1252';
  if (cs === '8859-1') return 'iso-8859-1';
  return null;
}

function decodeLatinBankFallback(buffer) {
  try {
    return new TextDecoder('windows-1252').decode(buffer);
  } catch {
    return new TextDecoder('iso-8859-1').decode(buffer);
  }
}

function readFileToArrayBuffer(file) {
  if (file && typeof file.arrayBuffer === 'function') return file.arrayBuffer();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
    reader.onload = () => resolve(reader.result);
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Lê um ficheiro OFX com a codificação correta. Bancos brasileiros (ex.: Banco do Brasil) costumam usar
 * Windows-1252 / ISO-8859-1 no corpo, enquanto o cabeçalho declara USASCII — `readAsText` em UTF-8 corrompe acentos.
 */
export async function readOfxFileAsText(file) {
  const buf = await readFileToArrayBuffer(file);
  const { encoding, charset } = parseOfxHeaderEncodingHints(buf);
  const hinted = decoderLabelFromOfxHints(encoding, charset);
  if (hinted) {
    try {
      return new TextDecoder(hinted).decode(buf);
    } catch {
      /* continua */
    }
  }
  const utf8 = new TextDecoder('utf-8', { fatal: false }).decode(buf);
  const replCount = (utf8.match(/\uFFFD/g) || []).length;
  if (replCount > 0) {
    return decodeLatinBankFallback(buf);
  }
  const prefix = decodeAsciiPrefixForOfxHeader(buf, 4096);
  if (
    encoding === 'USASCII' &&
    hinted == null &&
    /BANCO DO BRASIL|BANCODOBRASIL|BANCO\s+DO\s+BRASIL/i.test(prefix + utf8.slice(0, 12000))
  ) {
    return decodeLatinBankFallback(buf);
  }
  return utf8;
}

export function chaveDedupeLancamento(t) {
  const c = Math.round((Number(t.valor) || 0) * 100);
  return `${String(t.numero ?? '').trim()}|${String(t.data ?? '').trim()}|${c}`;
}

/** Remove marcação de par de compensação (não deve vir de arquivo OFX/PDF). */
function stripTagParCompensacaoCampo(s) {
  return String(s ?? '')
    .replace(/(?:^|\s)\[Par compensação\]/g, '')
    .trim();
}

/**
 * Importação de extrato (OFX, PDF BTG, etc.) não deve preencher Cód. cliente, Proc. nem colunas à direita
 * (Ref., Eq., Parcela, categoria de vínculo) nem metadados de API — só edição manual ou fluxos específicos.
 */
export function sanitizarLancamentoImportacaoExtrato(t) {
  const base = t && typeof t === 'object' ? { ...t } : {};
  delete base.apiId;
  const prevMeta = base._financeiroMeta && typeof base._financeiroMeta === 'object' ? base._financeiroMeta : {};
  return {
    ...base,
    origemImportacao: String(base.origemImportacao ?? '').trim(),
    codCliente: '',
    proc: '',
    ref: '',
    dimensao: '',
    eq: '',
    parcela: '',
    categoria: '',
    clienteId: null,
    processoId: null,
    descricaoDetalhada: stripTagParCompensacaoCampo(base.descricaoDetalhada),
    _financeiroMeta: {
      ...prevMeta,
      clienteId: null,
      processoId: null,
      classificacaoFinanceiraId: null,
      eloFinanceiroId: null,
    },
  };
}

/**
 * Quantos lançamentos de `novo` seriam acrescentados ao mesclar com `existente`.
 * Ignora só os que já constam no extrato/base (mesma chave: nº + data + valor em centavos).
 * Várias linhas idênticas no próprio arquivo `novo` contam todas, exceto as que batem com `existente`.
 */
export function contarLancamentosNovos(existente, novo) {
  const keys = new Set((existente || []).map((t) => chaveDedupeLancamento(t)));
  let n = 0;
  for (const t of novo || []) {
    if (!keys.has(chaveDedupeLancamento(t))) n += 1;
  }
  return n;
}

/**
 * Lista os lançamentos de `novo` cuja chave ainda não está em `existente` (extrato já gravado/carregado).
 * Duplicatas **dentro** de `novo` mantêm-se: só a comparação com `existente` usa deduplicação.
 */
export function listarLancamentosNovosDedupe(existente, novo) {
  const keys = new Set((existente || []).map((t) => chaveDedupeLancamento(t)));
  return (novo || []).filter((t) => !keys.has(chaveDedupeLancamento(t)));
}

/**
 * Mescla lançamentos de um novo OFX/PDF com o extrato já existente.
 * Não remove linhas antigas.
 * Ignora apenas linhas do arquivo novo cuja chave (FITID/nº + data + valor) **já exista no extrato anterior**;
 * várias transações iguais **no mesmo arquivo** são todas incluídas (podem ser movimentos reais repetidos).
 * Recalcula saldo em ordem cronológica.
 */
export function mergeExtratoBancario(existente, novo) {
  const keysExistente = new Set((existente || []).map((t) => chaveDedupeLancamento(t)));
  const base = (existente || []).map((t) => ({ ...t }));
  const adicionados = [];
  for (const t of novo || []) {
    const k = chaveDedupeLancamento(t);
    if (keysExistente.has(k)) continue;
    const row = sanitizarLancamentoImportacaoExtrato({ ...t });
    const L = String(row.letra ?? '').trim().toUpperCase();
    if (!L) row.letra = 'N';
    adicionados.push(row);
  }
  const arr = [...base, ...adicionados];
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

/** Lançamento criado por importação de arquivo — não mesclar vínculos do cache local sobre a API. */
function isOrigemImportacaoArquivoExtrato(row) {
  return /^(OFX|PDF)$/i.test(String(row?.origemImportacao ?? '').trim());
}

/**
 * API como base; campos de classificação vazios na API reaproveitam o cache local (edições / sync pendente).
 * Exceção: linhas com origem OFX/PDF na API ignoram cache para Cód. cliente, Proc. e colunas à direita.
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

  const apiImport = isOrigemImportacaoArquivoExtrato(apiT);
  const apiSemVinculoClienteProc =
    !strTrimExtrato(apiT.codCliente) &&
    !strTrimExtrato(apiT.proc) &&
    !(Number(metaApi.clienteId) > 0) &&
    !(Number(metaApi.processoId) > 0);
  /** Só ignora cache local para linhas OFX/PDF ainda sem vínculo na API (evita reidratar Cód./Proc. antigos). */
  const ignorarCacheVinculosImportacao = apiImport && apiSemVinculoClienteProc;

  const codCliente = ignorarCacheVinculosImportacao
    ? strTrimExtrato(apiT.codCliente) || ''
    : pick(apiT.codCliente, locT.codCliente) ?? '';
  const proc = ignorarCacheVinculosImportacao
    ? strTrimExtrato(apiT.proc) || ''
    : pick(apiT.proc, locT.proc) ?? '';
  const ref = ignorarCacheVinculosImportacao ? strTrimExtrato(apiT.ref) || '' : pick(apiT.ref, locT.ref);
  const dimensao = ignorarCacheVinculosImportacao
    ? strTrimExtrato(apiT.dimensao) || ''
    : pick(apiT.dimensao, locT.dimensao);
  const eq = ignorarCacheVinculosImportacao ? strTrimExtrato(apiT.eq) || '' : pick(apiT.eq, locT.eq);
  const parcela = ignorarCacheVinculosImportacao
    ? strTrimExtrato(apiT.parcela) || ''
    : pick(apiT.parcela, locT.parcela);
  const categoria = ignorarCacheVinculosImportacao
    ? strTrimExtrato(apiT.categoria) || ''
    : pick(apiT.categoria, locT.categoria);

  return {
    ...locT,
    ...apiT,
    letra,
    codCliente,
    proc,
    categoria,
    descricaoDetalhada: pick(apiT.descricaoDetalhada, locT.descricaoDetalhada),
    ref,
    dimensao,
    eq,
    parcela,
    _financeiroMeta: {
      ...metaLoc,
      ...metaApi,
      contaContabilId: metaApi.contaContabilId ?? metaLoc.contaContabilId ?? null,
      clienteId: ignorarCacheVinculosImportacao
        ? metaApi.clienteId ?? null
        : metaApi.clienteId ?? metaLoc.clienteId ?? null,
      processoId: ignorarCacheVinculosImportacao
        ? metaApi.processoId ?? null
        : metaApi.processoId ?? metaLoc.processoId ?? null,
      classificacaoFinanceiraId: ignorarCacheVinculosImportacao
        ? metaApi.classificacaoFinanceiraId ?? null
        : metaApi.classificacaoFinanceiraId ?? metaLoc.classificacaoFinanceiraId ?? null,
      eloFinanceiroId: ignorarCacheVinculosImportacao
        ? metaApi.eloFinanceiroId ?? null
        : metaApi.eloFinanceiroId ?? metaLoc.eloFinanceiroId ?? null,
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
  const apiList = Array.isArray(apiRows) ? apiRows : [];
  const mapLocal = new Map();
  for (const t of localRows || []) {
    mapLocal.set(chaveDedupeLancamento(t), t);
  }
  const map = new Map();
  const apiIds = new Set();
  for (const t of apiList) {
    const k = chaveDedupeLancamento(t);
    const apiRow = { ...t };
    const loc = mapLocal.get(k);
    map.set(k, loc ? mesclarLinhaExtratoApiComLocal(apiRow, loc) : apiRow);
    const id = Number(t.apiId ?? t.id);
    if (Number.isFinite(id) && id > 0) apiIds.add(id);
  }
  const servidorSemLancamentosNesteBanco = apiList.length === 0;
  for (const t of localRows || []) {
    const k = chaveDedupeLancamento(t);
    if (map.has(k)) continue;
    const aid = Number(t.apiId ?? t.id);
    if (servidorSemLancamentosNesteBanco && Number.isFinite(aid) && aid > 0) {
      continue;
    }
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

export function parseOfxToExtrato(ofxText) {
  const txt = String(ofxText ?? '');

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
    const id = idLancamentoOfx(b, idx);
    const name = normalizeWhitespace(getTagValue(b, 'NAME'));
    const memo = normalizeWhitespace(getTagValue(b, 'MEMO'));
    const descricao = memo || name || 'LANÇAMENTO';
    const trnType = normalizeWhitespace(getTagValue(b, 'TRNTYPE'));

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
      /** Código de cliente e processo só por edição manual no Financeiro — nunca a partir do OFX. */
      codCliente: '',
      proc: '',
      dimensao: '',
      parcela: '',
      ref: '',
      eq: '',
      /** Permite ignorar cache local em `mesclarLinhaExtratoApiComLocal` e na resposta do POST. */
      origemImportacao: 'OFX',
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

  return transacoes.map(sanitizarLancamentoImportacaoExtrato);
}
