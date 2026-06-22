import { request, postFormData, requestBlob } from '../api/httpClient.js';
import { API_BASE_URL } from '../api/config.js';
import { buildDefaultApiHeaders } from '../api/apiAuthHeaders.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  listarHistoricoPorData,
  listarProcessosFaseAguardandoProtocolo,
  listarProcessosPorPrazoFatal,
  normalizarDataBr,
} from '../data/processosHistoricoData.js';
import {
  agruparConsultasRealizadasPorProcesso,
  ehTituloHistoricoSistemaLegado,
} from '../domain/historicoTituloLegadoSistema.js';
import { getNomeExibicaoUsuario, isAssistenteIaUsuario } from '../data/usuarioDisplayHelpers.js';

function padCliente8(value) {
  const d = String(value ?? '').replace(/\D/g, '');
  const n = Number(d || '1');
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return String(safe).padStart(8, '0');
}

/** PK da tabela `cliente` (DTO GET /api/clientes ou /api/processos). */
export function clientePkFromApiDto(dto) {
  if (!dto) return null;
  const raw = dto.clienteId ?? dto.id;
  const pk = Number(raw);
  return Number.isFinite(pk) && pk > 0 ? pk : null;
}

/** `pessoa.id` do vínculo cliente ou titular do processo. */
export function pessoaIdFromApiDto(dto) {
  if (!dto) return null;
  const raw =
    dto.pessoaTitularId ?? dto.pessoaId ?? dto.pessoaRefId ?? dto.pessoa;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function toIsoFromBrDate(dateBr) {
  const s = String(dateBr ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

/** UI → API: `requerente` | `requerido` → REQUERENTE | REQUERIDO */
export function papelParteUiParaApi(ui) {
  const p = String(ui ?? '')
    .trim()
    .toLowerCase();
  return p === 'requerido' ? 'REQUERIDO' : p === 'requerente' ? 'REQUERENTE' : null;
}

/** API → UI */
export function papelParteApiParaUi(api) {
  const p = String(api ?? '')
    .trim()
    .toUpperCase();
  if (p === 'REQUERIDO') return 'requerido';
  if (p === 'REQUERENTE') return 'requerente';
  return 'requerente';
}

export function avisoAudienciaUiParaApi(ui) {
  const p = String(ui ?? '')
    .trim()
    .toLowerCase();
  if (p === 'avisado') return 'AVISADO';
  if (p === 'nao_avisado' || p === 'não_avisado') return 'NAO_AVISADO';
  return null;
}

export function avisoAudienciaApiParaUi(api) {
  const p = String(api ?? '')
    .trim()
    .toUpperCase();
  return p === 'AVISADO' ? 'avisado' : 'nao_avisado';
}

function normalizarHoraAudienciaCampo(val) {
  const t = String(val ?? '').trim().replace('.', ':');
  if (!t) return null;
  const m = /^(\d{1,2}):(\d{2})$/.exec(t);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h < 0 || h > 23 || min < 0 || min > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
}

function dataUtcParaBr(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mo = String(d.getUTCMonth() + 1).padStart(2, '0');
  const y = d.getUTCFullYear();
  return `${dd}/${mo}/${y}`;
}

/**
 * Spring/Jackson pode serializar datas/instants como {@code "yyyy-MM-dd"}, ISO-8601 com hora,
 * epoch em número, {@code [ano,mês,dia]}, objeto {@code LocalDate} ou {@code Instant} ({@code epochSecond}).
 */
function dataApiParaDataBr(data) {
  if (data == null) return '';
  if (typeof data === 'number' && Number.isFinite(data)) {
    const ms = data > 1_000_000_000_000 ? data : Math.round(data * 1000);
    return dataUtcParaBr(new Date(ms));
  }
  if (typeof data === 'string') {
    const t = data.trim();
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(t);
    if (m) return `${m[3]}/${m[2]}/${m[1]}`;
    return '';
  }
  if (Array.isArray(data) && data.length >= 3) {
    const y = data[0];
    const mo = String(Number(data[1])).padStart(2, '0');
    const d = String(Number(data[2])).padStart(2, '0');
    if (Number.isFinite(Number(y))) return `${d}/${mo}/${String(y)}`;
  }
  if (typeof data === 'object' && data != null) {
    const es = data.epochSecond ?? data.seconds;
    if (es !== undefined && es !== null && Number.isFinite(Number(es))) {
      const sec = Number(es);
      const nano = Number(data.nano ?? data.nanoOfSecond ?? data.nanoseconds ?? 0) || 0;
      const ms = sec * 1000 + Math.floor(nano / 1_000_000);
      return dataUtcParaBr(new Date(ms));
    }
    const y = Number(data.year);
    const mo = String(Number(data.monthValue ?? data.month ?? 1)).padStart(2, '0');
    const d = String(Number(data.dayOfMonth ?? data.day ?? 1)).padStart(2, '0');
    if (Number.isFinite(y)) return `${d}/${mo}/${String(y)}`;
  }
  return '';
}

function toBrFromIsoDate(dateIso) {
  return dataApiParaDataBr(dateIso);
}

function parseBooleanApi(value) {
  if (value === true || value === false) return value;
  if (typeof value === 'number') {
    if (value === 1) return true;
    if (value === 0) return false;
  }
  if (typeof value === 'string') {
    const v = value.trim().toLowerCase();
    if (v === 'true' || v === '1' || v === 'sim' || v === 's') return true;
    if (v === 'false' || v === '0' || v === 'nao' || v === 'não' || v === 'n') return false;
  }
  return null;
}

function resolverStatusAtivoApi(p) {
  const ativoDireto = parseBooleanApi(p?.ativo);
  if (ativoDireto != null) return ativoDireto;
  const inativoDireto = parseBooleanApi(p?.inativo);
  if (inativoDireto != null) return !inativoDireto;
  return true;
}

/** Exibe valor da causa (API numérica) no formato de campo BR (1.234,56). */
function formatarValorCausaApiParaCampoBr(val) {
  if (val == null || val === '') return '';
  const n = typeof val === 'number' ? val : Number(String(val).replace(/\./g, '').replace(',', '.'));
  if (!Number.isFinite(n)) return '';
  try {
    return new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
  } catch {
    return String(n);
  }
}

function latin1Somente(str) {
  for (let i = 0; i < str.length; i++) {
    if (str.charCodeAt(i) > 0xff) return false;
  }
  return true;
}

function temCjkProvavel(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x4e00 && c <= 0x9fff) return true;
    if (c >= 0x3040 && c <= 0x30ff) return true;
    if (c >= 0xac00 && c <= 0xd7af) return true;
  }
  return false;
}

function temParSurrogatoUtf16(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff) return true;
  }
  return false;
}

function temBlocoBoxDrawingOuSubstituicao(s) {
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0x2500 && c <= 0x257f) return true;
    if (c === 0xfffd) return true;
  }
  return false;
}

function temSequenciaMojibakeLatinEstendido(s) {
  if (s.length < 2) return false;
  if (s.includes('Ã') || s.includes('Â') || s.includes('â€')) return true;
  for (let i = 0; i < s.length - 1; i++) {
    const a = s.charCodeAt(i);
    const b = s.charCodeAt(i + 1);
    if (a === 0xc3 && b > 0x20) return true;
    if (a === 0xc2 && (b === 0xa9 || b === 0xae || b === 0xb0 || b === 0xaa || b === 0xa2)) return true;
  }
  return false;
}

function deveTentarReverterDuplaCamada(s) {
  if (latin1Somente(s)) return false;
  if (temCjkProvavel(s)) return false;
  if (temParSurrogatoUtf16(s)) return false;
  return temBlocoBoxDrawingOuSubstituicao(s) || temSequenciaMojibakeLatinEstendido(s);
}

function decodificarLatin1ComoUtf8Leniente(s) {
  if (!latin1Somente(s)) return s;
  const bytes = new Uint8Array(s.length);
  for (let j = 0; j < s.length; j++) bytes[j] = s.charCodeAt(j) & 0xff;
  return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function corrigirLatin1Utf8EmCadeia(s) {
  let cur = s;
  for (let pass = 0; pass < 6; pass++) {
    if (!latin1Somente(cur)) return cur;
    const bytes = new Uint8Array(cur.length);
    for (let j = 0; j < cur.length; j++) bytes[j] = cur.charCodeAt(j) & 0xff;
    let next;
    try {
      next = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    } catch {
      return cur;
    }
    if (next === cur) return cur;
    cur = next;
  }
  return cur;
}

function pontuacaoLegivelPortugues(s) {
  let sc = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if ((c >= 0x61 && c <= 0x7a) || (c >= 0x41 && c <= 0x5a) || (c >= 0x30 && c <= 0x39)) sc += 4;
    else if (c === 0x20 || c === 0x2e || c === 0x2c || c === 0x2d || c === 0x2f || c === 0x28 || c === 0x29)
      sc += 1;
    else if (c >= 0xc0 && c <= 0x24f) sc += 3;
    else if (c === 0xba || c === 0xaa) sc += 3;
    if (c >= 0x2500 && c <= 0x257f) sc -= 40;
    if (c === 0xfffd) sc -= 20;
  }
  return sc;
}

