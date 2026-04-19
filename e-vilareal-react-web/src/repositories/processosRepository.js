import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';

function padCliente8(value) {
  const d = String(value ?? '').replace(/\D/g, '');
  const n = Number(d || '1');
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return String(safe).padStart(8, '0');
}

function toIsoFromBrDate(dateBr) {
  const s = String(dateBr ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toBrFromIsoDate(dateIso) {
  const s = String(dateIso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
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
  if (s == null || typeof s !== 'string' || s.length === 0) return s;
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

function toIsoDateTimeFromBrDate(dateBr) {
  const isoDate = toIsoFromBrDate(dateBr);
  if (!isoDate) return null;
  return `${isoDate}T12:00:00`;
}

export async function listarProcessosPorCodigoCliente(codigoCliente) {
  if (!featureFlags.useApiProcessos) return [];
  const lista = await request('/api/processos', {
    query: { codigoCliente: padCliente8(codigoCliente) },
  });
  return Array.isArray(lista) ? lista : [];
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

export async function buscarProcessoPorChaveNatural(codigoCliente, numeroInterno) {
  if (!featureFlags.useApiProcessos) return null;
  const lista = await listarProcessosPorCodigoCliente(codigoCliente);
  const procNum = Number(numeroInterno);
  return lista.find((p) => Number(p.numeroInterno) === procNum) || null;
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
    const descApi = String(api.observacao ?? api.naturezaAcao ?? '').trim();
    const poApi = String(api.parteOposta ?? api.parte_oposta ?? '').trim();
    const poRow = String(row.parteOposta ?? row.reu ?? '').trim();

    return {
      ...row,
      processoNovo: novoApi || String(row.processoNovo ?? '').trim() || row.processoNovo,
      processoVelho: velhoApi || String(row.processoVelho ?? '').trim() || row.processoVelho,
      descricao: descApi || String(row.descricao ?? '').trim() || row.descricao,
      parteOposta: poApi || poRow || row.parteOposta,
      reu: poApi || poRow || row.reu,
    };
  });

  for (const [n, api] of byNum) {
    if (seen.has(n)) continue;
    seen.add(n);
    const poNovo = String(api.parteOposta ?? api.parte_oposta ?? '').trim();
    out.push({
      id: `${codN}-${n}`,
      procNumero: n,
      processoVelho: String(api.numeroProcessoVelho ?? '').trim() || '-',
      processoNovo: String(api.numeroProcessoNovo ?? '').trim(),
      autor: '',
      reu: poNovo || '—',
      parteOposta: poNovo || '—',
      tipoAcao: '',
      descricao: String(api.observacao ?? api.naturezaAcao ?? '').trim(),
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
  const clientes = await request('/api/clientes');
  const found = (clientes || []).find((c) => String(c.codigoCliente) === cod);
  if (found) return found;
  try {
    return await request('/api/clientes/resolucao', { query: { codigoCliente: cod } });
  } catch {
    return null;
  }
}

export async function salvarCabecalhoProcesso(payload) {
  if (!featureFlags.useApiProcessos) return null;
  const processoId = await resolverProcessoId(payload);
  const body = {
    clienteId: Number(payload.clienteId),
    numeroInterno: Number(payload.numeroInterno),
    numeroCnj: payload.numeroProcessoNovo || null,
    numeroProcessoAntigo: payload.numeroProcessoVelho || null,
    naturezaAcao: payload.naturezaAcao || null,
    descricaoAcao: payload.observacao || null,
    competencia: payload.competencia || null,
    fase: payload.faseSelecionada || null,
    observacaoFase: payload.faseCampo || null,
    tramitacao: (payload.procedimento || payload.tramitacao || '').trim() || null,
    dataProtocolo: toIsoFromBrDate(payload.dataProtocolo),
    prazoFatal: toIsoFromBrDate(payload.prazoFatal),
    proximaConsulta: toIsoFromBrDate(payload.proximaConsultaData),
    observacao: payload.observacao || null,
    valorCausa: payload.valorCausaNumero ?? null,
    uf: payload.estado || null,
    cidade: payload.cidade || null,
    consultaAutomatica: payload.consultaAutomatica === true,
    ativo: payload.statusAtivo !== false,
    consultor: payload.responsavel || null,
    usuarioResponsavelId: payload.usuarioResponsavelId || null,
    unidade: String(payload.unidade ?? '').trim() || null,
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
  const pid = await resolverProcessoId({ processoId });
  if (!pid) return [];
  return request(`/api/processos/${pid}/andamentos`);
}

function assinaturaAndamento(h) {
  return `${String(h.movimentoEm || '')}|${String(h.titulo || '').trim().toLowerCase()}`;
}

export async function sincronizarAndamentosIncremental(processoId, historico) {
  if (!featureFlags.useApiProcessos) return [];
  const pid = await resolverProcessoId({ processoId });
  if (!pid) return [];

  const atuais = await listarAndamentosProcesso(pid);
  const atuaisPorId = new Map((atuais || []).map((a) => [Number(a.id), a]));
  const atuaisPorAssinatura = new Map((atuais || []).map((a) => [assinaturaAndamento(a), a]));
  const desejados = (historico || []).map((h) => ({
    id: Number.isFinite(Number(h.id)) ? Number(h.id) : null,
    movimentoEm: toIsoDateTimeFromBrDate(h.data) || new Date().toISOString(),
    titulo: String(h.info || '').slice(0, 500) || 'Andamento',
    detalhe: null,
    origem: 'MANUAL',
    origemAutomatica: false,
    usuarioId: null,
  }));
  const idsDesejados = new Set(desejados.map((d) => Number(d.id)).filter(Number.isFinite));

  for (const atual of atuais || []) {
    const idNum = Number(atual.id);
    if (!idsDesejados.has(idNum)) {
      const assinaturaExiste = desejados.some((d) => assinaturaAndamento(d) === assinaturaAndamento(atual));
      if (!assinaturaExiste) {
        await request(`/api/processos/${pid}/andamentos/${atual.id}`, { method: 'DELETE' });
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

export async function listarPrazosProcesso(processoId) {
  if (!featureFlags.useApiProcessos) return [];
  const pid = await resolverProcessoId({ processoId });
  if (!pid) return [];
  return request(`/api/processos/${pid}/prazos`);
}

export async function upsertPrazoFatalProcesso(processoId, prazoFatalBr) {
  if (!featureFlags.useApiProcessos) return null;
  const pid = await resolverProcessoId({ processoId });
  if (!pid) return null;
  const dataFim = toIsoFromBrDate(prazoFatalBr);
  if (!dataFim) return null;
  const prazos = await listarPrazosProcesso(pid);
  const prazoFatal = (prazos || []).find((p) => p.prazoFatal === true);
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
    return request(`/api/processos/${pid}/prazos/${prazoFatal.id}`, {
      method: 'PUT',
      body,
    });
  }
  return request(`/api/processos/${pid}/prazos`, { method: 'POST', body });
}

export function mapApiAndamentoToHistoricoItem(a, idx = 0, total = 1) {
  const movRaw = a?.movimentoEm ?? a?.movimento_em;
  const tituloRaw = a?.titulo;
  const idNum = Number(a?.id);
  const nome = String(a?.usuarioNome ?? a?.usuario_nome ?? '').trim();
  const login = String(a?.usuarioLogin ?? a?.usuario_login ?? '').trim();
  const consultor = extrairNomeConsultorDeDetalhe(a?.detalhe);
  const usuario = nome || login || consultor;
  return {
    id: Number.isFinite(idNum) && idNum >= 1 ? idNum : Date.now() + idx,
    inf: String(total - idx).padStart(2, '0'),
    info: String(tituloRaw ?? '').trim(),
    data: toBrFromIsoDate(movRaw),
    usuario,
    numero: String(total - idx).padStart(4, '0'),
  };
}

export async function obterCamposProcessoApiFirst({ processoId, codigoCliente, numeroInterno }) {
  if (!featureFlags.useApiProcessos) return null;
  const pid = await resolverProcessoId({ processoId, codigoCliente, numeroInterno });
  if (!pid) return null;
  const p = await buscarProcessoPorId(pid);
  if (!p) return null;
  return mapApiProcessoToUiShape(p);
}

export function mapApiProcessoToUiShape(p) {
  const pessoaRef =
    p.pessoaId != null ? Number(p.pessoaId) : p.clienteId != null ? Number(p.clienteId) : null;
  return {
    processoId: p.id,
    /** Id em `pessoa` (col. B) — par com «Pessoa» em Clientes; `pessoaId` ou `clienteId` na API. */
    clienteId: pessoaRef,
    pessoaId: pessoaRef,
    codigoCliente: p.codigoCliente,
    numeroInterno: p.numeroInterno,
    numeroProcessoNovo: String(p.numeroCnj ?? p.numero_cnj ?? '').trim(),
    numeroProcessoVelho: String(p.numeroProcessoAntigo ?? p.numero_processo_antigo ?? '').trim(),
    naturezaAcao: corrigirMojibakeUtf8(p.naturezaAcao || ''),
    competencia: corrigirMojibakeUtf8(p.competencia || ''),
    faseSelecionada: corrigirMojibakeUtf8(p.fase || ''),
    observacaoFase: corrigirMojibakeUtf8(p.observacaoFase || ''),
    statusAtivo: p.ativo !== false,
    prazoFatal: toBrFromIsoDate(p.prazoFatal),
    proximaConsultaData: toBrFromIsoDate(p.proximaConsulta),
    // Importação Excel grava col. O em `descricaoAcao`; a UI usa o estado `observacao`.
    observacao: corrigirMojibakeUtf8(p.observacao || p.descricaoAcao || ''),
    cidade: corrigirMojibakeUtf8(p.cidade || ''),
    estado: p.uf || '',
    consultaAutomatica: p.consultaAutomatica === true,
    tramitacao: corrigirMojibakeUtf8(p.tramitacao || ''),
    /** Mesmo valor que `tramitacao` na API (campo «Procedimento» no formulário). */
    procedimento: corrigirMojibakeUtf8(p.tramitacao || ''),
    dataProtocolo: toBrFromIsoDate(p.dataProtocolo),
    responsavel: corrigirMojibakeUtf8(p.consultor || ''),
    /** Só na listagem por cliente; mesma regra que partes «Réu» na tela Processos. */
    parteOposta: corrigirMojibakeUtf8(p.parteOposta || p.parte_oposta || ''),
    unidade: corrigirMojibakeUtf8(String(p.unidade ?? '').trim()),
  };
}
