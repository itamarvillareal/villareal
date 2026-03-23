import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';

export async function carregarPessoaComplementar(pessoaId) {
  if (!featureFlags.useApiPessoasComplementares) return null;
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return null;
  try {
    return await request(`/api/pessoas/${id}/complementares`);
  } catch (err) {
    if (String(err?.message || '').includes('404')) return null;
    return null;
  }
}

export async function salvarPessoaComplementar(pessoaId, dados) {
  if (!featureFlags.useApiPessoasComplementares) return null;
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return null;
  return request(`/api/pessoas/${id}/complementares`, {
    method: 'PUT',
    body: {
      rg: String(dados.rg ?? '').trim() || null,
      orgaoExpedidor: String(dados.orgaoExpedidor ?? '').trim() || null,
      profissao: String(dados.profissao ?? '').trim() || null,
      nacionalidade: String(dados.nacionalidade ?? '').trim() || null,
      estadoCivil: String(dados.estadoCivil ?? '').trim() || null,
      genero: String(dados.genero ?? '').trim() || null,
    },
  });
}