function reverterDuplaComTabelaLatin(b2, decodeLatin) {
  const latin = decodeLatin(b2);
  if (!latin1Somente(latin)) return null;
  let fixed = corrigirLatin1Utf8EmCadeia(latin);
  if (fixed === latin) {
    const leniente = decodificarLatin1ComoUtf8Leniente(latin);
    if (leniente !== latin) fixed = corrigirLatin1Utf8EmCadeia(leniente);
  }
  if (fixed === latin) return null;
  return fixed;
}

function escolherMelhorCandidatoDupla(original, a, b) {
  let best = null;
  let bestScore = -2147483648;
  for (const cand of [a, b]) {
    if (cand == null || cand === original) continue;
    const sc = pontuacaoLegivelPortugues(cand);
    if (sc > bestScore) {
      bestScore = sc;
      best = cand;
    }
  }
  return best;
}

/** U+251C + Latin estendido: ciclo na reversão byte; substituição direta (importação / tripla camada). */
function substituirClustersBlocoDesenhoU251c(s) {
  if (s == null || s.length === 0) return s;
  if (!s.includes('\u251c')) return s;
  let t = s;
  t = t.replaceAll('\u251c\u00e2\u00d4\u00c7\u00ed\u251c\u00e2\u00e3\u00c6', '\u00c7\u00c3');
  t = t.replaceAll('\u251c\u00e2\u00d4\u00c7\u2019', '\u00c9');
  t = t.replaceAll('\u251c\u00e2\u00d4\u00c7\u0027', '\u00c9');
  t = t.replaceAll('\u251c\u00e2\u00d4\u00c7\u2591', '\u00c9');
  t = t.replaceAll('\u251c\u00e2\u00e3\u00c6', '\u00c3');
  t = t.replaceAll('\u251c\u00e9\u252c\u00ac', '\u00aa');
  t = t.replaceAll('\u251c\u00e9\u00ac\u00aa', '\u00aa');
  return t;
}

function tentarUmaPassagemDuplaCodificacaoUtf8(s) {
  try {
    const b2 = new TextEncoder().encode(s);
    const iso = reverterDuplaComTabelaLatin(b2, (buf) => {
      let latin = '';
      for (let i = 0; i < buf.length; i++) latin += String.fromCharCode(buf[i]);
      return latin;
    });
    let cp = null;
    try {
      cp = reverterDuplaComTabelaLatin(b2, (buf) => new TextDecoder('windows-1252').decode(buf));
    } catch {
      /* charset opcional */
    }
    return escolherMelhorCandidatoDupla(s, iso, cp);
  } catch {
    return null;
  }
}

/**
 * UTF-8 lido como Latin-1 (ex.: "INQUÃ‰RITO" → "INQUÉRITO") e múltiplas camadas (├®┬¬ → ª).
 * Alinhado a {@code Utf8MojibakeUtil} no backend.
 */
function corrigirMojibakeUtf8(s) {
  if (s == null) return '';
  if (typeof s === 'number' && Number.isFinite(s)) {
    s = String(s);
  } else if (typeof s !== 'string') {
    return '';
  }
  if (s.length === 0) return s;
  let cur = s;
  if (deveTentarReverterDuplaCamada(cur)) {
    for (let k = 0; k < 10; k++) {
      const apos = tentarUmaPassagemDuplaCodificacaoUtf8(cur);
      if (apos == null) break;
      cur = apos;
    }
  }
  let out = corrigirLatin1Utf8EmCadeia(cur);
  out = substituirClustersBlocoDesenhoU251c(out);
  return corrigirLatin1Utf8EmCadeia(out);
}

/** Instant na API (Jackson): iso sem fuso falha ou é ambíguo; sempre UTC explícito. */
export function toIsoDateTimeFromBrDate(dateBr) {
  const isoDate = toIsoFromBrDate(dateBr);
  if (!isoDate) return null;
  return `${isoDate}T12:00:00.000Z`;
}

/** Tamanho de página alinhado ao default do backend para `codigoCliente` (GET em fatias). */
const PAGE_SIZE_LISTAGEM_CLIENTE = 100;

/** Evita loop infinito se a resposta paginada vier sem {@code last} ou com anomalia. */
const MAX_PAGES_LISTAGEM_PROCESSOS_CLIENTE = 500;

/**
 * Critério de parada da paginação Spring (`Page` JSON).
 * Não usar {@code chunk.length < pageSize} sozinho: backends com page size menor (ex.: 20)
 * devolvem {@code last=false} e o cliente pararia na 1ª página.
 */
export function devePararPaginacaoProcessosCliente(body, chunkLength, pageIndex, pageSize) {
  if (chunkLength === 0) return true;
  if (body?.last === true) return true;
  if (body?.last === false) return false;
  const totalPages = Number(body?.totalPages);
  if (Number.isFinite(totalPages) && totalPages > 0) {
    return pageIndex >= totalPages - 1;
  }
  return chunkLength < pageSize;
}

async function listarProcessosPorCodigoClientePaginado(codigoCliente, { resumo = false } = {}) {
  if (!featureFlags.useApiProcessos) return [];
  const cod = padCliente8(codigoCliente);
  const out = [];
  for (let page = 0; page < MAX_PAGES_LISTAGEM_PROCESSOS_CLIENTE; page++) {
    let body;
    try {
      body = await request('/api/processos', {
        query: {
          codigoCliente: cod,
          page: String(page),
          size: String(PAGE_SIZE_LISTAGEM_CLIENTE),
          sort: ['numeroInterno,asc', 'id,asc'],
          ...(resumo ? { resumo: 'true' } : {}),
        },
      });
    } catch (e) {
      throw e;
    }
    if (Array.isArray(body)) {
      return body;
    }
    const chunk = body?.content;
    if (!Array.isArray(chunk)) {
      throw new Error(
        'Resposta inválida ao listar processos por cliente: esperado Page JSON com content[] ou array legado.'
      );
    }
    out.push(...chunk);
    if (devePararPaginacaoProcessosCliente(body, chunk.length, page, PAGE_SIZE_LISTAGEM_CLIENTE)) {
      break;
    }
  }
  return out;
}

/** Listagem completa (inclui `parteOposta` montada a partir de partes na API). */
export async function listarProcessosPorCodigoCliente(codigoCliente) {
  return listarProcessosPorCodigoClientePaginado(codigoCliente, { resumo: false });
}

/**
 * Grade Clientes / combos (`?resumo=true`): listagem leve; textos parte cliente/oposta vêm de `processo_parte` na API.
 * Se a API antiga falhar com `resumo`, repete sem o parâmetro.
 */
export async function listarProcessosResumoPorCodigoCliente(codigoCliente) {
  try {
    return await listarProcessosPorCodigoClientePaginado(codigoCliente, { resumo: true });
  } catch (e) {
    const msg = String(e?.message ?? '');
    const retry =
      msg.includes('404') ||
      msg.includes('500') ||
      /resumo|No static resource|NoResourceFound|ECONNREFUSED|502|503|Bad Gateway/i.test(msg);
    if (!retry) throw e;
    return listarProcessosPorCodigoClientePaginado(codigoCliente, { resumo: false });
  }
}

/** Busca global pelo nº interno do processo (ex.: tela Clientes — vários clientes podem ter o mesmo nº). */
export async function listarProcessosPorNumeroInterno(numeroInterno) {
  if (!featureFlags.useApiProcessos) return [];
  const n = Math.floor(Number(numeroInterno));
  if (!Number.isFinite(n) || n < 0) return [];
  const lista = await request('/api/processos/por-numero-interno', {
    query: { numeroInterno: String(n) },
  });
  return Array.isArray(lista) ? lista : [];
}

/**
 * Diagnósticos «Busca pessoa»: processos em que a pessoa é cliente do processo, parte ou advogado(a).
 * Mesmo shape que {@code listarProcessosPorIdPessoa} no histórico local.
 */
export async function listarProcessosVinculoPessoaDiagnostico(pessoaId) {
  if (!featureFlags.useApiProcessos) return [];
  const pid = Math.floor(Number(pessoaId));
  if (!Number.isFinite(pid) || pid < 1) return [];
  const arr = await request(`/api/processos/vinculo-pessoa/${pid}`);
  if (!Array.isArray(arr)) return [];
  return arr.map((row) => {
    const codRaw = String(row.codigoCliente ?? '1').replace(/\D/g, '') || '1';
    const codN = Math.max(1, Math.floor(Number(codRaw)) || 1);
    const codCliente = String(codN).padStart(8, '0');
    const procNum = Number(row.numeroInterno);
    return {
      codCliente,
      proc: String(Number.isFinite(procNum) && procNum >= 0 ? procNum : 0),
      cliente: String(row.cliente ?? ''),
      parteCliente: String(row.parteCliente ?? row.cliente ?? ''),
      parteOposta: String(row.parteOposta ?? ''),
      numeroProcessoNovo: String(row.numeroProcessoNovo ?? ''),
      papeis: String(row.papeis ?? ''),
    };
  });
}

