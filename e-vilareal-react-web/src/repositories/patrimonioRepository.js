import { request } from '../api/httpClient.js';

const BASE = '/api/patrimonio';

export function obterConsolidacaoApi() {
  return request(`${BASE}/consolidacao`);
}

export function persistirSnapshotApi() {
  return request(`${BASE}/consolidacao/snapshot`, { method: 'POST' });
}

export function listarComparadorApi() {
  return request(`${BASE}/comparador`);
}

export function obterParametrosApi() {
  return request(`${BASE}/parametros`);
}

export function listarPassivosApi() {
  return request(`${BASE}/passivos`);
}

export function criarPassivoApi(body) {
  return request(`${BASE}/passivos`, { method: 'POST', body });
}

export function atualizarPassivoApi(id, body) {
  return request(`${BASE}/passivos/${id}`, { method: 'PUT', body });
}

export function desativarPassivoApi(id) {
  return request(`${BASE}/passivos/${id}`, { method: 'DELETE' });
}

export function simularAmortizacaoApi(body) {
  return request(`${BASE}/amortizacoes/simular`, { method: 'POST', body });
}

export function rankingAmortizacaoApi() {
  return request(`${BASE}/amortizacoes/ranking`);
}

export function solicitarAmortizacaoApi(body) {
  return request(`${BASE}/amortizacoes`, { method: 'POST', body });
}

export function registrarAmortizacaoExecutadaApi(body) {
  return request(`${BASE}/amortizacoes/registrar-executada`, { method: 'POST', body });
}

export function confirmarAmortizacaoApi(id) {
  return request(`${BASE}/amortizacoes/${id}/confirmar`, { method: 'POST' });
}

export function atualizarTaxaReferenciaApi(taxaReferenciaLiquidaAa) {
  return request(`${BASE}/parametros/taxa-referencia`, {
    method: 'PUT',
    body: { taxaReferenciaLiquidaAa },
  });
}

export function atualizarTetoAmortizacaoApi(tetoAmortizacaoAnual) {
  return request(`${BASE}/parametros/teto-amortizacao`, {
    method: 'PUT',
    body: { tetoAmortizacaoAnual },
  });
}

export function listarAmortizacoesApi(passivoId) {
  return request(`${BASE}/amortizacoes`, { query: passivoId ? { passivoId } : undefined });
}

export function listarCaixaApi() {
  return request(`${BASE}/ativos/caixa`);
}

export function salvarCaixaApi(id, body) {
  return id
    ? request(`${BASE}/ativos/caixa/${id}`, { method: 'PUT', body })
    : request(`${BASE}/ativos/caixa`, { method: 'POST', body });
}

export function listarRendaFixaApi() {
  return request(`${BASE}/ativos/renda-fixa`);
}

export function salvarRendaFixaApi(id, body) {
  return id
    ? request(`${BASE}/ativos/renda-fixa/${id}`, { method: 'PUT', body })
    : request(`${BASE}/ativos/renda-fixa`, { method: 'POST', body });
}

export function listarImoveisPatrimonioApi() {
  return request(`${BASE}/ativos/imoveis`);
}

export function salvarImovelPatrimonioApi(id, body) {
  return id
    ? request(`${BASE}/ativos/imoveis/${id}`, { method: 'PUT', body })
    : request(`${BASE}/ativos/imoveis`, { method: 'POST', body });
}

export function listarRvApi() {
  return request(`${BASE}/ativos/renda-variavel`);
}

export function salvarRvApi(id, body) {
  return id
    ? request(`${BASE}/ativos/renda-variavel/${id}`, { method: 'PUT', body })
    : request(`${BASE}/ativos/renda-variavel`, { method: 'POST', body });
}

export function listarVeiculosPatrimonioApi() {
  return request(`${BASE}/ativos/veiculos`);
}

export function salvarVeiculoPatrimonioApi(id, body) {
  return id
    ? request(`${BASE}/ativos/veiculos/${id}`, { method: 'PUT', body })
    : request(`${BASE}/ativos/veiculos`, { method: 'POST', body });
}

export function listarOpcoesApi(status) {
  return request(`${BASE}/ativos/opcoes`, { query: status ? { status } : undefined });
}

export function salvarOpcaoApi(id, body) {
  return id
    ? request(`${BASE}/ativos/opcoes/${id}`, { method: 'PUT', body })
    : request(`${BASE}/ativos/opcoes`, { method: 'POST', body });
}
