import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  MODULOS_PERMISSAO,
  getPermissoesUsuario,
  savePermissoesUsuario,
} from '../data/usuarioPermissoesStorage.js';
import { vincularPerfisUsuario } from './usuariosRepository.js';

function codigoPermissao(moduloId) {
  return `mod_${String(moduloId).replace(/[^a-zA-Z0-9_/-]/g, '_')}`;
}

function codigoPerfilUsuario(usuarioId) {
  return `usr_${String(usuarioId).replace(/[^a-zA-Z0-9_-]/g, '_')}`.slice(0, 80);
}

async function garantirPermissoesCatalogo() {
  const existentes = await request('/api/permissoes');
  const mapa = new Map((existentes || []).map((p) => [String(p.codigo), p]));
  const out = [...(existentes || [])];
  for (const modulo of MODULOS_PERMISSAO) {
    const codigo = codigoPermissao(modulo.id);
    if (mapa.has(codigo)) continue;
    const criado = await request('/api/permissoes', {
      method: 'POST',
      body: {
        codigo,
        modulo: modulo.id,
        descricao: modulo.label,
      },
    });
    out.push(criado);
    mapa.set(codigo, criado);
  }
  return out;
}

async function garantirPerfilUsuario(usuarioId) {
  const codigo = codigoPerfilUsuario(usuarioId);
  const perfis = await request('/api/perfis');
  const existente = (perfis || []).find((p) => String(p.codigo) === codigo);
  if (existente) return existente;
  return request('/api/perfis', {
    method: 'POST',
    body: {
      codigo,
      nome: `Perfil ${usuarioId}`,
      descricao: 'Perfil técnico criado para ACL por usuário no frontend.',
      ativo: true,
    },
  });
}

export async function carregarPermissoesUsuario(usuarioId) {
  if (!featureFlags.useApiPerfisPermissoes) return getPermissoesUsuario(usuarioId);
  const defaults = Object.fromEntries(MODULOS_PERMISSAO.map((m) => [m.id, true]));
  const perfil = await garantirPerfilUsuario(usuarioId);
  const permissoes = await request('/api/permissoes');
  const byId = new Map((permissoes || []).map((p) => [Number(p.id), p]));
  const idsAtivos = new Set(Array.isArray(perfil.permissaoIds) ? perfil.permissaoIds.map(Number) : []);
  const out = { ...defaults };
  for (const modulo of MODULOS_PERMISSAO) {
    const perm = (permissoes || []).find((p) => String(p.codigo) === codigoPermissao(modulo.id));
    if (!perm) continue;
    out[modulo.id] = idsAtivos.has(Number(perm.id));
  }
  return out;
}

export async function salvarPermissoesUsuarioApi(usuarioId, checks) {
  if (!featureFlags.useApiPerfisPermissoes) {
    savePermissoesUsuario(usuarioId, checks);
    return;
  }
  const permissoes = await garantirPermissoesCatalogo();
  const perfil = await garantirPerfilUsuario(usuarioId);
  const permissaoIds = MODULOS_PERMISSAO
    .filter((m) => checks[m.id])
    .map((m) => permissoes.find((p) => String(p.codigo) === codigoPermissao(m.id))?.id)
    .filter((id) => Number.isFinite(Number(id)))
    .map(Number);
  await request(`/api/perfis/${perfil.id}/permissoes`, {
    method: 'PUT',
    body: permissaoIds,
  });
  await vincularPerfisUsuario(usuarioId, [perfil.id]);
}