/**
 * Diagnósticos «Busca por número»: processos na API cujo CNJ coincide após normalização (pontos, traços, espaços).
 * @param {string} numeroBruto
 */
export async function listarProcessosPorNumeroProcessoDiagnostico(numeroBruto) {
  if (!featureFlags.useApiProcessos) return [];
  const q = String(numeroBruto ?? '').trim();
  if (!q) return [];
  const arr = await request('/api/processos/diagnostico/busca-numero', { query: { numero: q } });
  if (!Array.isArray(arr)) return [];
  return arr.map((row) => {
    const codRaw = String(row.codigoCliente ?? '1').replace(/\D/g, '') || '1';
    const codN = Math.max(1, Math.floor(Number(codRaw)) || 1);
    const codCliente = String(codN).padStart(8, '0');
    const procNum = Number(row.numeroInterno);
    return {
      codCliente,
      proc: String(Number.isFinite(procNum) && procNum >= 0 ? procNum : 0),
      cliente: String(row.cliente ?? ''),
      parteCliente: String(row.parteCliente ?? row.cliente ?? ''),
      parteOposta: String(row.parteOposta ?? ''),
      numeroProcessoNovo: String(row.numeroProcessoNovo ?? ''),
      papeis: String(row.papeis ?? ''),
    };
  });
}

function chaveClienteProcItemFase(item) {
  const cod = padCliente8(item.codCliente ?? item.codigoCliente);
  const pr = Math.floor(Number(String(item.proc ?? item.numeroInterno ?? '').replace(/\D/g, '')) || 0);
  return `${cod}-${String(pr).padStart(4, '0')}`;
}

/**
 * Diagnóstico «Aguardando Protocolo»: histórico local + processos na API com a mesma fase.
 */
export async function listarProcessosFaseAguardandoProtocoloDiagnostico() {
  const locais = listarProcessosFaseAguardandoProtocolo();
  if (!featureFlags.useApiProcessos) return locais;
  try {
    const arr = await request('/api/processos/diagnostico/aguardando-protocolo');
    const fromApi = (Array.isArray(arr) ? arr : []).map((row) => {
      const codCliente = padCliente8(row.codigoCliente ?? row.codigo_cliente ?? '1');
      const procNum = Number(row.numeroInterno ?? row.numero_interno);
      const proc = String(Number.isFinite(procNum) && procNum >= 0 ? procNum : 0);
      return {
        codCliente,
        proc,
        cliente: String(row.cliente ?? ''),
        parteCliente: String(row.parteCliente ?? row.cliente ?? ''),
        parteOposta: String(row.parteOposta ?? ''),
        numeroProcessoNovo: String(row.numeroProcessoNovo ?? row.numero_processo_novo ?? '').trim(),
        faseSelecionada: 'Protocolo / Movimentação',
      };
    });
    const m = new Map();
    for (const x of fromApi) m.set(chaveClienteProcItemFase(x), x);
    for (const x of locais) {
      const k = chaveClienteProcItemFase(x);
      if (!m.has(k)) m.set(k, x);
    }
    const out = [...m.values()];
    out.sort((a, b) => chaveClienteProcItemFase(a).localeCompare(chaveClienteProcItemFase(b)));
    return out;
  } catch {
    return locais;
  }
}

function mapItemAguardandoProtocoloParaApi(item) {
  const codCliente = padCliente8(item.codCliente ?? item.codigoCliente);
  const procNum = Math.floor(Number(String(item.proc ?? item.numeroInterno ?? '').replace(/\D/g, '')) || 0);
  return {
    codigoCliente: codCliente,
    numeroInterno: procNum,
    numeroProcessoNovo: String(item.numeroProcessoNovo ?? '').trim(),
  };
}

/**
 * Pré-registra PDFs da pasta Assinar (PENDENTE_ASSINATURA) e retorna peticaoIds para o ZIP.
 * @param {Array<{ codCliente: string, proc: string|number, numeroProcessoNovo?: string }>} processos
 * @param {number|string} credencialId
 */
export async function prepararAssinarAguardandoProtocolo(processos, credencialId) {
  const body = (Array.isArray(processos) ? processos : []).map(mapItemAguardandoProtocoloParaApi);
  if (!body.length) {
    throw new Error('Nenhum processo na lista.');
  }
  const cred = String(credencialId ?? '').trim();
  if (!cred) {
    throw new Error('Selecione a credencial PROJUDI.');
  }
  return request('/api/processos/diagnostico/aguardando-protocolo/preparar-assinar', {
    method: 'POST',
    query: { credencialId: cred },
    body,
  });
}

/**
 * ZIP com PDFs pendentes do lote preparado (nomes canônicos + manifest informativo).
 * @param {number[]} peticaoIds
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function baixarZipLoteAguardandoProtocolo(peticaoIds) {
  const ids = (Array.isArray(peticaoIds) ? peticaoIds : []).filter((id) => id != null);
  if (!ids.length) {
    throw new Error('Nenhuma petição no lote para baixar.');
  }
  const url = `${API_BASE_URL}/api/processos/diagnostico/aguardando-protocolo/lote-assinar-zip`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      ...buildDefaultApiHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ peticaoIds: ids }),
  });
  if (!res.ok) {
    let msg = `Erro ${res.status} ao gerar ZIP.`;
    try {
      const json = JSON.parse(await res.text());
      msg = json?.message || json?.error || msg;
    } catch {
      // corpo não-JSON (proxy HTML)
    }
    throw new Error(msg);
  }
  const blob = await res.blob();
  const disposition = res.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  const filename = match?.[1] || 'assinar-aguardando-protocolo.zip';
  return { blob, filename };
}

/**
 * Pareia .p7s assinados por hash (wrapper do POST /api/projudi/peticoes/assinados).
 * @param {File[]} arquivosP7s
 */
export async function uploadAssinadosAguardandoProtocolo(arquivosP7s, { substituir = false } = {}) {
  const arquivos = (Array.isArray(arquivosP7s) ? arquivosP7s : []).filter(Boolean);
  if (!arquivos.length) {
    throw new Error('Selecione ao menos um arquivo .p7s.');
  }
  const fd = new FormData();
  for (const f of arquivos) {
    fd.append('arquivosP7s', f);
  }
  if (substituir) {
    fd.append('substituir', 'true');
  }
  return postFormData('/api/processos/diagnostico/aguardando-protocolo/upload-assinados', fd);
}

function chaveClienteProcItemPrazoFatal(item) {
  const cod = padCliente8(item.codCliente ?? item.codigoCliente);
  const pr = Math.floor(Number(String(item.proc ?? item.numeroInterno ?? '').replace(/\D/g, '')) || 0);
  return `${cod}-${pr}`;
}

/**
 * Diagnóstico «Prazo fatal»: histórico local + processos na API com a mesma data (cadastro / prazos).
 */
function ordenarItensHistoricoDiagnostico(out) {
  out.sort((a, b) => {
    const na = Number(a.numero) || 0;
    const nb = Number(b.numero) || 0;
    if (nb !== na) return nb - na;
    return `${padCliente8(a.codCliente)}-${String(a.proc).padStart(4, '0')}`.localeCompare(
      `${padCliente8(b.codCliente)}-${String(b.proc).padStart(4, '0')}`,
    );
  });
  return out;
}

function chaveHistoricoDiagnosticoItem(x) {
  const info = String(x.info ?? '')
    .trim()
    .toLowerCase();
  return `${padCliente8(x.codCliente)}:${String(x.proc)}:${normalizarDataBr(x.data)}:${info}`;
}

function mapRowHistoricoDiagnosticoApi(row, dataCanon) {
  const info = String(row.info ?? '').trim();
  if (!info || ehTituloHistoricoSistemaLegado(info)) return null;
  const aid = row.andamentoId ?? row.andamento_id;
  return {
    codCliente: padCliente8(row.codigoCliente ?? row.codigo_cliente ?? '1'),
    proc: String(row.numeroInterno ?? row.numero_interno ?? ''),
    cliente: String(row.cliente ?? ''),
    parteCliente: String(row.parteCliente ?? row.cliente ?? ''),
    parteOposta: String(row.parteOposta ?? ''),
    numeroProcessoNovo: String(row.numeroProcessoNovo ?? row.numero_processo_novo ?? '').trim(),
    info,
    data: normalizarDataBr(row.data) || dataCanon,
    usuario: String(row.usuario ?? '').trim(),
    id: aid != null ? Number(aid) : Date.now(),
    fromApi: true,
    numero: aid != null ? String(aid).padStart(4, '0') : '',
  };
}

/**
 * Diagnóstico «Consultas Realizadas»: histórico na API na data do movimento + local.
 * Exclui títulos automáticos «JUNTAR PETIÇÃO…» / «PETIÇÃO DA INF. ANTERIOR…».
 */
/** Indica falha típica de backend desatualizado (endpoint ainda não publicado no JAR). */
export function erroEndpointHistoricoDataIndisponivel(err) {
  const msg = String(err?.message ?? err ?? '').toLowerCase();
  return (
    msg.includes('historico-data') ||
    msg.includes('no static resource') ||
    msg.includes('noresourcefound')
  );
}

