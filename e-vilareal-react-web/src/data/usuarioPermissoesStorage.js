/**
 * Permissões de acesso por usuário (id da lista Agenda/Usuários) e perfil ativo na sessão.
 */

import { navItems } from './mockData.js';
import { getUsuariosAtivos } from './agendaPersistenciaData.js';
import { featureFlags } from '../config/featureFlags.js';

export const STORAGE_PERMISSOES_USUARIOS = 'vilareal.usuarios.permissoes.v1';
export const STORAGE_USUARIO_SESSAO_ATIVA = 'vilareal.usuario.sessaoAtiva.v1';
/** Quem usa de fato esta estação (navegador). Só o master (Itamar) pode alternar o perfil ativo para testar outros. */
export const STORAGE_OPERADOR_ESTACAO = 'vilareal.usuario.operadorEstacao.v1';
/** Usuário retornado pelo login JWT (sessionStorage — mesma aba que o token). */
export const STORAGE_API_USUARIO_SESSAO = 'vilareal.auth.usuarioLogado.v1';

/** Id do usuário master — único que pode escolher outros perfis no menu (teste do sistema). */
export const USUARIO_MASTER_ID = 'itamar';

/**
 * Quem pode alternar perfil no menu: mock (Itamar) ou API com JWT (usuário id 1 = admin seed).
 */
export function idEhUsuarioMasterEstacao(operadorId) {
  const id = String(operadorId ?? '').trim();
  if (!id) return false;
  if (featureFlags.requiresApiAuth) {
    return id === '1' || id === USUARIO_MASTER_ID;
  }
  return id === USUARIO_MASTER_ID;
}

export function isUsuarioMasterEstacao() {
  return idEhUsuarioMasterEstacao(getOperadorEstacaoId());
}

/**
 * @returns {{ id: string, nome: string, login: string } | null}
 */
export function getApiUsuarioSessao() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_API_USUARIO_SESSAO);
    if (!raw) return null;
    const o = JSON.parse(raw);
    if (!o || typeof o.id !== 'string' || !o.id) return null;
    return {
      id: o.id,
      nome: typeof o.nome === 'string' ? o.nome : '',
      login: typeof o.login === 'string' ? o.login : '',
    };
  } catch {
    return null;
  }
}

/**
 * @param {{ id: number|string, nome?: string, login?: string } | null | undefined} usuario
 */
export function setApiUsuarioSessao(usuario) {
  if (typeof window === 'undefined' || usuario == null || usuario.id == null) return;
  const id = String(usuario.id).trim();
  if (!id) return;
  try {
    sessionStorage.setItem(
      STORAGE_API_USUARIO_SESSAO,
      JSON.stringify({
        id,
        nome: String(usuario.nome ?? ''),
        login: String(usuario.login ?? ''),
      }),
    );
    dispatchOperadorEstacao();
    dispatchSessao();
  } catch {
    /* ignore */
  }
}

export function clearApiUsuarioSessao() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(STORAGE_API_USUARIO_SESSAO);
    dispatchOperadorEstacao();
    dispatchSessao();
  } catch {
    /* ignore */
  }
}

/** Expande entradas com `children` (ex.: Calcular) em um módulo por sub-rota, para permissões e pathParaModuloId. */
function modulosFromNavItems(items) {
  const out = [];
  for (const item of items) {
    if (Array.isArray(item.children) && item.children.length > 0) {
      for (const ch of item.children) {
        out.push({ id: ch.id, label: `${item.label} — ${ch.label}` });
      }
    } else {
      out.push({ id: item.id, label: item.label });
    }
  }
  return out;
}

/** Módulos controláveis: Início (quadro) + itens do menu lateral. */
export const MODULOS_PERMISSAO = [
  { id: 'inicio', label: 'Início (Quadro)' },
  ...modulosFromNavItems(navItems),
];

const IDS_MODULO = new Set(MODULOS_PERMISSAO.map((m) => m.id));

function dispatchPermissoes() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vilareal:permissoes-usuarios-atualizadas'));
  }
}

function dispatchSessao() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vilareal:usuario-sessao-atualizada'));
  }
}

function dispatchOperadorEstacao() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vilareal:operador-estacao-atualizado'));
  }
}

/**
 * Identidade fixa desta estação (qual pessoa usa este computador).
 * Padrão: Itamar (master). Demais perfis não podem alternar o menu para “fingir” outro usuário.
 */
export function getOperadorEstacaoId() {
  if (typeof window === 'undefined') return USUARIO_MASTER_ID;
  if (featureFlags.requiresApiAuth) {
    const api = getApiUsuarioSessao();
    if (api?.id) return api.id;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_OPERADOR_ESTACAO);
    if (raw) {
      const id = JSON.parse(raw);
      if (typeof id === 'string' && id) {
        const ativos = getUsuariosAtivos();
        if (Array.isArray(ativos) && ativos.some((u) => String(u.id) === id)) {
          return id;
        }
      }
    }
  } catch {
    /* ignore */
  }
  return USUARIO_MASTER_ID;
}

export function setOperadorEstacaoId(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_OPERADOR_ESTACAO, JSON.stringify(userId));
    dispatchOperadorEstacao();
  } catch {
    /* ignore */
  }
}

