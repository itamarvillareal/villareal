import { listarPublicacoesModulo } from '../repositories/publicacoesRepository.js';
import { request } from './httpClient.js';

/**
 * Movimentações importadas via Gmail — Projudi TJGO (sistema-projudi@tjgo.jus.br)
 * e PUSH dos TRTs/PJe (ex.: nao-responda@trt18.jus.br). A tela «Movimentações Email»
 * mostra as duas origens juntas.
 */
const ORIGENS = ['PROJUDI', 'TRT'];

export async function buscarManifestacoesProjudi({ texto, status, filtroVinculo, recebimentoInicio, recebimentoFim } = {}) {
  const listas = await Promise.all(
    ORIGENS.map((origemImportacao) =>
      listarPublicacoesModulo({
        origemImportacao,
        texto: texto || undefined,
        statusTratamento: status || undefined,
        filtroVinculo: filtroVinculo || 'todos',
        recebimentoInicio: recebimentoInicio || undefined,
        recebimentoFim: recebimentoFim || undefined,
      }).catch(() => [])
    )
  );
  const vistos = new Set();
  const out = [];
  for (const lista of listas) {
    for (const row of lista) {
      const id = String(row?.id ?? '');
      if (id && vistos.has(id)) continue;
      if (id) vistos.add(id);
      out.push(row);
    }
  }
  return out;
}

/** Status da última busca incremental no Gmail (a mais recente entre Projudi e TRT). */
export async function obterSyncProjudi() {
  const [projudi, trt] = await Promise.all([
    request('/api/email/projudi/sync').catch(() => null),
    request('/api/email/trt/sync').catch(() => null),
  ]);
  const datas = [projudi?.ultimaSincronizacaoEm, trt?.ultimaSincronizacaoEm]
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return { ultimaSincronizacaoEm: datas[0] ?? null };
}

function mesclarResumos(resumos) {
  const validos = resumos.filter(Boolean);
  if (validos.length === 0) return null;
  const somar = (campo) => validos.reduce((acc, r) => acc + (Number(r?.[campo]) || 0), 0);
  const erros = validos.flatMap((r) => (Array.isArray(r?.erros) ? r.erros : []));
  const cursores = validos
    .map((r) => r?.ultimaSincronizacaoGravada)
    .filter(Boolean)
    .sort((a, b) => new Date(b).getTime() - new Date(a).getTime());
  return {
    forcarAtualizacao: validos.some((r) => r?.forcarAtualizacao),
    ultimaSincronizacaoGravada: cursores[0] ?? null,
    emailsLidos: somar('emailsLidos'),
    publicacoesEncontradas: somar('publicacoesEncontradas'),
    processosUnicos: somar('processosUnicos'),
    publicacoesProcessadas: somar('publicacoesProcessadas'),
    publicacoesDuplicadasIgnoradas: somar('publicacoesDuplicadasIgnoradas'),
    vinculosAutomaticos: somar('vinculosAutomaticos'),
    erros,
  };
}

/** Busca incremental (Projudi + TRT) ou caixa completa com `forcar: true`. */
export async function processarEmailsProjudiAgora({ forcar = false } = {}) {
  const qs = forcar ? '?forcar=true' : '';
  const [projudi, trt] = await Promise.all([
    request(`/api/email/projudi/processar${qs}`, { method: 'POST' }).catch((e) => ({
      erros: [`Projudi: ${e?.message || 'falha ao processar'}`],
    })),
    request(`/api/email/trt/processar${qs}`, { method: 'POST' }).catch((e) => ({
      erros: [`TRT: ${e?.message || 'falha ao processar'}`],
    })),
  ]);
  return mesclarResumos([projudi, trt]);
}
