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

function toIsoDateTimeFromBrDate(dateBr) {
  const isoDate = toIsoFromBrDate(dateBr);
  if (!isoDate) return null;
  return `${isoDate}T12:00:00`;
}

export async function buscarProcessoPorChaveNatural(codigoCliente, numeroInterno) {
  if (!featureFlags.useApiProcessos) return null;
  const lista = await request('/api/processos', {
    query: { codigoCliente: padCliente8(codigoCliente) },
  });
  const procNum = Number(numeroInterno);
  return (lista || []).find((p) => Number(p.numeroInterno) === procNum) || null;
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
  const clientes = await request('/api/clientes');
  const cod = padCliente8(codigoCliente);
  return (clientes || []).find((c) => String(c.codigoCliente) === cod) || null;
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
    status: payload.status || null,
    tramitacao: payload.tramitacao || null,
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
  return {
    id: Number(a.id),
    inf: String(total - idx).padStart(2, '0'),
    info: String(a.titulo || ''),
    data: toBrFromIsoDate(a.movimentoEm),
    usuario: '',
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
  return {
    processoId: p.id,
    /** Id do cliente na API (ProcessoResponse) — útil para vínculos (ex.: tarefas). */
    clienteId: p.clienteId != null ? Number(p.clienteId) : null,
    codigoCliente: p.codigoCliente,
    numeroInterno: p.numeroInterno,
    numeroProcessoNovo: p.numeroCnj || '',
    numeroProcessoVelho: p.numeroProcessoAntigo || '',
    naturezaAcao: p.naturezaAcao || '',
    competencia: p.competencia || '',
    faseSelecionada: p.fase || '',
    statusAtivo: p.ativo !== false,
    prazoFatal: toBrFromIsoDate(p.prazoFatal),
    proximaConsultaData: toBrFromIsoDate(p.proximaConsulta),
    observacao: p.observacao || '',
    cidade: p.cidade || '',
    estado: p.uf || '',
    consultaAutomatica: p.consultaAutomatica === true,
    tramitacao: p.tramitacao || '',
    dataProtocolo: toBrFromIsoDate(p.dataProtocolo),
    responsavel: p.consultor || '',
  };
}