export async function listarHistoricoPorDataDiagnostico(dataBrParam, opts = {}) {
  const umaLinhaPorProcesso = opts.umaLinhaPorProcesso !== false;
  const dataCanon = normalizarDataBr(String(dataBrParam ?? '').trim());
  if (!dataCanon) return [];
  const locais = listarHistoricoPorData(dataBrParam);
  const finalizar = (lista) => {
    const ordenada = ordenarItensHistoricoDiagnostico(lista);
    return umaLinhaPorProcesso ? agruparConsultasRealizadasPorProcesso(ordenada) : ordenada;
  };
  if (!featureFlags.useApiProcessos) return finalizar(locais);
  const q = String(dataBrParam ?? '').trim();
  if (!q) return finalizar(locais);
  try {
    const arr = await request('/api/processos/diagnostico/historico-data', { query: { data: q } });
    const apiRows = Array.isArray(arr) ? arr : [];
    const fromApi = apiRows.map((row) => mapRowHistoricoDiagnosticoApi(row, dataCanon)).filter(Boolean);
    if (fromApi.length === 0) return finalizar(locais);
    if (locais.length === 0) return finalizar(fromApi);
    const seen = new Set();
    const merged = [];
    for (const item of [...fromApi, ...locais]) {
      const k = chaveHistoricoDiagnosticoItem(item);
      if (seen.has(k)) continue;
      seen.add(k);
      merged.push(item);
    }
    return finalizar(merged);
  } catch (e) {
    if (locais.length > 0) return finalizar(locais);
    if (erroEndpointHistoricoDataIndisponivel(e)) throw e;
    return finalizar(locais);
  }
}

export async function listarProcessosPorPrazoFatalDiagnostico(dataBrParam) {
  const locais = listarProcessosPorPrazoFatal(dataBrParam);
  const dataCanon =
    normalizarDataBr(String(dataBrParam ?? '').trim()) || String(dataBrParam ?? '').trim();
  if (!featureFlags.useApiProcessos) return locais;
  const q = String(dataBrParam ?? '').trim();
  if (!q) return locais;
  try {
    const arr = await request('/api/processos/diagnostico/prazo-fatal', { query: { data: q } });
    const apiRows = Array.isArray(arr) ? arr : [];
    const fromApi = apiRows.map((row) => {
      const codCliente = padCliente8(row.codigoCliente ?? row.codigo_cliente ?? '1');
      const procNum = Number(row.numeroInterno ?? row.numero_interno);
      const proc = String(Number.isFinite(procNum) && procNum >= 1 ? procNum : 0);
      return {
        codCliente,
        proc,
        cliente: String(row.cliente ?? ''),
        parteCliente: String(row.parteCliente ?? row.cliente ?? ''),
        parteOposta: String(row.parteOposta ?? ''),
        numeroProcessoNovo: String(row.numeroProcessoNovo ?? row.numero_processo_novo ?? '').trim(),
        prazoFatal: dataCanon,
        papeis: String(row.papeis ?? ''),
        observacaoFase: String(row.observacaoFase ?? row.observacao_fase ?? '').trim(),
      };
    });
    const out = [...fromApi];
    out.sort((a, b) => {
      const ka = `${padCliente8(a.codCliente)}-${String(a.proc).padStart(4, '0')}`;
      const kb = `${padCliente8(b.codCliente)}-${String(b.proc).padStart(4, '0')}`;
      return ka.localeCompare(kb);
    });
    return out;
  } catch {
    return locais;
  }
}

function extrairProcessoDaRespostaChaveNatural(body, numeroInternoAlvo) {
  const ni = Math.floor(Number(numeroInternoAlvo));
  if (body == null) return null;
  if (Array.isArray(body)) {
    return body.find((p) => Number(p?.numeroInterno) === ni) ?? null;
  }
  if (typeof body === 'object' && Array.isArray(body.content)) {
    return body.content.find((p) => Number(p?.numeroInterno) === ni) ?? null;
  }
  if (typeof body === 'object' && body.id != null && Number.isFinite(Number(body.id))) {
    if (!Number.isFinite(ni) || ni < 0) return body;
    const niResp = Number(body.numeroInterno);
    return !Number.isFinite(niResp) || niResp === ni ? body : null;
  }
  return null;
}

export async function buscarProcessoPorChaveNatural(codigoCliente, numeroInterno) {
  if (!featureFlags.useApiProcessos) return null;
  const cod = padCliente8(codigoCliente);
  const procNum = Number(numeroInterno);
  if (!Number.isFinite(procNum) || procNum < 0) return null;
  const ni = Math.floor(procNum);
  try {
    const body = await request('/api/processos', {
      query: { codigoCliente: cod, numeroInterno: String(ni) },
    });
    const direto = extrairProcessoDaRespostaChaveNatural(body, ni);
    if (direto) return direto;
    /** Backend Docker antigo ignora `numeroInterno` e devolve só a 1.ª página — varrer listagem. */
    if (body != null && typeof body === 'object' && Array.isArray(body.content)) {
      const todos = await listarProcessosPorCodigoClientePaginado(cod);
      return todos.find((p) => Number(p?.numeroInterno) === ni) ?? null;
    }
    return null;
  } catch (e) {
    const msg = String(e?.message ?? '');
    if (msg.includes('404') || /não encontrad/i.test(msg)) return null;
    throw e;
  }
}

/**
 * Alinha a grade «Processo» do cadastro de clientes com GET /api/processos (mesmo CNJ / nº novo que em Processos).
 * Faz match por {@code numeroInterno} da API ↔ {@code procNumero} da linha.
 */
export function mergeCadastroClientesProcessosComApi(codigoClientePadded8, listaProcessos, apiListaRaw) {
  const apiRows = Array.isArray(apiListaRaw) ? apiListaRaw : [];
  if (apiRows.length === 0) {
    return Array.isArray(listaProcessos) ? listaProcessos : [];
  }
  const padded = padCliente8(codigoClientePadded8);
  const codN =
    (() => {
      const d = String(padded).replace(/\D/g, '');
      const n = Number(d || '1');
      return Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
    })();

  const byNum = new Map();
  for (const raw of apiRows) {
    const ui = mapApiProcessoToUiShape(raw);
    const n = Number(ui.numeroInterno);
    if (!Number.isFinite(n) || n < 1) continue;
    byNum.set(n, ui);
  }

  const base = Array.isArray(listaProcessos) ? [...listaProcessos] : [];
  const seen = new Set();

  const out = base.map((row) => {
    const n = Number(row?.procNumero);
    if (Number.isFinite(n) && n >= 1) seen.add(n);
    const api = byNum.get(n);
    if (!api) return row;

    const novoApi = String(api.numeroProcessoNovo ?? '').trim();
    const velhoApi = String(api.numeroProcessoVelho ?? '').trim();
    const descApi = String(api.descricaoAcao ?? api.naturezaAcao ?? '').trim();
    const poApi = String(api.parteOposta ?? api.parte_oposta ?? '').trim();
    const pcApi = String(api.parteCliente ?? api.parte_cliente ?? api.titularNome ?? '').trim();
    const poRow = String(row.parteOposta ?? row.reu ?? '').trim();
    const pcRow = String(row.parteCliente ?? row.autor ?? '').trim();

    const unidadeApi = String(api.unidade ?? '').trim();
    return {
      ...row,
      processoNovo: novoApi || String(row.processoNovo ?? '').trim() || row.processoNovo,
      processoVelho: velhoApi || String(row.processoVelho ?? '').trim() || row.processoVelho,
      descricao: descApi || String(row.descricao ?? '').trim() || row.descricao,
      parteOposta: poApi || poRow || row.parteOposta,
      reu: poApi || poRow || row.reu,
      parteCliente: pcApi || pcRow || row.parteCliente,
      autor: pcApi || pcRow || row.autor,
      titularNome: String(api.titularNome ?? '').trim() || row.titularNome,
      unidade: unidadeApi || String(row.unidade ?? '').trim() || row.unidade,
      unidadeEndereco: unidadeApi || String(row.unidadeEndereco ?? row.unidade ?? '').trim(),
      statusAtivo: api.statusAtivo !== false,
    };
  });

  for (const [n, api] of byNum) {
    if (seen.has(n)) continue;
    seen.add(n);
    const poNovo = String(api.parteOposta ?? api.parte_oposta ?? '').trim();
    const pcNovo = String(api.parteCliente ?? api.parte_cliente ?? api.titularNome ?? '').trim();
    const unidadeNovo = String(api.unidade ?? '').trim();
    out.push({
      id: `${codN}-${n}`,
      procNumero: n,
      processoVelho: String(api.numeroProcessoVelho ?? '').trim() || '-',
      processoNovo: String(api.numeroProcessoNovo ?? '').trim(),
      autor: pcNovo || '—',
      reu: poNovo || '—',
      parteOposta: poNovo || '—',
      parteCliente: pcNovo || '—',
      titularNome: String(api.titularNome ?? '').trim(),
      tipoAcao: '',
      descricao: String(api.descricaoAcao ?? api.naturezaAcao ?? '').trim(),
      unidade: unidadeNovo,
      unidadeEndereco: unidadeNovo,
      statusAtivo: api.statusAtivo !== false,
    });
  }

  out.sort((a, b) => (Number(a.procNumero) || 0) - (Number(b.procNumero) || 0));
  return out;
}

