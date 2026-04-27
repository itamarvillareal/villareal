import { request } from '../api/httpClient.js';

function limparQuery(q) {
  const out = {};
  if (!q) return out;
  for (const [k, v] of Object.entries(q)) {
    if (v === undefined || v === null) continue;
    if (typeof v === 'string' && v.trim() === '') continue;
    out[k] = v;
  }
  return out;
}

/** @param {string} br dd/mm/yyyy */
function dataBrParaIso(br) {
  const s = String(br ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

export async function listarAnuaisDoImovel(imovelId, ano, opts = {}) {
  const q = { imovelId: Number(imovelId) };
  if (ano != null) q.ano = Number(ano);
  return request('/api/iptu/anual', { query: q, signal: opts.signal });
}

export async function upsertAnual(
  { imovelId, anoReferencia, valorTotalAnual, observacoes, anexoCarnePath, diasMesDivisor },
  opts = {},
) {
  const body = {
    imovelId: Number(imovelId),
    anoReferencia: Number(anoReferencia),
    valorTotalAnual: Number(valorTotalAnual),
    observacoes: observacoes != null ? String(observacoes) : undefined,
    anexoCarnePath: anexoCarnePath != null ? String(anexoCarnePath) : undefined,
    diasMesDivisor: diasMesDivisor != null ? Number(diasMesDivisor) : undefined,
  };
  return request('/api/iptu/anual', { method: 'POST', body, signal: opts.signal });
}

export async function recalcularParcelas(iptuAnualId, opts = {}) {
  return request(`/api/iptu/anual/${Number(iptuAnualId)}/recalcular`, { method: 'POST', signal: opts.signal });
}

export async function listarParcelas(
  { imovelId, contratoId, ano, status, competenciaInicio, competenciaFim, page, size },
  opts = {},
) {
  const q = limparQuery({
    imovelId: imovelId != null ? Number(imovelId) : undefined,
    contratoId: contratoId != null ? Number(contratoId) : undefined,
    ano: ano != null ? Number(ano) : undefined,
    status,
    competenciaInicio,
    competenciaFim,
    page: page != null ? Number(page) : 0,
    size: size != null ? Number(size) : 20,
  });
  return request('/api/iptu/parcelas', { query: q, signal: opts.signal });
}

export async function marcarParcelaPaga(parcelaId, { dataPagamento, pagamentoId }, opts = {}) {
  const body = {
    dataPagamento,
    pagamentoId: pagamentoId != null ? Number(pagamentoId) : undefined,
  };
  return request(`/api/iptu/parcelas/${Number(parcelaId)}/marcar-paga`, { method: 'PATCH', body, signal: opts.signal });
}

export async function cancelarParcela(parcelaId, motivo, opts = {}) {
  return request(`/api/iptu/parcelas/${Number(parcelaId)}/cancelar`, {
    method: 'PATCH',
    body: { motivo: String(motivo ?? '') },
    signal: opts.signal,
  });
}

export async function listarConsultasDebito({ imovelId, limit }, opts = {}) {
  return request('/api/iptu/consultas', {
    query: limparQuery({ imovelId: Number(imovelId), limit: limit != null ? Number(limit) : 50 }),
    signal: opts.signal,
  });
}

export async function registrarConsultaDebito(
  { imovelId, dataConsulta, existeDebito, valorDebito, observacoes, anexoPath },
  opts = {},
) {
  const iso = typeof dataConsulta === 'string' && dataConsulta.includes('/') ? dataBrParaIso(dataConsulta) : dataConsulta;
  const body = {
    imovelId: Number(imovelId),
    dataConsulta: iso,
    existeDebito: Boolean(existeDebito),
    valorDebito: valorDebito != null && valorDebito !== '' ? Number(String(valorDebito).replace(',', '.')) : undefined,
    observacoes: observacoes != null ? String(observacoes) : undefined,
    anexoPath: anexoPath != null ? String(anexoPath) : undefined,
  };
  return request('/api/iptu/consultas', { method: 'POST', body, signal: opts.signal });
}

export async function buscarDashboard({ ano, status, imovelId }, opts = {}) {
  return request('/api/iptu/dashboard', {
    query: limparQuery({
      ano: ano != null ? Number(ano) : undefined,
      status,
      imovelId: imovelId != null ? Number(imovelId) : undefined,
    }),
    signal: opts.signal,
  });
}
