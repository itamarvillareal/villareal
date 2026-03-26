import { API_BASE_URL } from '../api/config.js';
import { getAccessToken } from '../api/authTokenStorage.js';
import { getPerfilAtivoParaPermissoes } from '../data/usuarioPermissoesStorage.js';
import { getUsuariosAtivos } from '../data/agendaPersistenciaData.js';
import { getNomeExibicaoUsuario } from '../data/usuarioDisplayHelpers.js';

const URL_AUDITORIA = `${API_BASE_URL}/api/auditoria/atividades`;

/** Tipos comuns para filtros e registro (extensível). */
export const TIPOS_ACAO_AUDITORIA = [
  'ACESSO_MODULO',
  'ACESSO_TELA',
  'ACESSO_LISTA',
  'ACESSO_CADASTRO',
  'CRIACAO',
  'EDICAO',
  'EXCLUSAO',
  'RELATORIO',
  'DOCUMENTO',
  'FINANCEIRO',
  'VINCULACAO',
  'ACEITE_CALCULO',
  'BAIXA_LANCAMENTO',
  'LOGIN',
  'LOGOUT',
  'TROCA_PERFIL',
];

export function getContextoAuditoriaUsuario() {
  const id = getPerfilAtivoParaPermissoes();
  const u = getUsuariosAtivos()?.find((x) => String(x.id) === String(id));
  return {
    usuarioId: String(id ?? 'desconhecido'),
    usuarioNome: getNomeExibicaoUsuario(u) || String(id ?? 'Desconhecido'),
  };
}

/**
 * Cabeçalhos para o backend identificar o usuário da estação (nome em Base64 UTF-8).
 */
export function buildAuditoriaHeaders() {
  const { usuarioId, usuarioNome } = getContextoAuditoriaUsuario();
  let nomeB64 = '';
  try {
    nomeB64 = btoa(unescape(encodeURIComponent(usuarioNome)));
  } catch {
    nomeB64 = btoa('Desconhecido');
  }
  return {
    'X-VilaReal-Usuario-Id': String(usuarioId),
    'X-VilaReal-Usuario-Nome-B64': nomeB64,
  };
}

/**
 * Registra atividade no servidor (fire-and-forget). Falhas de rede não bloqueiam a UI.
 */
export function registrarAuditoria({
  modulo,
  tela = typeof window !== 'undefined' ? window.location.pathname : '',
  tipoAcao,
  descricao,
  registroAfetadoId = null,
  registroAfetadoNome = null,
  observacoesTecnicas = null,
}) {
  if (typeof window === 'undefined') return;
  if (!modulo || !tipoAcao || !descricao) return;

  const ctx = getContextoAuditoriaUsuario();
  const body = {
    usuarioId: ctx.usuarioId,
    usuarioNome: ctx.usuarioNome,
    modulo: String(modulo).trim(),
    tela: tela != null ? String(tela) : '',
    tipoAcao: String(tipoAcao).trim(),
    descricao: String(descricao).trim(),
    registroAfetadoId: registroAfetadoId != null ? String(registroAfetadoId) : null,
    registroAfetadoNome: registroAfetadoNome != null ? String(registroAfetadoNome) : null,
    observacoesTecnicas: observacoesTecnicas != null ? String(observacoesTecnicas) : null,
  };

  const headers = {
    'Content-Type': 'application/json',
    ...buildAuditoriaHeaders(),
  };
  const token = getAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  fetch(URL_AUDITORIA, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  }).catch(() => {
    /* auditoria não deve interromper fluxo do usuário */
  });
}
