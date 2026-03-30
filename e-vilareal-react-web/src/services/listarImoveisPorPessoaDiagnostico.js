import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';

function safeExtrasJson(raw) {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) return raw;
  if (!raw || typeof raw !== 'string') return {};
  try {
    const o = JSON.parse(raw);
    return o && typeof o === 'object' ? o : {};
  } catch {
    return {};
  }
}

/**
 * Imóveis em que a pessoa aparece como locador ou inquilino (contratos na API).
 * Sem `useApiImoveis`, retorna lista vazia (cadastro de imóvel legado não é indexado por pessoa).
 *
 * @param {number|string} pessoaId
 * @returns {Promise<Array<{ imovelId: number, papel: string, endereco: string, unidade: string, condominio: string, codigo: string, proc: string }>>}
 */
export async function listarImoveisResumoPorPessoaDiagnostico(pessoaId) {
  const id = Number(pessoaId);
  if (!Number.isFinite(id) || id < 1) return [];

  if (!featureFlags.useApiImoveis) {
    return [];
  }

  try {
    const imoveis = await request('/api/imoveis');
    if (!Array.isArray(imoveis) || imoveis.length === 0) return [];

    const out = [];
    for (const im of imoveis) {
      const imovelId = Number(im?.id);
      if (!Number.isFinite(imovelId)) continue;

      let contratos = [];
      try {
        contratos = await request('/api/locacoes/contratos', { query: { imovelId } });
      } catch {
        contratos = [];
      }
      if (!Array.isArray(contratos) || contratos.length === 0) continue;

      const papeis = new Set();
      for (const c of contratos) {
        if (Number(c.locadorPessoaId) === id) papeis.add('proprietário(a)');
        if (Number(c.inquilinoPessoaId) === id) papeis.add('inquilino(a)');
      }
      if (papeis.size === 0) continue;

      const extras = safeExtrasJson(im.camposExtrasJson);
      for (const papel of papeis) {
        out.push({
          imovelId,
          papel,
          endereco: String(im.enderecoCompleto || '').trim() || '—',
          unidade: String(im.unidade || extras.unidade || '').trim() || '',
          condominio: String(im.condominio || '').trim() || '',
          codigo: String(extras.codigo || '').trim(),
          proc: String(extras.proc || '').trim(),
        });
      }
    }
    out.sort((a, b) => a.imovelId - b.imovelId || String(a.papel).localeCompare(String(b.papel)));
    return out;
  } catch {
    return [];
  }
}
