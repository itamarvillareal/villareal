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

/** Caixa (CR LV OR E) envia FITID "0" — mesmo problema que CHECKNUM placeholder. */
function fitIdSignificativo(fitid) {
  const f = normalizeWhitespace(fitid);
  if (!f) return '';
  if (/^0+$/.test(f)) return '';
  return f;
}

/**
 * Identificador único por transação OFX: FITID (preferencial), depois cheque real,
 * depois sequência no arquivo. IDs repetidos no mesmo arquivo recebem sufixo `-N`.
 */
function idLancamentoOfx(block, idx, idsUsados) {
  const fitid = fitIdSignificativo(getTagValue(block, 'FITID'));
  const check = checkNumSignificativo(getTagValue(block, 'CHECKNUM'));
  let id = fitid || check || '';
  const seq = String((idx ?? 0) + 1);
  if (!id) {
    id = `ofx-${seq}`;
  } else if (idsUsados?.has(id)) {
    id = `${id}-${seq}`;
  }
  idsUsados?.add(id);
  return normalizeWhitespace(id);
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

/** Converte DD/MM/AAAA ou ISO em YYYY-MM-DD. */
export function dataLancamentoParaIso(dataBrOuIso) {
  const s = String(dataBrOuIso ?? '').trim();
  const iso = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  const br = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (br) return `${br[3]}-${br[2]}-${br[1]}`;
  const brCurto = /^(\d{2})\/(\d{2})$/.exec(s);
  if (brCurto) {
    const ano = new Date().getFullYear();
    return `${ano}-${brCurto[2]}-${brCurto[1]}`;
  }
  return '';
}

/**
 * Valor em centavos com sinal para dedupe (crédito ≠ débito no mesmo |valor|).
 * Usa {@code natureza} quando o valor veio absoluto da API.
 */
export function valorCentavosAssinadoDedupe(t) {
  const v = Number(t?.valor) || 0;
  const nat = String(t?.natureza ?? '').toUpperCase();
  if (nat === 'DEBITO') return -Math.round(Math.abs(v) * 100);
  if (nat === 'CREDITO') return Math.round(Math.abs(v) * 100);
  return Math.round(v * 100);
}

export function chaveDedupeLancamento(t) {
  const c = valorCentavosAssinadoDedupe(t);
  return `${String(t.numero ?? '').trim()}|${String(t.data ?? '').trim()}|${c}`;
}

/**
 * Normaliza descrição para comparar OFX com planilha (espaços, 07/05 vs 07 05, acentos, pontos em números).
 */
export function normalizarDescricaoParaDedupe(descricao) {
  let s = String(descricao ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/\s+/g, ' ');
  s = s.replace(/(\d{2})[\s/.-]+(\d{2})(?:[\s/.-]+(\d{4}))?/g, (_, d, m, y) =>
    y ? `${d}${m}${y}` : `${d}${m}`,
  );
  s = s.replace(/(\d)[\s.,-]+(?=\d)/g, '$1');
  return s.replace(/[^\w\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Só dígitos presentes na descrição (ex.: TED 208.0001 vs 208 0001). */
export function digitosDescricao(descricao) {
  return String(descricao ?? '').replace(/\D/g, '');
}

/**
 * Chave sem origem do número (FITID vs PL-…): data + valor + descrição normalizada.
 * Permite ignorar OFX já importado via planilha.
 */
export function chaveSemanticaLancamento(t) {
  const data = dataLancamentoParaIso(t?.data) || String(t?.data ?? '').trim();
  const cents = valorCentavosAssinadoDedupe(t);
  const desc = normalizarDescricaoParaDedupe(t?.descricao);
  return `${data}|${cents}|${desc}`;
}

/**
 * Chaves alternativas para tolerar variações banco/planilha (APR vs MAIS, TED com pontos).
 * @param {object} t
 * @returns {string[]}
 */
export function listarChavesSemanticasLancamento(t) {
  const data = dataLancamentoParaIso(t?.data) || String(t?.data ?? '').trim();
  const cents = valorCentavosAssinadoDedupe(t);
  const desc = normalizarDescricaoParaDedupe(t?.descricao);
  const chaves = new Set([`${data}|${cents}|${desc}`]);

  if (desc.startsWith('rend pago aplic aut')) {
    chaves.add(`${data}|${cents}|rend-pago-aplic-aut`);
  }
  if (desc.startsWith('ted ') || desc.startsWith('ted')) {
    const dig = digitosDescricao(t?.descricao);
    if (dig) chaves.add(`${data}|${cents}|ted|${dig}`);
  }
  const mPix = desc.match(/^(dev pix|pix transf)\s+(.+)$/);
  if (mPix) {
    const sufixo = mPix[2].replace(/\d{4}$/, '').trim();
    if (sufixo.length >= 3) {
      chaves.add(`${data}|${cents}|${mPix[1]}|${sufixo.slice(0, 40)}`);
    }
  }

  return [...chaves];
}

function consumirDoMapa(contagens, chave) {
  const n = contagens.get(chave) || 0;
  if (n <= 0) return false;
  if (n === 1) contagens.delete(chave);
  else contagens.set(chave, n - 1);
  return true;
}

function registrarChavesSemanticas(contagens, t) {
  for (const k of listarChavesSemanticasLancamento(t)) {
    contagens.set(k, (contagens.get(k) || 0) + 1);
  }
}

function tentarConsumirSemantico(contagens, t) {
  for (const k of listarChavesSemanticasLancamento(t)) {
    if (consumirDoMapa(contagens, k)) return true;
  }
  return false;
}

function construirContagens(existente) {
  const estritas = new Map();
  const semanticas = new Map();
  for (const t of existente || []) {
    const ke = chaveDedupeLancamento(t);
    estritas.set(ke, (estritas.get(ke) || 0) + 1);
    registrarChavesSemanticas(semanticas, t);
  }
  return { estritas, semanticas };
}

/** @param {object[]} lancamentos */
export function contagemLancamentosPorDia(lancamentos) {
  /** @type {Map<string, number>} */
  const map = new Map();
  for (const t of lancamentos || []) {
    const d = dataLancamentoParaIso(t?.data);
    if (!d) continue;
    map.set(d, (map.get(d) || 0) + 1);
  }
  return map;
}

/** @param {Map<string, number>} map */
function menorDiaIso(map) {
  const keys = [...map.keys()].filter((k) => k && k !== '—');
  if (!keys.length) return null;
  return keys.sort()[0];
}

/** @param {Map<string, number>} map */
function maiorDiaIso(map) {
  const keys = [...map.keys()].filter((k) => k && k !== '—');
  if (!keys.length) return null;
  return keys.sort().pop();
}

/**
 * Dias em que o OFX repete o que já está no banco: mesma quantidade de lançamentos no dia.
 * Reforço no último dia já gravado, no primeiro dia do arquivo e em todo o intervalo sobreposto.
 * @param {object[]} existente
 * @param {object[]} novo
 * @returns {Set<string>}
 */
export function diasIgnorarPorContagemIgual(existente, novo) {
  const ce = contagemLancamentosPorDia(existente);
  const cn = contagemLancamentosPorDia(novo);
  const ultimoBanco = maiorDiaIso(ce);
  const primeiroOfx = menorDiaIso(cn);
  /** @type {Set<string>} */
  const dias = new Set();

  const contagemIgualNoDia = (d) => {
    const ex = ce.get(d) || 0;
    const nx = cn.get(d) || 0;
    return ex > 0 && nx > 0 && ex === nx;
  };

  if (ultimoBanco && contagemIgualNoDia(ultimoBanco)) dias.add(ultimoBanco);
  if (primeiroOfx && contagemIgualNoDia(primeiroOfx)) dias.add(primeiroOfx);

  if (ultimoBanco && primeiroOfx) {
    for (const d of cn.keys()) {
      if (d >= primeiroOfx && d <= ultimoBanco && contagemIgualNoDia(d)) {
        dias.add(d);
      }
    }
  }

  return dias;
}

/**
 * @param {object[]} existente
 * @param {object[]} novo
 * @param {{ respeitarExtratoComoMestre?: boolean }} [opts]
 *   Quando true (PDF), não ignora dias inteiros só porque a contagem coincide com o banco.
 * @returns {{ novos: object[], ignorados: number, porDia: Map<string, { existentes: number, ofx: number, novos: number, ignorados: number, ignoradosContagemDia: number }>, diasIgnoradosPorContagem: string[] }}
 */
export function analisarLancamentosNovosDedupe(existente, novo, opts = {}) {
  const { estritas, semanticas } = construirContagens(existente);
  const numerosExistentes =
    opts.numerosExistentes instanceof Set ? opts.numerosExistentes : new Set();
  const diasIgnorarContagem = opts.respeitarExtratoComoMestre
    ? new Set()
    : diasIgnorarPorContagemIgual(existente, novo);
  const porDia = new Map();
  const novos = [];
  /** @type {Array<{ row: object, motivo: string }>} */
  const ignoradosDetalhe = [];
  let ignorados = 0;

  const bumpDia = (dataIso, field) => {
    const d = dataIso || '—';
    if (!porDia.has(d)) {
      porDia.set(d, { existentes: 0, ofx: 0, novos: 0, ignorados: 0, ignoradosContagemDia: 0 });
    }
    porDia.get(d)[field] += 1;
  };

  for (const t of existente || []) {
    bumpDia(dataLancamentoParaIso(t.data), 'existentes');
  }

  for (const t of novo || []) {
    const dataIso = dataLancamentoParaIso(t.data);
    bumpDia(dataIso, 'ofx');
    const numero = String(t?.numero ?? '').trim();
    if (numero && numerosExistentes.has(numero)) {
      ignorados += 1;
      bumpDia(dataIso, 'ignorados');
      ignoradosDetalhe.push({ row: t, motivo: 'numero_ja_no_banco' });
      continue;
    }
    if (diasIgnorarContagem.has(dataIso)) {
      ignorados += 1;
      bumpDia(dataIso, 'ignorados');
      bumpDia(dataIso, 'ignoradosContagemDia');
      ignoradosDetalhe.push({ row: t, motivo: 'contagem_dia_igual' });
      continue;
    }
    const ke = chaveDedupeLancamento(t);
    if (consumirDoMapa(estritas, ke)) {
      ignorados += 1;
      bumpDia(dataIso, 'ignorados');
      ignoradosDetalhe.push({ row: t, motivo: 'chave_estrita' });
      // Linha já gravada (mesmo FITID/nº): consome também o par semântico para não
      // bloquear outra linha idêntica do extrato (ex.: 2× SAQ 2.000 no mesmo dia).
      tentarConsumirSemantico(semanticas, t);
      continue;
    }
    if (tentarConsumirSemantico(semanticas, t)) {
      ignorados += 1;
      bumpDia(dataIso, 'ignorados');
      ignoradosDetalhe.push({ row: t, motivo: 'chave_semantica' });
      continue;
    }
    novos.push(t);
    bumpDia(dataIso, 'novos');
  }

  return {
    novos,
    ignorados,
    ignoradosDetalhe,
    porDia,
    diasIgnoradosPorContagem: [...diasIgnorarContagem].sort(),
  };
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
      contaContabilId: prevMeta.contaContabilId ?? null,
      clienteId: null,
      processoId: null,
    },
  };
}

/**
 * Quantos lançamentos de `novo` seriam acrescentados ao mesclar com `existente`.
 * Ignora só os que já constam no extrato/base (mesma chave: nº + data + valor em centavos).
 * Várias linhas idênticas no próprio arquivo `novo` contam todas, exceto as que batem com `existente`.
 */
export function contarLancamentosNovos(existente, novo, opts) {
  return analisarLancamentosNovosDedupe(existente, novo, opts).novos.length;
}

/**
 * Lista os lançamentos de `novo` que ainda não existem no extrato/base.
 * Compara FITID/nº (chave estrita) e data+valor+descrição normalizada (planilha vs OFX).
 * Duplicatas **dentro** de `novo` mantêm-se quando não há par em `existente`.
 */
export function listarLancamentosNovosDedupe(existente, novo, opts) {
  return analisarLancamentosNovosDedupe(existente, novo, opts).novos;
}

/**
 * Mescla lançamentos de um novo OFX/PDF com o extrato já existente.
 * Não remove linhas antigas.
 * Ignora apenas linhas do arquivo novo cuja chave (FITID/nº + data + valor) **já exista no extrato anterior**;
 * várias transações iguais **no mesmo arquivo** são todas incluídas (podem ser movimentos reais repetidos).
 * Recalcula saldo em ordem cronológica.
 */
export function mergeExtratoBancario(existente, novo) {
  const base = (existente || []).map((t) => ({ ...t }));
  const adicionados = [];
  for (const t of listarLancamentosNovosDedupe(existente, novo)) {
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
 * API como base; campos vazios na API reaproveitam o cache local (edições / sync pendente).
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
      contaContabilId: metaApi.contaContabilId ?? metaLoc.contaContabilId ?? null,
      clienteId: ignorarCacheVinculosImportacao
        ? metaApi.clienteId ?? null
        : metaApi.clienteId ?? metaLoc.clienteId ?? null,
      processoId: ignorarCacheVinculosImportacao
        ? metaApi.processoId ?? null
        : metaApi.processoId ?? metaLoc.processoId ?? null,
    },
  };
}

/**
 * Após GET na API financeira: `apiRows` reflete o servidor; `localRows` é cache (localStorage) ou base.
 * Entram todos os lançamentos da API; do local permanecem só os que **não** têm par na API
 * (mesma {@link chaveDedupeLancamento} ou mesmo `apiId`), para não sumirem OFX ainda não persistidos.
 * Linhas com a mesma chave: mescla campos locais quando a API ainda não os preencheu.
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

/** Sicoob envia MEMO genérico (tipo Pix) e NAME com contraparte — ex.: NAME "Recebimento Pix FULANO". */
function nameSicoobComContraparte(name, memo) {
  const n = String(name ?? '').trim();
  const m = String(memo ?? '').trim();
  if (!n || !m) return false;
  if (/^(RECEBIMENTO|PAGAMENTO)\s+PIX\b/i.test(n) && /PIX\s+(RECEBIDO|EMITIDO)/i.test(m)) {
    return true;
  }
  if (/^SAQ\.?\s*DIG/i.test(n) && /SAQUE/i.test(m)) {
    return true;
  }
  return false;
}

/**
 * Escolhe texto principal do lançamento OFX (coluna Descrição).
 * Itaú/Cora: MEMO costuma ter o detalhe; Sicoob: NAME traz a contraparte.
 */
export function escolherDescricaoPrincipalOfx(name, memo) {
  const n = normalizeWhitespace(name);
  const m = normalizeWhitespace(memo);
  if (!n && !m) return 'LANÇAMENTO';
  if (!n) return m;
  if (!m) return n;
  if (n === m) return n;
  if (nameSicoobComContraparte(n, m)) return n;
  const nameWords = n.split(/\s+/).length;
  const memoWords = m.split(/\s+/).length;
  if (n.length < m.length && memoWords > nameWords) return m;
  return n.length >= m.length ? n : m;
}

/** Observação / detalhe: preserva NAME e MEMO quando diferem do texto principal. */
export function montarDescricaoDetalhadaOfx(name, memo, trnType, descricaoPrincipal) {
  const principal = normalizeWhitespace(descricaoPrincipal);
  const n = normalizeWhitespace(name);
  const m = normalizeWhitespace(memo);
  const secundario = [];
  if (m && m !== principal) secundario.push(m);
  if (n && n !== principal && n !== m) secundario.push(n);
  if (!secundario.length) return trnType || '';
  const texto = secundario.join(' · ');
  return trnType ? `${trnType} — ${texto}` : texto;
}

export function montarDescricoesOfxStmtrn({ name, memo, trnType }) {
  const descricao = escolherDescricaoPrincipalOfx(name, memo);
  const descricaoDetalhada = montarDescricaoDetalhadaOfx(name, memo, trnType, descricao);
  return { descricao, descricaoDetalhada };
}

/**
 * Identificação da conta no arquivo OFX (tags BANKACCTFROM: BANKID, BRANCHID, ACCTID).
 * @returns {{ bankId: string, agencia: string, conta: string, acctType: string } | null}
 */
export function parseOfxContaBancaria(ofxText) {
  const txt = String(ofxText ?? '');
  const blockMatch = txt.match(/<BANKACCTFROM>[\s\S]*?<\/BANKACCTFROM>/i);
  const block = blockMatch ? blockMatch[0] : txt;
  const bankId = getTagValue(block, 'BANKID') || getTagValue(txt, 'FID');
  const agencia = getTagValue(block, 'BRANCHID');
  const conta = getTagValue(block, 'ACCTID');
  const acctType = getTagValue(block, 'ACCTTYPE');
  if (!bankId && !agencia && !conta) return null;
  return { bankId, agencia, conta, acctType };
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

  const idsUsados = new Set();
  const transacoes = stmts.map((b, idx) => {
    const trnAmt = parseNumberBRLike(getTagValue(b, 'TRNAMT'));
    const dtPosted = parseOfxDate(getTagValue(b, 'DTPOSTED'));
    const id = idLancamentoOfx(b, idx, idsUsados);
    const name = normalizeWhitespace(getTagValue(b, 'NAME'));
    const memo = normalizeWhitespace(getTagValue(b, 'MEMO'));
    const trnType = normalizeWhitespace(getTagValue(b, 'TRNTYPE'));
    const { descricao, descricaoDetalhada } = montarDescricoesOfxStmtrn({ name, memo, trnType });

    return {
      /** Conta contábil "Conta Não Identificados" — permanece até reclassificar no extrato ou via Parear compensações. */
      letra: 'N',
      numero: id,
      data: dtPosted,
      descricao: descricao,
      valor: trnAmt,
      saldo: 0,
      saldoDesc: '',
      descricaoDetalhada: descricaoDetalhada,
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
