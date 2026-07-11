import { API_BASE_URL } from './config';
import { buildDefaultApiHeaders } from './apiAuthHeaders.js';
import { parseApiJsonResponse } from './parseApiResponse.js';

const BASE = `${API_BASE_URL}/api/monitoramento`;

function getOptions(method, body = null) {
  const opts = {
    method,
    headers: buildDefaultApiHeaders(),
  };
  if (body) opts.body = JSON.stringify(body);
  return opts;
}

async function handleResponse(res) {
  return parseApiJsonResponse(res);
}

/**
 * Pessoas marcadas para monitoramento PROJUDI, com agregados
 * (alertas pendentes, total de descobertos, soma do segredo).
 */
export async function listarPessoasMonitoradas() {
  const res = await fetch(`${BASE}/pessoas`, getOptions('GET'));
  return handleResponse(res);
}

/**
 * Caixa de entrada: descobertos de todas as pessoas monitoradas.
 * @param {string} [situacao] - NOVO (default) | BASELINE | IGNORADO | VINCULADO
 */
export async function listarDescobertos(situacao = 'NOVO') {
  const qs = new URLSearchParams({ situacao });
  const res = await fetch(`${BASE}/descobertos?${qs}`, getOptions('GET'));
  return handleResponse(res);
}

/**
 * Painel da pessoa: descobertos dela.
 * @param {number} pessoaId
 * @param {{ situacao?: string, recentes?: boolean }} [filtros]
 */
export async function listarDescobertosDaPessoa(pessoaId, { situacao, recentes } = {}) {
  const qs = new URLSearchParams();
  if (situacao) qs.set('situacao', situacao);
  if (recentes) qs.set('recentes', 'true');
  const sufixo = qs.toString() ? `?${qs}` : '';
  const res = await fetch(`${BASE}/pessoa/${pessoaId}/descobertos${sufixo}`, getOptions('GET'));
  return handleResponse(res);
}

/** Contagem de processos em segredo de justiça por serventia da pessoa. */
export async function listarSegredoDaPessoa(pessoaId) {
  const res = await fetch(`${BASE}/pessoa/${pessoaId}/segredo`, getOptions('GET'));
  return handleResponse(res);
}

/** Marca o descoberto como ignorado (persistente). */
export async function ignorarDescoberto(descobertoId) {
  const res = await fetch(`${BASE}/descobertos/${descobertoId}/ignorar`, getOptions('POST'));
  return handleResponse(res);
}

/**
 * Cadastro em duas fases (Bloco C):
 * - sem corpo → PENDENTE_CONFIRMACAO com clientes candidatos + sugestão de numeroInterno;
 * - com { clienteId, numeroInterno } → CRIADO, ou JA_CADASTRADO se a anti-duplicata pegou.
 * Pode enriquecer no PROJUDI antes (sob o gate) — a chamada pode demorar ou dar 409 se o robô
 * estiver ocupado.
 * @param {number} descobertoId
 * @param {{ clienteId?: number, numeroInterno?: number }|null} [corpo]
 */
export async function cadastrarDescoberto(descobertoId, corpo = null) {
  const res = await fetch(`${BASE}/descobertos/${descobertoId}/cadastrar`, getOptions('POST', corpo));
  return handleResponse(res);
}

/**
 * Contexto do aviso WhatsApp (Bloco E): consentimento, telefones do cadastro, status do
 * template na Meta e mensagem sugerida. Sem efeito colateral.
 */
export async function obterContextoAviso(descobertoId) {
  const res = await fetch(`${BASE}/descobertos/${descobertoId}/aviso`, getOptions('GET'));
  return handleResponse(res);
}

/**
 * Envia o aviso de processo novo. O backend RECUSA com 403 sem consentimento registrado —
 * a trava não é da UI. Um aviso por descoberto; nunca automático.
 * @param {number} descobertoId
 * @param {{ telefone: string, parametros?: string[] }} corpo
 */
export async function avisarCliente(descobertoId, corpo) {
  const res = await fetch(`${BASE}/descobertos/${descobertoId}/avisar`, getOptions('POST', corpo));
  return handleResponse(res);
}