export async function buscarProcessoPorId(processoId) {
  if (!featureFlags.useApiProcessos) return null;
  if (!Number.isFinite(Number(processoId))) return null;
  return request(`/api/processos/${Number(processoId)}`);
}

export async function resolverProcessoId({ processoId, codigoCliente, numeroInterno }) {
  if (!featureFlags.useApiProcessos) return null;
  if (Number.isFinite(Number(processoId)) && Number(processoId) > 0) return Number(processoId);
  const byNatural = await buscarProcessoPorChaveNatural(codigoCliente, numeroInterno);
  return byNatural?.id ?? null;
}

export async function buscarClientePorCodigo(codigoCliente) {
  if (!featureFlags.useApiProcessos) return null;
  const cod = padCliente8(codigoCliente);
  try {
    return await request('/api/clientes/resolucao', { query: { codigoCliente: cod } });
  } catch {
    return null;
  }
}

export async function salvarCabecalhoProcesso(payload) {
  if (!featureFlags.useApiProcessos) return null;
  const processoId = await resolverProcessoId(payload);
  const nat = String(payload.naturezaAcao ?? '').trim() || null;
  const titularRaw = payload.pessoaTitularId ?? payload.pessoaId;
  const body = {
    clienteId: Number(payload.clienteId),
    pessoaTitularId:
      titularRaw != null && Number.isFinite(Number(titularRaw)) && Number(titularRaw) > 0
        ? Number(titularRaw)
        : null,
    numeroInterno: Number(payload.numeroInterno),
    numeroCnj: payload.numeroProcessoNovo || null,
    numeroProcessoAntigo: payload.numeroProcessoVelho || null,
    naturezaAcao: nat,
    descricaoAcao: nat,
    competencia: payload.competencia || null,
    fase: payload.faseSelecionada || null,
    observacaoFase: payload.faseCampo || null,
    tramitacao: (payload.procedimento || payload.tramitacao || '').trim() || null,
    pjeTribunal: String(payload.pjeTribunal ?? '').trim() || null,
    pjeGrau: String(payload.pjeGrau ?? '').trim() || null,
    dataProtocolo: toIsoFromBrDate(payload.dataProtocolo),
    prazoFatal: toIsoFromBrDate(payload.prazoFatal),
    proximaConsulta: toIsoFromBrDate(payload.proximaConsultaData),
    observacao: String(payload.observacao ?? '').trim() || null,
    valorCausa: payload.valorCausaNumero ?? null,
    uf: payload.estado || null,
    cidade: payload.cidade || null,
    consultaAutomatica: payload.consultaAutomatica === true,
    ativo: payload.statusAtivo !== false,
    consultor: payload.responsavel || null,
    usuarioResponsavelId:
      payload.usuarioResponsavelId != null &&
      String(payload.usuarioResponsavelId).trim() !== '' &&
      Number.isFinite(Number(payload.usuarioResponsavelId)) &&
      Number(payload.usuarioResponsavelId) > 0
        ? Number(payload.usuarioResponsavelId)
        : null,
    unidade: String(payload.unidade ?? '').trim() || null,
    pasta: String(payload.pasta ?? '').trim() || null,
    papelCliente: papelParteUiParaApi(payload.papelParte),
    audienciaData: toIsoFromBrDate(payload.audienciaData),
    audienciaHora: normalizarHoraAudienciaCampo(payload.audienciaHora),
    audienciaTipo: String(payload.audienciaTipo ?? '').trim() || null,
    avisoAudiencia: avisoAudienciaUiParaApi(payload.avisoAudiencia),
  };
  if (processoId) {
    return request(`/api/processos/${processoId}`, { method: 'PUT', body });
  }
  return request('/api/processos', { method: 'POST', body });
}

export async function alterarAtivoProcesso(processoId, ativo) {
  if (!featureFlags.useApiProcessos) return null;
  return request(`/api/processos/${processoId}/ativo`, {
    method: 'PATCH',
    query: { value: ativo ? 'true' : 'false' },
  });
}

export async function listarPartesProcesso(processoId) {
  if (!featureFlags.useApiProcessos) return [];
  const pid = await resolverProcessoId({ processoId });
  if (!pid) return [];
  return request(`/api/processos/${pid}/partes`);
}

function assinaturaParte(p) {
  return `${p.polo}|${p.pessoaId ?? ''}|${String(p.nomeLivre ?? '').trim().toLowerCase()}|${p.ordem ?? 0}`;
}

export async function sincronizarPartesIncremental(processoId, partes) {
  if (!featureFlags.useApiProcessos) return [];
  const pid = await resolverProcessoId({ processoId });
  if (!pid) return [];

  const atuais = await listarPartesProcesso(pid);
  const atuaisPorAssinatura = new Map((atuais || []).map((p) => [assinaturaParte(p), p]));
  const desejadas = (partes || []).map((p) => ({
    pessoaId: p.pessoaId ?? null,
    nomeLivre: p.nomeLivre ?? null,
    polo: p.polo,
    qualificacao: p.qualificacao ?? null,
    ordem: p.ordem ?? 0,
    advogadoPessoaIds: Array.isArray(p.advogadoPessoaIds) ? p.advogadoPessoaIds.map(Number).filter(Number.isFinite) : [],
  }));
  const desejadasAss = new Set(desejadas.map(assinaturaParte));

  for (const atual of atuais || []) {
    if (!desejadasAss.has(assinaturaParte(atual))) {
      await request(`/api/processos/${pid}/partes/${atual.id}`, { method: 'DELETE' });
    }
  }

  const out = [];
  for (const p of desejadas) {
    const chave = assinaturaParte(p);
    const atual = atuaisPorAssinatura.get(chave);
    if (atual?.id) {
      const updated = await request(`/api/processos/${pid}/partes/${atual.id}`, {
        method: 'PUT',
        body: p,
      });
      out.push(updated);
      continue;
    }
    const created = await request(`/api/processos/${pid}/partes`, {
      method: 'POST',
      body: p,
    });
    out.push(created);
  }
  return out;
}

export async function listarAndamentosProcesso(processoId) {
  if (!featureFlags.useApiProcessos) return [];
  const n = Number(processoId);
  const pid = Number.isFinite(n) && n > 0 ? n : await resolverProcessoId({ processoId });
  if (!pid || !Number.isFinite(Number(pid)) || Number(pid) < 1) return [];
  return request(`/api/processos/${Number(pid)}/andamentos`);
}

/**
 * Só a parte calendário (YYYY-MM-DD), para casar o envio local `…T12:00:00` com `Instant` da API
 * (offset / Z / milissegundos). Sem isso, o segundo sync apagava andamentos novos: o id real não
 * estava em `idsDesejados` (a UI ainda tinha `Date.now()`) e a assinatura completa não batia.
 */
