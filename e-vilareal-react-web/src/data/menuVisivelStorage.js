/**
 * Preferência de menu lateral por usuário: visibilidade + ordem.
 * Cache local espelha o banco (`/api/configuracoes/menu-lateral`).
 */

import { navItems } from './navConfig.js';

export const STORAGE_MENU_PREFERENCIA = 'vilareal.usuarios.menuPreferencia.v2';
/** @deprecated migrado para v2 */
export const STORAGE_MENU_VISIVEL = 'vilareal.usuarios.menuVisivel.v1';

/** Item que não pode ser ocultado — garante retorno à tela de configuração. */
export const MODULO_MENU_SEMPRE_VISIVEL = 'configuracoes';

/**
 * Estrutura do menu (topo + filhos) para UI e persistência.
 * @returns {{ id: string, label: string, children: { id: string, label: string }[] | null }[]}
 */
export function getEstruturaMenuLateral() {
  return navItems.map((item) => ({
    id: item.id,
    label: item.label,
    children:
      Array.isArray(item.children) && item.children.length > 0
        ? item.children.map((ch) => ({ id: ch.id, label: ch.label }))
        : null,
  }));
}

/** Lista plana de módulos (topo e filhos) — compatível com checkboxes legados. */
export const MODULOS_MENU = (() => {
  const out = [];
  for (const item of getEstruturaMenuLateral()) {
    if (item.children) {
      out.push({ id: item.id, label: item.label, grupo: true });
      for (const ch of item.children) {
        out.push({ id: ch.id, label: `${item.label} — ${ch.label}` });
      }
    } else {
      out.push({ id: item.id, label: item.label });
    }
  }
  return out;
})();

const IDS_MODULO_MENU = new Set(MODULOS_MENU.map((m) => m.id));

/**
 * @typedef {{ id: string, visivel: boolean, ordem: number }} MenuItemPreferencia
 */

function dispatchMenuVisivel() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('vilareal:menu-visivel-atualizado'));
  }
}

/** Preferência padrão: tudo visível, ordem = índice no catálogo. */
export function preferenciaMenuPadrao() {
  /** @type {MenuItemPreferencia[]} */
  const itens = [];
  let ordem = 0;
  for (const item of getEstruturaMenuLateral()) {
    itens.push({ id: item.id, visivel: true, ordem: ordem++ });
    if (item.children) {
      item.children.forEach((ch, i) => {
        itens.push({ id: ch.id, visivel: true, ordem: i });
      });
    }
  }
  return { itens };
}

function migrarV1SeNecessario(mapaV2) {
  if (typeof window === 'undefined') return mapaV2;
  try {
    const raw = window.localStorage.getItem(STORAGE_MENU_VISIVEL);
    if (!raw) return mapaV2;
    const antigo = JSON.parse(raw);
    if (!antigo || typeof antigo !== 'object') return mapaV2;
    const padrao = preferenciaMenuPadrao();
    for (const [userId, visivelMap] of Object.entries(antigo)) {
      if (!userId || mapaV2[userId] || !visivelMap || typeof visivelMap !== 'object') continue;
      mapaV2[userId] = {
        itens: padrao.itens.map((it) => ({
          ...it,
          visivel: it.id === MODULO_MENU_SEMPRE_VISIVEL ? true : visivelMap[it.id] !== false,
        })),
      };
    }
  } catch {
    /* ignore */
  }
  return mapaV2;
}

export function loadMenuPreferenciaMapa() {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_MENU_PREFERENCIA);
    let mapa = {};
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p === 'object') mapa = p;
    }
    mapa = migrarV1SeNecessario(mapa);
    return mapa;
  } catch {
    return {};
  }
}

export function saveMenuPreferenciaMapa(mapa) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_MENU_PREFERENCIA, JSON.stringify(mapa));
    dispatchMenuVisivel();
  } catch {
    /* quota */
  }
}

/**
 * Normaliza itens vindos da API ou UI.
 * @param {Array<{ id?: string, moduloId?: string, visivel?: boolean, ordem?: number }>} itens
 * @returns {MenuItemPreferencia[]}
 */
export function normalizarItensPreferencia(itens) {
  const padrao = preferenciaMenuPadrao();
  const porId = new Map(padrao.itens.map((it) => [it.id, { ...it }]));
  if (Array.isArray(itens)) {
    for (const raw of itens) {
      if (!raw) continue;
      const id = String(raw.id ?? raw.moduloId ?? '').trim();
      if (!id || !porId.has(id)) continue;
      const cur = porId.get(id);
      cur.visivel = id === MODULO_MENU_SEMPRE_VISIVEL ? true : raw.visivel !== false;
      if (Number.isFinite(Number(raw.ordem))) cur.ordem = Number(raw.ordem);
    }
  }
  return [...porId.values()];
}

/**
 * @param {string} userId
 * @param {MenuItemPreferencia[] | Record<string, boolean>} preferenciaOuVisivel
 */
