/**
 * Corpo PUT /api/processos/{id} — preserva campos não alterados pelo patch.
 */

import { clientePkFromApiDto } from './vilareal-import-processo-api.mjs';

/**
 * @param {object} p — ProcessoResponse da API
 * @param {Record<string, unknown>} [patch]
 */
export function corpoPutProcesso(p, patch = {}) {
  const px = patch ?? {};
  const clientePk = clientePkFromApiDto(p);
  const titular = Number(p.pessoaTitularId ?? p.pessoaId);
  const body = {
    clienteId: clientePk,
    numeroInterno: p.numeroInterno,
    numeroCnj: px.numeroCnj !== undefined ? px.numeroCnj : (p.numeroCnj ?? null),
    numeroProcessoAntigo:
      px.numeroProcessoAntigo !== undefined ? px.numeroProcessoAntigo : (p.numeroProcessoAntigo ?? null),
    naturezaAcao: px.naturezaAcao !== undefined ? px.naturezaAcao : (p.naturezaAcao ?? null),
    descricaoAcao: px.descricaoAcao !== undefined ? px.descricaoAcao : (p.descricaoAcao ?? null),
    competencia: px.competencia !== undefined ? px.competencia : (p.competencia ?? null),
    fase: px.fase !== undefined ? px.fase : (p.fase ?? null),
    observacaoFase:
      px.observacaoFase !== undefined ? px.observacaoFase : (p.observacaoFase ?? null),
    tramitacao: px.tramitacao !== undefined ? px.tramitacao : (p.tramitacao ?? null),
    dataProtocolo: px.dataProtocolo !== undefined ? px.dataProtocolo : (p.dataProtocolo ?? null),
    prazoFatal: px.prazoFatal !== undefined ? px.prazoFatal : (p.prazoFatal ?? null),
    proximaConsulta: px.proximaConsulta !== undefined ? px.proximaConsulta : (p.proximaConsulta ?? null),
    observacao: px.observacao !== undefined ? px.observacao : (p.observacao ?? null),
    valorCausa: px.valorCausa !== undefined ? px.valorCausa : (p.valorCausa ?? null),
    uf: px.uf !== undefined ? px.uf : (p.uf ?? null),
    cidade: px.cidade !== undefined ? px.cidade : (p.cidade ?? null),
    unidade: px.unidade !== undefined ? px.unidade : (p.unidade ?? null),
    pasta: px.pasta !== undefined ? px.pasta : (p.pasta ?? null),
    papelCliente: px.papelCliente !== undefined ? px.papelCliente : (p.papelCliente ?? null),
    audienciaData: px.audienciaData !== undefined ? px.audienciaData : (p.audienciaData ?? null),
    audienciaHora: px.audienciaHora !== undefined ? px.audienciaHora : (p.audienciaHora ?? null),
    audienciaTipo: px.audienciaTipo !== undefined ? px.audienciaTipo : (p.audienciaTipo ?? null),
    avisoAudiencia: px.avisoAudiencia !== undefined ? px.avisoAudiencia : (p.avisoAudiencia ?? null),
    consultaAutomatica: p.consultaAutomatica ?? false,
    ativo: px.ativo !== undefined ? px.ativo : (p.ativo ?? true),
    consultor: px.consultor !== undefined ? px.consultor : (p.consultor ?? null),
    usuarioResponsavelId:
      px.usuarioResponsavelId !== undefined ? px.usuarioResponsavelId : (p.usuarioResponsavelId ?? null),
  };
  if (Number.isFinite(titular) && titular > 0) {
    body.pessoaTitularId = titular;
  }
  return body;
}

/**
 * @param {string} baseUrl
 * @param {string} token
 * @param {object} proc
 * @param {Record<string, unknown>} patch
 */
export async function atualizarProcessoApi(baseUrl, token, proc, patch) {
  const res = await fetch(`${baseUrl}/api/processos/${proc.id}`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(corpoPutProcesso(proc, patch)),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`PUT processo ${proc.id}: ${res.status} ${t.slice(0, 300)}`);
  }
}
