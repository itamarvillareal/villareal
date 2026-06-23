import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import { formatValorMoedaCampo } from '../utils/moneyBr.js';
import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';

function mapApiToUi(data) {
  if (!data || typeof data !== 'object') return null;
  return {
    id: data.id ?? null,
    clienteId: data.clienteId ?? null,
    clienteNome: data.clienteNome ?? '',
    codigoCliente: data.codigoCliente ?? '',
    valor: data.valor != null ? formatValorMoedaCampo(data.valor) : '',
    diaVencimento: data.diaVencimento ?? 10,
    dataInicio: data.dataInicio ?? '',
    dataFim: data.dataFim ?? '',
    ativo: data.ativo !== false,
  };
}

export async function buscarMensalistaPorCliente(clienteId) {
  const id = Number(clienteId);
  if (!featureFlags.useApiClientes || !Number.isFinite(id) || id < 1) return null;
  try {
    const data = await request(`/api/mensalistas/cliente/${id}`);
    return mapApiToUi(data);
  } catch (err) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('404') || msg.includes('não encontrado') || msg.includes('nao encontrado')) {
      return null;
    }
    throw err;
  }
}

export async function salvarMensalista(payload) {
  const valorNum = parseValorMonetarioBr(payload.valor);
  const body = {
    clienteId: Number(payload.clienteId),
    valor: valorNum != null ? valorNum : 0,
    diaVencimento: Number(payload.diaVencimento),
    dataInicio: payload.dataInicio,
    dataFim: payload.dataFim || null,
    ativo: payload.ativo === true,
  };
  const data = await request('/api/mensalistas', { method: 'PUT', body });
  return mapApiToUi(data);
}

export async function removerMensalista(clienteId) {
  const id = Number(clienteId);
  if (!Number.isFinite(id) || id < 1) return;
  await request(`/api/mensalistas/cliente/${id}`, { method: 'DELETE' });
}

export async function gerarRecebiveisMensalistasMes(mesAno) {
  const query = mesAno ? { mesAno } : undefined;
  return request('/api/mensalistas/gerar-mes', { method: 'POST', query });
}
