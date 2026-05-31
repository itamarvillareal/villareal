import { request } from '../api/httpClient.js';

/**
 * Repository do módulo «Desconto de Cheques» — entidade independente (sem cliente/processo).
 * Segue o padrão dos demais repos: helper único `request` (injeta JWT/headers).
 *
 * Contrato do body (Request): { descricao?, valorFace, dataBase, dataDeposito, taxaMensalPercentual }.
 * Datas em ISO yyyy-mm-dd; valores numéricos (ponto decimal).
 */

function montarBody({ descricao, valorFace, dataBase, dataDeposito, taxaMensalPercentual }) {
  return {
    descricao: descricao != null && String(descricao).trim() !== '' ? String(descricao).trim() : undefined,
    valorFace: Number(valorFace),
    dataBase: dataBase || undefined,
    dataDeposito,
    taxaMensalPercentual: Number(taxaMensalPercentual),
  };
}

/** Lista todos os descontos salvos (resumo, sem tabela diária). */
export async function listarDescontosCheque(opts = {}) {
  const data = await request('/api/descontos-cheque', { signal: opts.signal });
  return Array.isArray(data) ? data : [];
}

/** Um desconto com a tabela diária recalculada na leitura. */
export async function obterDescontoCheque(id, opts = {}) {
  return request(`/api/descontos-cheque/${Number(id)}`, { signal: opts.signal });
}

/** Preview: calcula e retorna SEM salvar. */
export async function simularDescontoCheque(input, opts = {}) {
  return request('/api/descontos-cheque/simular', {
    method: 'POST',
    body: montarBody(input),
    signal: opts.signal,
  });
}

/** Calcula e salva um novo desconto. */
export async function criarDescontoCheque(input, opts = {}) {
  return request('/api/descontos-cheque', {
    method: 'POST',
    body: montarBody(input),
    signal: opts.signal,
  });
}

/** Recalcula e atualiza um desconto existente. */
export async function atualizarDescontoCheque(id, input, opts = {}) {
  return request(`/api/descontos-cheque/${Number(id)}`, {
    method: 'PUT',
    body: montarBody(input),
    signal: opts.signal,
  });
}

/** Exclui um desconto. */
export async function excluirDescontoCheque(id, opts = {}) {
  return request(`/api/descontos-cheque/${Number(id)}`, {
    method: 'DELETE',
    signal: opts.signal,
  });
}