function dataChaveAndamento(movimentoEm) {
  if (movimentoEm == null) return '';
  if (typeof movimentoEm === 'number' && Number.isFinite(movimentoEm)) {
    const ms = movimentoEm > 1_000_000_000_000 ? movimentoEm : Math.round(movimentoEm * 1000);
    const d = new Date(ms);
    if (Number.isNaN(d.getTime())) return '';
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof movimentoEm === 'object' && movimentoEm != null && !Array.isArray(movimentoEm)) {
    const es = movimentoEm.epochSecond ?? movimentoEm.seconds;
    if (es !== undefined && es !== null && Number.isFinite(Number(es))) {
      const sec = Number(es);
      const nano = Number(movimentoEm.nano ?? movimentoEm.nanoOfSecond ?? movimentoEm.nanoseconds ?? 0) || 0;
      const ms = sec * 1000 + Math.floor(nano / 1_000_000);
      const d = new Date(ms);
      if (Number.isNaN(d.getTime())) return '';
      return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    }
  }
  const s = String(movimentoEm ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
}

/** Assinatura estável para merge incremental (API + linhas novas na UI). Exportada para testes. */
export function assinaturaAndamento(h) {
  const movRaw = h?.movimentoEm ?? h?.movimento_em;
  const tituloRaw = h?.titulo ?? h?.info ?? '';
  return `${dataChaveAndamento(movRaw)}|${String(tituloRaw).trim().toLowerCase()}`;
}

export async function sincronizarAndamentosIncremental(processoId, historico) {
  if (!featureFlags.useApiProcessos) return [];
  const n = Number(processoId);
  const pid = Number.isFinite(n) && n > 0 ? n : await resolverProcessoId({ processoId });
  if (!pid || !Number.isFinite(Number(pid)) || Number(pid) < 1) return [];

  const atuais = await listarAndamentosProcesso(pid);
  const atuaisPorId = new Map((atuais || []).map((a) => [Number(a.id), a]));
  const atuaisPorAssinatura = new Map((atuais || []).map((a) => [assinaturaAndamento(a), a]));
  const desejados = (historico || []).map((h) => ({
    id: resolverIdAndamentoPersistido(h),
    movimentoEm: toIsoDateTimeFromBrDate(h.data) || new Date().toISOString(),
    titulo: String(h.info || '').slice(0, 500) || 'Andamento',
    detalhe: null,
    origem: 'MANUAL',
    origemAutomatica: false,
    usuarioId: (() => {
      const uid = Number(h.usuarioId);
      return Number.isFinite(uid) && uid >= 1 ? uid : null;
    })(),
  }));
  const idsDesejados = new Set(desejados.map((d) => d.id).filter((x) => x != null));

  if (desejados.length === 0) {
    for (const atual of atuais || []) {
      await request(`/api/processos/${pid}/andamentos/${atual.id}`, { method: 'DELETE' });
    }
    return [];
  }

  /** Sem nenhuma âncora de id do servidor na lista desejada: estado da UI incompleta (ex.: só linhas novas). */
  const temAncorasApiServidor = desejados.some((d) => d.id != null);
  if ((atuais || []).length > 0 && temAncorasApiServidor) {
    for (const atual of atuais || []) {
      const idNum = Number(atual.id);
      if (!idsDesejados.has(idNum)) {
        const assinaturaExiste = desejados.some((d) => assinaturaAndamento(d) === assinaturaAndamento(atual));
        if (!assinaturaExiste) {
          await request(`/api/processos/${pid}/andamentos/${atual.id}`, { method: 'DELETE' });
        }
      }
    }
  }

  const out = [];
  for (const d of desejados) {
    const byId = d.id ? atuaisPorId.get(d.id) : null;
    const bySignature = atuaisPorAssinatura.get(assinaturaAndamento(d));
    const alvo = byId || bySignature;
    if (alvo?.id) {
      const atualizado = await request(`/api/processos/${pid}/andamentos/${alvo.id}`, {
        method: 'PUT',
        body: d,
      });
      out.push(atualizado);
      continue;
    }
    const criado = await request(`/api/processos/${pid}/andamentos`, {
      method: 'POST',
      body: d,
    });
    out.push(criado);
  }
  return out;
}

/** Histórico importado: linha com `detalhe` tipo "Consultor: NOME" sem `usuario_id`. */
function extrairNomeConsultorDeDetalhe(detalhe) {
  const s = String(detalhe ?? '').trim();
  if (!s) return '';
  const lines = s.split(/\r?\n/);
  for (const line of lines) {
    const t = line.trim();
    const m = /^\s*Consultor:\s*(.+)$/i.exec(t);
    if (m) return m[1].trim();
  }
  const m2 = /Consultor:\s*([^\r\n]+)/i.exec(s);
  return m2 ? m2[1].trim() : '';
}

/**
 * Texto integral importado em `detalhe` (tipo 15 longo), com prefixo Consultor.
 * @param {unknown} detalhe
 * @param {unknown} tituloCampo
 * @returns {string | null}
 */
function extrairInformacaoCompletaDeDetalhe(detalhe, tituloCampo) {
  const s = String(detalhe ?? '').trim();
  if (!s) return null;

  const comConsultor = /^Consultor:\s*.+\n\n([\s\S]+)$/i.exec(s);
  if (comConsultor && comConsultor[1].trim().length > 500) {
    return comConsultor[1].trim();
  }

  const tit = String(tituloCampo ?? '').trim();
  if (s.length > 500) {
    if (tit && s.startsWith(tit)) return s;
    if (!tit) return s;
  }
  return null;
}

/**
 * Import planilha grava responsável catalogado em `detalhe` (usuarioId null).
 * Só usa `detalhe` como nome quando o título já veio preenchido (evita duplicar texto da informação).
 */
function extrairResponsavelPlanilhaDeDetalhe(detalhe, tituloPreenchido) {
  if (!tituloPreenchido) return '';
  const consultor = extrairNomeConsultorDeDetalhe(detalhe);
  if (consultor) return consultor;
  const s = String(detalhe ?? '').trim();
  if (!s) return '';
  const lines = s
    .split(/\r?\n/)
    .map((x) => x.trim())
    .filter((x) => x.length > 0);
  if (lines.length !== 1) return '';
  const line = lines[0];
  if (/^\s*Consultor:/i.test(line)) return '';
  if (line.length > 120) return '';
  return line;
}

export async function listarPrazosProcesso(processoId) {
  if (!featureFlags.useApiProcessos) return [];
  const n = Number(processoId);
  const pid = Number.isFinite(n) && n > 0 ? n : await resolverProcessoId({ processoId });
  if (!pid || !Number.isFinite(Number(pid)) || Number(pid) < 1) return [];
  return request(`/api/processos/${Number(pid)}/prazos`);
}

export async function upsertPrazoFatalProcesso(processoId, prazoFatalBr) {
  if (!featureFlags.useApiProcessos) return null;
  const n = Number(processoId);
  const pid = Number.isFinite(n) && n > 0 ? n : await resolverProcessoId({ processoId });
  if (!pid || !Number.isFinite(Number(pid)) || Number(pid) < 1) return null;
  const pidNum = Number(pid);
  const prazos = await listarPrazosProcesso(pid);
  const prazosFatais = (prazos || []).filter((p) => p.prazoFatal === true);

  const dataFim = toIsoFromBrDate(prazoFatalBr);
  if (!dataFim) {
    if (prazosFatais.length === 0) return null;
    const cancelados = [];
    for (const pf of prazosFatais) {
      if (!pf?.id) continue;
      const fim = pf.dataFim ?? pf.data_fim;
      if (!fim) continue;
      cancelados.push(
        await request(`/api/processos/${pidNum}/prazos/${pf.id}`, {
          method: 'PUT',
          body: {
            andamentoId: pf.andamentoId ?? pf.andamento_id ?? null,
            descricao: pf.descricao ?? 'Prazo fatal do processo',
            dataInicio: pf.dataInicio ?? pf.data_inicio ?? null,
            dataFim: fim,
            prazoFatal: false,
            status: 'CANCELADO',
            observacao: pf.observacao ?? null,
          },
        })
      );
    }
    return cancelados.length === 1 ? cancelados[0] : cancelados.length ? cancelados : null;
  }

  const prazoFatal = prazosFatais[0];
  const body = {
    andamentoId: null,
    descricao: 'Prazo fatal do processo',
    dataInicio: null,
    dataFim,
    prazoFatal: true,
    status: prazoFatal?.status || 'PENDENTE',
    observacao: null,
  };
  if (prazoFatal?.id) {
    return request(`/api/processos/${pidNum}/prazos/${prazoFatal.id}`, {
      method: 'PUT',
      body,
    });
  }
  return request(`/api/processos/${pidNum}/prazos`, { method: 'POST', body });
}

/** Rótulo do utilizador na grade «Histórico»: sempre em maiúsculas (apelido / login). */
export function formatarUsuarioHistoricoExibicao(s) {
  const t = String(s ?? '').trim();
  if (!t) return '';
  try {
    return t.toLocaleUpperCase('pt-BR');
  } catch {
    return t.toUpperCase();
  }
}

/**
 * Exibe só apelido (ou login) do utilizador — nunca o nome civil gravado em andamentos antigos.
 * @param {{ usuario?: string, usuarioId?: number|null }} entrada
 * @param {Array<{ id?: string|number, apelido?: string, login?: string, nome?: string }>} [usuariosAtivos]
 */
export function usuarioHistoricoParaExibicao(entrada, usuariosAtivos = []) {
  return usuarioHistoricoAutorMeta(entrada, usuariosAtivos).rotulo;
}

/** Localiza utilizador no catálogo por id, login da API ou rótulo já gravado na linha. */
function localizarUsuarioHistoricoNoCatalogo(entrada, usuariosAtivos) {
  const lista = Array.isArray(usuariosAtivos) ? usuariosAtivos : [];
  const uid = entrada?.usuarioId;
  if (uid != null) {
    const porId = lista.find((x) => Number(x.id) === Number(uid));
    if (porId) return porId;
  }
  const loginApi = String(entrada?.usuarioLogin ?? '').trim();
  if (loginApi) {
    const lg = normalizarRotuloUsuarioHistorico(loginApi);
    const porLogin = lista.find((x) => normalizarRotuloUsuarioHistorico(x.login) === lg);
    if (porLogin) return porLogin;
  }
  const linhaNorm = normalizarRotuloUsuarioHistorico(entrada?.usuario);
  if (!linhaNorm) return null;
  return (
    lista.find((x) => {
      const candidatos = [x.apelido, x.login]
        .map((c) => normalizarRotuloUsuarioHistorico(c))
        .filter(Boolean);
      return candidatos.some((c) => c === linhaNorm);
    }) ?? null
  );
}

/**
 * Metadados do autor no histórico/andamento — inclui flag para selo IA.
 * Prioridade: apelido no catálogo → rótulo da API/linha (já é apelido no servidor) → login do catálogo.
 * @returns {{ rotulo: string, usuario: object|null, isAssistenteIa: boolean }}
 */
export function usuarioHistoricoAutorMeta(entrada, usuariosAtivos = []) {
  const u = localizarUsuarioHistoricoNoCatalogo(entrada, usuariosAtivos);
  const apelidoCat = u ? String(u.apelido ?? '').trim() : '';
  if (apelidoCat) {
    return {
      rotulo: formatarUsuarioHistoricoExibicao(apelidoCat),
      usuario: u,
      isAssistenteIa: isAssistenteIaUsuario(u),
    };
  }
  const linha = formatarUsuarioHistoricoExibicao(entrada?.usuario ?? '');
  if (linha) {
    return {
      rotulo: linha,
      usuario: u,
      isAssistenteIa: isAssistenteIaUsuario(u),
    };
  }
  if (u) {
    const rotulo = getNomeExibicaoUsuario(u);
    if (rotulo && rotulo !== '—') {
      return {
        rotulo: formatarUsuarioHistoricoExibicao(rotulo),
        usuario: u,
        isAssistenteIa: isAssistenteIaUsuario(u),
      };
    }
  }
  return {
    rotulo: '',
    usuario: null,
    isAssistenteIa: false,
  };
}

export function mapApiAndamentoToHistoricoItem(a, idx = 0, total = 1) {
  const movRaw = a?.movimentoEm ?? a?.movimento_em;
  const tituloCampo = a?.titulo ?? a?.tituloAndamento ?? a?.titulo_andamento;
  const det = a?.detalhe != null ? String(a.detalhe) : '';
  const infoCompleta = extrairInformacaoCompletaDeDetalhe(det, tituloCampo);
  const primeiraLinhaDet = det
    ? det
        .split(/\r?\n/)
        .map((x) => x.trim())
        .find((x) => x.length > 0) ?? ''
    : '';
  const tituloRaw = infoCompleta || String(tituloCampo ?? '').trim() || primeiraLinhaDet;
  const tituloPreenchido = String(tituloCampo ?? '').trim().length > 0 || Boolean(infoCompleta);
  const idNum = Number(a?.id);
  const nome = String(a?.usuarioNome ?? a?.usuario_nome ?? '').trim();
  const login = String(a?.usuarioLogin ?? a?.usuario_login ?? '').trim();
  const responsavelPlanilha = extrairResponsavelPlanilhaDeDetalhe(a?.detalhe, tituloPreenchido);
  const usuario = formatarUsuarioHistoricoExibicao(nome || login || responsavelPlanilha);
  const infoTxt = String(tituloRaw ?? '').trim() || 'Andamento';
  const usuarioIdRaw = a?.usuarioId ?? a?.usuario_id;
  const usuarioIdNum = Number(usuarioIdRaw);
  const persistidoServidor = Number.isFinite(idNum) && idNum >= 1;
  return {
    id: persistidoServidor ? idNum : Date.now() + idx,
    fromApi: persistidoServidor,
    inf: String(total - idx).padStart(2, '0'),
    info: infoCompleta || (infoTxt.length > 500 ? infoTxt.slice(0, 500) : infoTxt),
    data: toBrFromIsoDate(movRaw),
    usuario,
    usuarioLogin: login || null,
    usuarioId: Number.isFinite(usuarioIdNum) && usuarioIdNum >= 1 ? usuarioIdNum : null,
    numero: String(total - idx).padStart(4, '0'),
  };
}

/**
 * `id` vindo da linha histórico na UI: só confiamos como FK do servidor quando veio da API
 * ({@link mapApiAndamentoToHistoricoItem}) ou legado com id pequeno. Linhas novas usavam {@code Date.now()}
 * e faziam {@link sincronizarAndamentosIncremental} apagar todos os andamentos do processo antes do POST.
 */
export function resolverIdAndamentoPersistido(h) {
  const n = Number(h?.id);
  if (!Number.isFinite(n) || n < 1) return null;
  if (h?.fromApi === false) return null;
  if (h?.fromApi === true) return n;
  if (n >= 100_000_000_000) return null;
  return n;
}

function normalizarRotuloUsuarioHistorico(s) {
  return String(s ?? '')
    .trim()
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

/** Compara responsável da linha com o perfil ativo (apelido/login/id ou usuarioId). */
export function entradaHistoricoPertenceAoUsuarioAtivo(entrada, { perfilId, usuariosAtivos, nomeAtivo, apiUsuario }) {
  if (!entrada) return false;

  const linhaNorm = normalizarRotuloUsuarioHistorico(entrada.usuario);
  const ativoNorm = normalizarRotuloUsuarioHistorico(nomeAtivo);
  if (linhaNorm && ativoNorm && linhaNorm === ativoNorm) return true;

  if (apiUsuario && linhaNorm) {
    const apiNome = normalizarRotuloUsuarioHistorico(apiUsuario.nome);
    const apiLogin = normalizarRotuloUsuarioHistorico(apiUsuario.login);
    if ((apiNome && apiNome === linhaNorm) || (apiLogin && apiLogin === linhaNorm)) return true;
  }

  const lista = Array.isArray(usuariosAtivos) ? usuariosAtivos : [];
  const u = lista.find((x) => String(x.id) === String(perfilId));
  if (u) {
    const candidatos = [u.apelido, u.login, u.nome, nomeAtivo, apiUsuario?.nome, apiUsuario?.login]
      .map((x) => normalizarRotuloUsuarioHistorico(x))
      .filter(Boolean);
    if (linhaNorm && candidatos.some((c) => c === linhaNorm)) return true;
  }

  const entradaUid = entrada.usuarioId != null ? Number(entrada.usuarioId) : NaN;
  const perfilNum = Number(perfilId);
  if (Number.isFinite(entradaUid) && entradaUid >= 1 && Number.isFinite(perfilNum) && perfilNum >= 1) {
    return entradaUid === perfilNum;
  }
  const apiUid = apiUsuario?.id != null ? Number(apiUsuario.id) : NaN;
  if (Number.isFinite(entradaUid) && entradaUid >= 1 && Number.isFinite(apiUid) && apiUid >= 1) {
    return entradaUid === apiUid;
  }
  return false;
}

export async function excluirAndamentoProcesso(processoId, andamentoId) {
  if (!featureFlags.useApiProcessos) return;
  const pid = Number(processoId);
  const aid = Number(andamentoId);
  if (!Number.isFinite(pid) || pid < 1 || !Number.isFinite(aid) || aid < 1) return;
  await request(`/api/processos/${pid}/andamentos/${aid}`, { method: 'DELETE' });
}

export async function obterCamposProcessoApiFirst({ processoId, codigoCliente, numeroInterno }) {
  if (!featureFlags.useApiProcessos) return null;
  const pid = await resolverProcessoId({ processoId, codigoCliente, numeroInterno });
  if (!pid) return null;
  const p = await buscarProcessoPorId(pid);
  if (!p) return null;
  return mapApiProcessoToUiShape(p);
}

function resolverParteClienteApiShape(p) {
  const pc = corrigirMojibakeUtf8(String(p.parteCliente ?? p.parte_cliente ?? '').trim());
  if (pc) return pc;
  return corrigirMojibakeUtf8(String(p.titularNome ?? p.titular_nome ?? '').trim());
}

export function mapApiProcessoToUiShape(p) {
  const clientePk = clientePkFromApiDto(p);
  const titularId = pessoaIdFromApiDto(p);
  const statusAtivo = resolverStatusAtivoApi(p);
  const titularNome = corrigirMojibakeUtf8(String(p.titularNome ?? p.titular_nome ?? '').trim());
  const parteCliente = resolverParteClienteApiShape(p);
  return {
    processoId: p.id,
    clienteId: clientePk,
    clienteIdNativo: clientePk,
    pessoaTitularId: titularId,
    pessoaId: titularId,
    titularNome,
    codigoCliente: p.codigoCliente,
    numeroInterno: p.numeroInterno,
    numeroProcessoNovo: String(p.numeroCnj ?? p.numero_cnj ?? '').trim(),
    numeroProcessoVelho: String(p.numeroProcessoAntigo ?? p.numero_processo_antigo ?? '').trim(),
    naturezaAcao: corrigirMojibakeUtf8(String(p.naturezaAcao || p.descricaoAcao || '').trim()),
    descricaoAcao: corrigirMojibakeUtf8(String(p.descricaoAcao || p.naturezaAcao || '').trim()),
    competencia: corrigirMojibakeUtf8(String(p.competencia ?? '').trim()),
    faseSelecionada: corrigirMojibakeUtf8(String(p.fase ?? '').trim()),
    observacaoFase: corrigirMojibakeUtf8(String(p.observacaoFase ?? '').trim()),
    statusAtivo,
    prazoFatal: toBrFromIsoDate(p.prazoFatal),
    proximaConsultaData: toBrFromIsoDate(p.proximaConsulta),
    observacao: corrigirMojibakeUtf8(String(p.observacao ?? '').trim()),
    cidade: corrigirMojibakeUtf8(String(p.cidade ?? '').trim()),
    estado: String(p.uf ?? '').trim(),
    consultaAutomatica: p.consultaAutomatica === true,
    tramitacao: corrigirMojibakeUtf8(String(p.tramitacao ?? '').trim()),
    /** Mesmo valor que `tramitacao` na API (campo «Procedimento» no formulário). */
    procedimento: corrigirMojibakeUtf8(String(p.tramitacao ?? '').trim()),
    pjeTribunal: String(p.pjeTribunal ?? p.pje_tribunal ?? '').trim(),
    pjeGrau: String(p.pjeGrau ?? p.pje_grau ?? '').trim(),
    dataProtocolo: toBrFromIsoDate(p.dataProtocolo),
    responsavel: corrigirMojibakeUtf8(String(p.consultor ?? '').trim()),
    usuarioResponsavelId:
      p.usuarioResponsavelId != null &&
      Number.isFinite(Number(p.usuarioResponsavelId)) &&
      Number(p.usuarioResponsavelId) > 0
        ? Number(p.usuarioResponsavelId)
        : null,
    /** Só na listagem por cliente; mesma regra que partes «Autor/Requerente» na tela Processos. */
    parteCliente,
    /** Só na listagem por cliente; mesma regra que partes «Réu» na tela Processos. */
    parteOposta: corrigirMojibakeUtf8(String(p.parteOposta ?? p.parte_oposta ?? '').trim()),
    unidade: corrigirMojibakeUtf8(String(p.unidade ?? '').trim()),
    pasta: corrigirMojibakeUtf8(String(p.pasta ?? '').trim()),
    valorCausa: formatarValorCausaApiParaCampoBr(p.valorCausa),
    papelParte: papelParteApiParaUi(p.papelCliente ?? p.papel_cliente),
    audienciaData: toBrFromIsoDate(p.audienciaData),
    audienciaHora: String(p.audienciaHora ?? '').trim(),
    audienciaTipo: corrigirMojibakeUtf8(String(p.audienciaTipo ?? '').trim()),
    avisoAudiencia: avisoAudienciaApiParaUi(p.avisoAudiencia ?? p.aviso_audiencia),
  };
}

/**
 * Baixa PDF único mesclando os arquivos da pasta Movimentações no Drive (sem consultar PROJUDI).
 * @param {string} numeroCnj
 * @returns {Promise<{ blob: Blob, filename: string, avisos: string|null }>}
 */
function endpointConsolidarPdfAusente(err) {
  const status = Number(err?.status);
  const msg = String(err?.message ?? '');
  return (
    status === 404 ||
    msg.includes('static resource') ||
    msg.includes('No static resource') ||
    /not\s*found/i.test(msg)
  );
}

async function baixarPdfApiGet(path, fallbackFilename, query) {
  return requestBlob(path, { query, fallbackFilename });
}

async function baixarPdfApiPost(path, body, fallbackFilename) {
  return requestBlob(path, { method: 'POST', body, fallbackFilename });
}

/**
 * Lista PDFs da pasta Movimentações do processo no Drive (ordenados por nome).
 * @param {number|string} processoId
 * @returns {Promise<Array<{ id: string, nome: string, tipo: string, mimeType?: string, tamanho?: number, dataModificacao?: string }>>}
 */
export async function listarPdfsMovimentacoes(processoId) {
  const id = Number(processoId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Processo não identificado.');
  }
  return request(`/api/processos/${id}/movimentacoes/arquivos`);
}

/**
 * Consolida apenas os PDFs selecionados (ordem de fileIds preservada).
 * @param {number|string} processoId
 * @param {string[]} fileIds
 * @param {{ numeroCnj?: string }} [_options] reservado (sem fallback autos-integral)
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function consolidarMovimentacoesPdfSelecionados(processoId, fileIds, _options = {}) {
  const id = Number(processoId);
  if (!Number.isFinite(id) || id <= 0) {
    throw new Error('Processo não identificado.');
  }
  const ids = Array.isArray(fileIds) ? fileIds.filter(Boolean) : [];
  if (!ids.length) {
    throw new Error('Nenhum arquivo selecionado.');
  }
  const fallbackFilename = `Movimentacoes_Consolidado_${id}.pdf`;
  const path = `/api/processos/${id}/movimentacoes/consolidar-pdf`;
  const mapResultado = ({ blob, filename, responseHeaders }) => ({
    blob,
    filename,
    avisos: responseHeaders?.get('X-Movimentacoes-Consolidado-Avisos') ?? null,
  });
  try {
    return mapResultado(
      await requestBlob(path, {
        method: 'POST',
        body: { fileIds: ids },
        fallbackFilename,
      }),
    );
  } catch (e) {
    if (!endpointConsolidarPdfAusente(e)) throw e;
    return mapResultado(
      await requestBlob(path, {
        query: { fileId: ids },
        fallbackFilename,
      }),
    );
  }
}

/**
 * Consolida PDFs da pasta Movimentações no Drive e retorna blob para download.
 * Usa {@code GET /movimentacoes/consolidar-pdf}; se o backend ainda não expõe a rota,
 * faz fallback para {@code GET /autos-integral} (mesma pasta no Drive, ordem por movimentação).
 * @param {number|string} processoId
 * @param {{ numeroCnj?: string }} [options]
 * @returns {Promise<{ blob: Blob, filename: string }>}
 */
export async function consolidarMovimentacoesPdf(processoId, options = {}) {
  const id = Number(processoId);
  const numeroCnj = String(options?.numeroCnj ?? '').trim();
  if (!Number.isFinite(id) || id <= 0) {
    if (numeroCnj) {
      const { blob, filename } = await baixarAutosIntegralProcesso(numeroCnj);
      return { blob, filename };
    }
    throw new Error('Processo não identificado.');
  }
  try {
    return await baixarPdfApiGet(
      `/api/processos/${id}/movimentacoes/consolidar-pdf`,
      `Movimentacoes_Consolidado_${id}.pdf`
    );
  } catch (e) {
    if (endpointConsolidarPdfAusente(e) && numeroCnj) {
      const { blob, filename } = await baixarAutosIntegralProcesso(numeroCnj);
      return { blob, filename };
    }
    throw e;
  }
}

export async function baixarAutosIntegralProcesso(numeroCnj) {
  const numero = String(numeroCnj ?? '').trim();
  if (!numero) {
    throw new Error('Informe o número CNJ do processo.');
  }
  const { blob, filename, responseHeaders } = await requestBlob('/api/processos/autos-integral', {
    query: { numero },
    fallbackFilename: `${numero} - Autos.pdf`,
  });
  const avisos = responseHeaders?.get('X-Autos-Integral-Avisos') ?? null;
  return { blob, filename, avisos };
}

/**
 * Consulta PROJUDI e arquiva movimentações no Drive (regra progressiva: novas + backfill de 10).
 * @param {number|string} processoId
 * @returns {Promise<{ arquivosBaixados: number, totalComDocumento: number, totalArquivadasDrive: number, temMais: boolean, mensagem: string|null, selecaoResumo: string|null, erro: string|null }>}
 */
export async function obterMovimentacoesProjudiDrive(processoId) {
  const id = Number(processoId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Processo sem id na API — salve o cadastro antes de consultar o PROJUDI.');
  }
  return request(`/api/processos/${id}/projudi/movimentacoes-drive`, { method: 'POST' });
}

/**
 * Obter movimentações roteado por tramitação (Projudi síncrono / PJe assíncrono).
 * @returns {Promise<{ tramitacao, status, arquivosBaixados, mensagem, erro, ... }>}
 */
export async function obterMovimentacoesDrive(processoId) {
  const id = Number(processoId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Processo sem id na API — salve o cadastro antes de obter movimentações.');
  }
  return request(`/api/processos/${id}/movimentacoes-drive`, { method: 'POST' });
}

/**
 * Monitora movimentações PROJUDI (somente listagem F3; sem download/Drive/publicações).
 * @param {number|string} processoId
 * @returns {Promise<{
 *   processoId: number,
 *   numeroCnj: string,
 *   totalListadas: number,
 *   baseline: boolean,
 *   novas: number,
 *   novasMovimentacoes: Array,
 *   status: string,
 *   execucaoId: number,
 *   erro?: string|null,
 * }>}
 */
export async function monitorarProcesso(processoId) {
  const id = Number(processoId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Processo sem id na API — salve o cadastro antes de consultar o PROJUDI.');
  }
  return request(`/api/processos/${id}/projudi/monitorar`, { method: 'POST' });
}

/**
 * Dispara triagem manual da Júlia (andamento, prazo, audiência conforme resultado).
 * @param {number|string} processoId
 * @param {{ publicacaoId?: number, dryRun?: boolean, forcar?: boolean }} [opts]
 */
export async function dispararTriagemJulia(processoId, opts = {}) {
  const id = Number(processoId);
  if (!Number.isFinite(id) || id < 1) {
    throw new Error('Processo sem id na API.');
  }
  const params = new URLSearchParams();
  if (opts.publicacaoId != null) params.set('publicacaoId', String(opts.publicacaoId));
  if (opts.dryRun) params.set('dryRun', 'true');
  if (opts.forcar) params.set('forcar', 'true');
  const qs = params.toString();
  return request(`/api/processos/${id}/julia/triagem${qs ? `?${qs}` : ''}`, { method: 'POST' });
}