/** Master (Itamar no mock ou admin id 1 na API com JWT) pode usar o seletor de perfil para testar como os outros. */
export function operadorPodeAlternarPerfil() {
  return isUsuarioMasterEstacao();
}

export function loadPermissoesMapa() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_PERMISSOES_USUARIOS);
    if (!raw) return {};
    const p = JSON.parse(raw);
    return p && typeof p === 'object' ? p : {};
  } catch {
    return {};
  }
}

/**
 * Mapa completo de permissões por usuário (para backup/export futuro).
 */
export function savePermissoesMapa(mapa) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_PERMISSOES_USUARIOS, JSON.stringify(mapa));
    dispatchPermissoes();
  } catch {
    /* quota */
  }
}

/**
 * @param {string} userId
 * @param {Record<string, boolean>} permsPorModulo — chaves = id do módulo
 */
export function savePermissoesUsuario(userId, permsPorModulo) {
  if (!userId) return;
  const map = loadPermissoesMapa();
  map[userId] = { ...permsPorModulo };
  savePermissoesMapa(map);
}

/**
 * Permissões efetivas: padrão **liberado**; valores salvos sobrescrevem.
 */
export function getPermissoesUsuario(userId) {
  const defaults = Object.fromEntries(MODULOS_PERMISSAO.map((m) => [m.id, true]));
  if (!userId) return defaults;
  const map = loadPermissoesMapa();
  const stored = map[userId];
  if (!stored || typeof stored !== 'object') return { ...defaults };
  const merged = { ...defaults, ...stored };
  if (
    Object.prototype.hasOwnProperty.call(stored, 'clientes') &&
    stored.clientes === false &&
    !Object.prototype.hasOwnProperty.call(stored, 'clientes/lista') &&
    !Object.prototype.hasOwnProperty.call(stored, 'clientes/nova') &&
    !Object.prototype.hasOwnProperty.call(stored, 'clientes/relatorio')
  ) {
    merged['clientes/lista'] = false;
    merged['clientes/nova'] = false;
    merged['clientes/relatorio'] = false;
  }
  return merged;
}

export function usuarioPodeAcessarModulo(userId, moduloId) {
  if (!moduloId || !IDS_MODULO.has(moduloId)) return true;
  const p = getPermissoesUsuario(userId);
  const vals = MODULOS_PERMISSAO.map((m) => p[m.id]);
  if (vals.length > 0 && vals.every((v) => v === false)) {
    return true;
  }
  return p[moduloId] !== false;
}

/**
 * Converte pathname da SPA em id de módulo (mesmo critério do menu).
 */
export function pathParaModuloId(pathname) {
  const path = String(pathname || '').replace(/\/+$/, '') || '/';
  if (path === '/' || path === '') return 'inicio';
  const noLead = path.replace(/^\//, '');
  if (noLead === 'clientes') return 'clientes/lista';
  if (noLead.startsWith('clientes/editar/')) return 'clientes/lista';
  if (noLead === 'clientes/relatorio') return 'clientes/relatorio';
  if (IDS_MODULO.has(noLead)) return noLead;
  const parts = noLead.split('/');
  for (let i = parts.length; i >= 1; i--) {
    const cand = parts.slice(0, i).join('/');
    if (IDS_MODULO.has(cand)) return cand;
  }
  const seg = parts[0];
  if (IDS_MODULO.has(seg)) return seg;
  return 'inicio';
}

/** Rótulo do menu / módulo para exibir em relatórios de auditoria. */
export function getRotuloModuloPorPathname(pathname) {
  const id = pathParaModuloId(pathname);
  const m = MODULOS_PERMISSAO.find((x) => x.id === id);
  return m?.label ?? id;
}

export function getUsuarioSessaoAtualId() {
  if (typeof window === 'undefined') return 'itamar';
  if (featureFlags.requiresApiAuth) {
    const api = getApiUsuarioSessao();
    if (api?.id && !idEhUsuarioMasterEstacao(api.id)) {
      return api.id;
    }
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_USUARIO_SESSAO_ATIVA);
    if (raw) {
      const id = JSON.parse(raw);
      if (typeof id === 'string' && id) {
        const ativos = getUsuariosAtivos();
        if (Array.isArray(ativos) && ativos.some((u) => String(u.id) === id)) {
          return id;
        }
      }
    }
  } catch {
    /* ignore */
  }
  const primeiro = getUsuariosAtivos()?.[0];
  return primeiro?.id || 'itamar';
}

export function setUsuarioSessaoAtualId(userId) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_USUARIO_SESSAO_ATIVA, JSON.stringify(userId));
    dispatchSessao();
  } catch {
    /* ignore */
  }
}

/**
 * Perfil cujas permissões e menu se aplicam: para não-master, sempre o operador da estação;
 * para o master, o valor escolhido no seletor (personificação para teste).
 */
export function getPerfilAtivoParaPermissoes() {
  if (operadorPodeAlternarPerfil()) {
    return getUsuarioSessaoAtualId();
  }
  return getOperadorEstacaoId();
}

/** Primeira rota permitida para o perfil (evita loop ao negar o módulo atual). */
export function getPrimeiraRotaPermitida(userId) {
  for (const m of MODULOS_PERMISSAO) {
    if (usuarioPodeAcessarModulo(userId, m.id)) {
      return m.id === 'inicio' ? '/' : `/${m.id}`;
    }
  }
  return '/';
}