export function saveMenuVisivelUsuario(userId, preferenciaOuVisivel) {
  if (!userId) return;
  const map = loadMenuPreferenciaMapa();
  let itens;
  if (Array.isArray(preferenciaOuVisivel)) {
    itens = normalizarItensPreferencia(preferenciaOuVisivel);
  } else if (preferenciaOuVisivel && Array.isArray(preferenciaOuVisivel.itens)) {
    itens = normalizarItensPreferencia(preferenciaOuVisivel.itens);
  } else if (preferenciaOuVisivel && typeof preferenciaOuVisivel === 'object') {
    const padrao = preferenciaMenuPadrao();
    itens = padrao.itens.map((it) => ({
      ...it,
      visivel:
        it.id === MODULO_MENU_SEMPRE_VISIVEL ? true : preferenciaOuVisivel[it.id] !== false,
    }));
  } else {
    itens = preferenciaMenuPadrao().itens;
  }
  const cfg = itens.find((it) => it.id === MODULO_MENU_SEMPRE_VISIVEL);
  if (cfg) cfg.visivel = true;
  map[userId] = { itens };
  saveMenuPreferenciaMapa(map);
}

/**
 * @param {string} userId
 * @returns {{ itens: MenuItemPreferencia[] }}
 */
export function getMenuPreferenciaUsuario(userId) {
  const padrao = preferenciaMenuPadrao();
  if (!userId) return padrao;
  const map = loadMenuPreferenciaMapa();
  const stored = map[userId];
  if (!stored || !Array.isArray(stored.itens)) return padrao;
  return { itens: normalizarItensPreferencia(stored.itens) };
}

/**
 * Mapa id → visível (compatível com UI antiga).
 * @returns {Record<string, boolean>}
 */
export function getMenuVisivelUsuario(userId) {
  const { itens } = getMenuPreferenciaUsuario(userId);
  return Object.fromEntries(itens.map((it) => [it.id, it.visivel !== false]));
}

/**
 * @param {string} userId
 * @param {string} moduloId
 */
export function usuarioMenuExibeModulo(userId, moduloId) {
  if (!moduloId) return true;
  if (moduloId === MODULO_MENU_SEMPRE_VISIVEL) return true;
  if (!IDS_MODULO_MENU.has(moduloId)) return true;
  const { itens } = getMenuPreferenciaUsuario(userId);
  const found = itens.find((it) => it.id === moduloId);
  return found ? found.visivel !== false : true;
}

/**
 * Ordena itens do navConfig conforme preferência do usuário.
 * @param {typeof navItems} items
 * @param {string} userId
 */
export function ordenarNavItemsPorPreferencia(items, userId) {
  const { itens } = getMenuPreferenciaUsuario(userId);
  const ordemTopo = new Map();
  for (const it of itens) {
    ordemTopo.set(it.id, it.ordem);
  }
  const estrutura = getEstruturaMenuLateral();
  const filhosPorGrupo = new Map(
    estrutura.filter((e) => e.children).map((e) => [e.id, e.children.map((c) => c.id)]),
  );

  const sorted = [...items].sort((a, b) => {
    const oa = ordemTopo.has(a.id) ? ordemTopo.get(a.id) : Number.MAX_SAFE_INTEGER;
    const ob = ordemTopo.has(b.id) ? ordemTopo.get(b.id) : Number.MAX_SAFE_INTEGER;
    if (oa !== ob) return oa - ob;
    return 0;
  });

  return sorted.map((item) => {
    if (!Array.isArray(item.children) || item.children.length === 0) return item;
    const idsFilhos = filhosPorGrupo.get(item.id) || item.children.map((c) => c.id);
    const ordemFilho = new Map();
    for (const id of idsFilhos) {
      const pref = itens.find((x) => x.id === id);
      if (pref) ordemFilho.set(id, pref.ordem);
    }
    const children = [...item.children].sort((a, b) => {
      const oa = ordemFilho.has(a.id) ? ordemFilho.get(a.id) : Number.MAX_SAFE_INTEGER;
      const ob = ordemFilho.has(b.id) ? ordemFilho.get(b.id) : Number.MAX_SAFE_INTEGER;
      if (oa !== ob) return oa - ob;
      return 0;
    });
    return { ...item, children };
  });
}

/**
 * Converte preferência local → payload da API.
 * @param {{ itens: MenuItemPreferencia[] }} preferencia
 */
export function preferenciaParaApi(preferencia) {
  const itens = normalizarItensPreferencia(preferencia?.itens);
  return {
    itens: itens.map((it) => ({
      moduloId: it.id,
      visivel: it.visivel !== false,
      ordem: it.ordem,
    })),
  };
}

/**
 * Aplica resposta da API no cache local.
 * @param {string} userId
 * @param {{ itens?: Array<{ moduloId?: string, id?: string, visivel?: boolean, ordem?: number }> }} resposta
 */
export function aplicarPreferenciaApiNoCache(userId, resposta) {
  if (!userId) return;
  saveMenuVisivelUsuario(userId, resposta?.itens || []);
}
