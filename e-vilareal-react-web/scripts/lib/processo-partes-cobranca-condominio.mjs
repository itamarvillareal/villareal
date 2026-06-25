/**
 * Partes padrão — cobrança condominial (cliente = condomínio, devedor = parte oposta).
 * Alinha com processos existentes do cliente 299 (AUTOR = condomínio, REU = devedor).
 */

import { listarPartes } from './proc-processo-partes-api.mjs';

export const ORIGEM_IMPORT_PARTES_ACORDO = 'import-acordos-terra-mundi';

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {object} body
 */
async function postParte(baseUrl, token, processoId, body) {
  const res = await fetch(`${baseUrl}/api/processos/${processoId}/partes`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify({ ...body, importacaoId: ORIGEM_IMPORT_PARTES_ACORDO }),
  });
  const txt = await res.text();
  if (!res.ok) return { ok: false, status: res.status, text: txt.slice(0, 300) };
  try {
    return { ok: true, data: JSON.parse(txt) };
  } catch {
    return { ok: true };
  }
}

/**
 * Titular do processo = pessoa do cliente (condomínio), não o devedor da unidade.
 * @param {string} baseUrl
 * @param {string} token
 * @param {object} proc resposta GET processo
 */
export async function corrigirTitularProcessoParaCliente(baseUrl, token, proc) {
  const body = {
    clienteId: proc.clienteId,
    numeroInterno: proc.numeroInterno,
    ativo: proc.ativo !== false,
    consultaAutomatica: proc.consultaAutomatica === true,
    unidade: proc.unidade ?? null,
    descricaoAcao: proc.descricaoAcao ?? null,
  };
  const res = await fetch(`${baseUrl}/api/processos/${proc.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Accept: 'application/json',
    },
    body: JSON.stringify(body),
  });
  const txt = await res.text();
  if (!res.ok) return { ok: false, status: res.status, text: txt.slice(0, 300) };
  return { ok: true };
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {number} processoId
 * @param {number} condominioPessoaId
 * @param {number} devedorPessoaId
 */
export async function garantirPartesCobrancaCondominio(
  baseUrl,
  token,
  processoId,
  condominioPessoaId,
  devedorPessoaId
) {
  const stats = { autorCriado: 0, reuCriado: 0, jaOk: 0, falhas: 0 };
  const existentes = await listarPartes(baseUrl, token, processoId);

  const temAutor = existentes.some(
    (p) => String(p.polo ?? '').toUpperCase() === 'AUTOR' && Number(p.pessoaId) === condominioPessoaId
  );
  const temReu = existentes.some(
    (p) => String(p.polo ?? '').toUpperCase() === 'REU' && Number(p.pessoaId) === devedorPessoaId
  );

  if (temAutor && temReu) {
    stats.jaOk = 1;
    return stats;
  }

  if (!temAutor) {
    const r = await postParte(baseUrl, token, processoId, {
      pessoaId: condominioPessoaId,
      nomeLivre: null,
      polo: 'AUTOR',
      qualificacao: 'endereco:1',
      ordem: 1,
      advogadoPessoaIds: [],
    });
    if (r.ok) stats.autorCriado = 1;
    else stats.falhas += 1;
  }

  if (!temReu) {
    const r = await postParte(baseUrl, token, processoId, {
      pessoaId: devedorPessoaId,
      nomeLivre: null,
      polo: 'REU',
      qualificacao: null,
      ordem: 1,
      advogadoPessoaIds: [],
    });
    if (r.ok) stats.reuCriado = 1;
    else stats.falhas += 1;
  }

  return stats;
}
