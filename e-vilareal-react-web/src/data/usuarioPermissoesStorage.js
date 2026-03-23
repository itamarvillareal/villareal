/**
 * Permissões de acesso por usuário (id da lista Agenda/Usuários) e perfil ativo na sessão.
 */

import { navItems } from './mockData.js';
import { getUsuariosAtivos } from './agendaPersistenciaData.js';

export const STORAGE_PERMISSOES_USUARIOS = 'vilareal.usuarios.permissoes.v1';
export const STORAGE_USUARIO_SESSAO_ATIVA = 'vilareal.usuario.sessaoAtiva.v1';
/** Quem usa de fato esta estação (navegador). Só o master (Itamar) pode alternar o perfil ativo para testar outros. */
export const STORAGE_OPERADOR_ESTACAO = 'vilareal.usuario.operadorEstacao.v1';

/** Id do usuário master — único que pode escolher outros perfis no menu (teste do sistema). */
export const USUARIO_MASTER_ID = 'itamar';

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

/** Itamar é o único que pode usar o seletor de perfil para testar como os outros. */
export function operadorPodeAlternarPerfil() {
  return getOperadorEstacaoId() === USUARIO_MASTER_ID;
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
  return { ...defaults, ...stored };
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
  const seg = path.replace(/^\//, '').split('/')[0];
  if (IDS_MODULO.has(seg)) return seg;
  return 'inicio';
}

export function getUsuarioSessaoAtualId() {
  if (typeof window === 'undefined') return 'itamar';
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
