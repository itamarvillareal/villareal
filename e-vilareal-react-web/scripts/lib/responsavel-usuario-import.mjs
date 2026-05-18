/**
 * Casamento de nome de responsável (txt/planilha) com GET /api/usuarios.
 */

import { normalizarResponsavelHistorico } from './historico-responsavel-import.mjs';

function normChave(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/**
 * @param {object[]} usuarios — resposta GET /api/usuarios
 * @returns {Map<string, number>}
 */
export function construirMapaUsuarioPorNomeResponsavel(usuarios) {
  const map = new Map();
  function add(raw, id) {
    const k = normChave(raw);
    if (!k) return;
    if (!map.has(k)) map.set(k, id);
  }

  for (const u of usuarios ?? []) {
    if (!u || u.ativo === false) continue;
    const id = u.id;
    add(u.login, id);
    add(u.nome, id);
    add(u.nomePessoa, id);
    add(u.apelido, id);
    if (u.nome) {
      const tok = String(u.nome).trim().split(/\s+/).filter(Boolean);
      if (tok[0]) add(tok[0], id);
      if (tok.length >= 2) add(`${tok[0]} ${tok[1]}`, id);
    }
  }
  return map;
}

/**
 * @param {string | null | undefined} nomeBruto — conteúdo do txt 20.1
 * @param {Map<string, number>} mapa
 * @returns {number | null}
 */
export function resolverUsuarioResponsavelId(nomeBruto, mapa) {
  const nome = normalizarResponsavelHistorico(nomeBruto);
  if (!nome || !mapa?.size) return null;
  const id = mapa.get(normChave(nome));
  return id != null ? id : null;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 */
export async function fetchUsuariosImportApi(baseUrl, token) {
  const r = await fetch(`${baseUrl}/api/usuarios`, {
    headers: { Authorization: `Bearer ${token}`, Accept: 'application/json' },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET /api/usuarios: ${r.status} ${t.slice(0, 300)}`);
  }
  return r.json();
}
