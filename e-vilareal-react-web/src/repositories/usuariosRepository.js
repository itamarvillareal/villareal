import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import { getUsuariosAtivos, setUsuariosAtivos } from '../data/agendaPersistenciaData.js';

function mapApiUsuarioToView(u) {
  return {
    id: String(u.id),
    nome: String(u.nome ?? ''),
    numeroPessoa: u.pessoaId ?? null,
    apelido: String(u.apelido ?? ''),
    login: String(u.login ?? ''),
    senhaHash: '',
    ativo: u.ativo !== false,
    perfilIds: Array.isArray(u.perfilIds) ? u.perfilIds : [],
  };
}

function mapViewUsuarioToApi(u) {
  const senha = u.senha != null && String(u.senha).trim() !== '' ? String(u.senha).trim() : '';
  const base = {
    pessoaId: u.numeroPessoa != null && String(u.numeroPessoa) !== '' ? Number(u.numeroPessoa) : null,
    nome: String(u.nome ?? '').trim() || String(u.id ?? '').trim(),
    apelido: String(u.apelido ?? '').trim() || null,
    login: String(u.login ?? '').trim().toLowerCase(),
    ativo: u.ativo !== false,
  };
  if (senha.length >= 4) {
    return { ...base, senha };
  }
  return {
    ...base,
    senhaHash: String(u.senhaHash ?? '').trim() || 'sem-hash-definido',
  };
}

export async function listarUsuarios() {
  if (!featureFlags.useApiUsuarios) return getUsuariosAtivos();
  const data = await request('/api/usuarios');
  return Array.isArray(data) ? data.map(mapApiUsuarioToView) : [];
}

export async function salvarUsuario(usuario) {
  if (!featureFlags.useApiUsuarios) {
    const atual = getUsuariosAtivos();
    const next = atual.some((x) => String(x.id) === String(usuario.id))
      ? atual.map((x) => (String(x.id) === String(usuario.id) ? usuario : x))
      : [...atual, usuario];
    const r = setUsuariosAtivos(next);
    if (!r.ok) throw new Error(r.error || 'Falha ao salvar usuário.');
    return usuario;
  }

  const payload = mapViewUsuarioToApi(usuario);
  const idNum = Number(usuario.id);
  if (Number.isFinite(idNum) && idNum > 0) {
    const updated = await request(`/api/usuarios/${idNum}`, { method: 'PUT', body: payload });
    return mapApiUsuarioToView(updated);
  }
  const created = await request('/api/usuarios', { method: 'POST', body: payload });
  return mapApiUsuarioToView(created);
}

export async function alternarUsuarioAtivo(usuarioId, ativo) {
  if (!featureFlags.useApiUsuarios) {
    const atual = getUsuariosAtivos();
    const next = atual.map((u) => (String(u.id) === String(usuarioId) ? { ...u, ativo } : u));
    const r = setUsuariosAtivos(next);
    if (!r.ok) throw new Error(r.error || 'Falha ao atualizar usuário.');
    return;
  }
  const idNum = Number(usuarioId);
  if (!Number.isFinite(idNum) || idNum < 1) throw new Error('ID de usuário inválido para API.');
  await request(`/api/usuarios/${idNum}/ativo`, {
    method: 'PATCH',
    query: { value: ativo ? 'true' : 'false' },
  });
}

export async function vincularPerfisUsuario(usuarioId, perfilIds) {
  if (!featureFlags.useApiUsuarios) return;
  const idNum = Number(usuarioId);
  if (!Number.isFinite(idNum) || idNum < 1) throw new Error('ID de usuário inválido para API.');
  await request(`/api/usuarios/${idNum}/perfis`, {
    method: 'PUT',
    body: Array.isArray(perfilIds) ? perfilIds.map((x) => Number(x)).filter(Number.isFinite) : [],
  });
}
