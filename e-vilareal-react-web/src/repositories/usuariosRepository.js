import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import { clampCadastroPessoasPageSize } from '../api/clientesService.js';
import { getUsuariosAtivos, setUsuariosAtivos } from '../data/agendaPersistenciaData.js';

export function mapApiUsuarioToView(u) {
  return {
    id: String(u.id),
    nome: String(u.nome ?? ''),
    nomePessoa: String(u.nomePessoa ?? '').trim(),
    numeroPessoa: u.pessoaId ?? null,
    apelido: String(u.apelido ?? ''),
    login: String(u.login ?? ''),
    senhaHash: '',
    ativo: u.ativo !== false,
    perfilId:
      u.perfilId != null && Number.isFinite(Number(u.perfilId)) ? Number(u.perfilId) : null,
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

export async function listarUsuariosPaginados(p = {}, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiUsuarios) {
    return {
      content: [],
      totalElements: 0,
      totalPages: 0,
      size: p.size ?? 20,
      number: 0,
    };
  }
  const {
    page = 0,
    size = 20,
    sort = 'id,asc',
    apenasAtivos = false,
    nome,
    login,
    codigo,
    pessoaId,
    nomePessoa,
  } = p;
  const qs = new URLSearchParams();
  qs.set('page', String(Math.max(0, page)));
  qs.set('size', String(clampCadastroPessoasPageSize(size)));
  if (sort) qs.set('sort', sort);
  if (apenasAtivos) qs.set('apenasAtivos', 'true');
  if (nome != null && String(nome).trim()) qs.set('nome', String(nome).trim());
  if (login != null && String(login).trim()) qs.set('login', String(login).trim().toLowerCase());
  if (codigo != null && Number.isFinite(Number(codigo)) && Number(codigo) >= 1) {
    qs.set('codigo', String(Math.floor(Number(codigo))));
  }
  if (pessoaId != null && Number.isFinite(Number(pessoaId)) && Number(pessoaId) >= 1) {
    qs.set('pessoaId', String(Math.floor(Number(pessoaId))));
  }
  if (nomePessoa != null && String(nomePessoa).trim()) qs.set('nomePessoa', String(nomePessoa).trim());
  const raw = await request(`/api/usuarios/paginada?${qs.toString()}`, { signal });
  const content = Array.isArray(raw?.content) ? raw.content.map(mapApiUsuarioToView) : [];
  return {
    ...raw,
    content,
  };
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
  const raw = Array.isArray(perfilIds) ? perfilIds : [perfilIds];
  const ids = raw.map((x) => Number(x)).filter(Number.isFinite);
  if (ids.length !== 1) {
    throw new Error('Informe exatamente um perfil (um id numérico ou array com um elemento).');
  }
  await request(`/api/usuarios/${idNum}/perfis`, {
    method: 'PUT',
    body: ids,
  });
}
