import { listarPublicacoesModulo } from '../repositories/publicacoesRepository.js';
import { ordenarPorEntradaEmail } from '../data/publicacoesEmailOrdenacao.js';
import { request } from './httpClient.js';

/**
 * Movimentações importadas via Gmail — Projudi TJGO (sistema-projudi@tjgo.jus.br)
 * e PUSH dos TRTs/PJe (ex.: nao-responda@trt18.jus.br). A tela «Movimentações Email»
 * mostra as duas origens juntas.
 */
const ORIGENS = ['PROJUDI', 'TRT'];
const JOB_TERMINAL = new Set(['SUCCESS', 'ERROR', 'TIMEOUT']);
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 45 * 60 * 1000;

export async function buscarManifestacoesProjudi({ texto, status, filtroVinculo, recebimentoInicio, recebimentoFim } = {}) {
  const erros = [];
  const listas = await Promise.all(
    ORIGENS.map((origemImportacao) =>
      listarPublicacoesModulo({
        origemImportacao,
        texto: texto || undefined,
        statusTratamento: status || undefined,
        filtroVinculo: filtroVinculo || 'todos',
        recebimentoInicio: recebimentoInicio || undefined,
        recebimentoFim: recebimentoFim || undefined,
      }).catch((e) => {
        erros.push(e);
        return [];
      })
    )
  );
  if (erros.length === ORIGENS.length) {
    throw erros[0];
  }
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
  return ordenarPorEntradaEmail(out, false);
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

function respostaFalha(fonte, erro, forcar) {
  const msg = erro?.message || 'falha ao processar';
  return {
    erros: [`${fonte}: ${msg}`],
    forcarAtualizacao: forcar,
  };
}

function jobRunParaResumo(run, fonte) {
  if (!run) {
    return { erros: [`${fonte}: execução não encontrada`], forcarAtualizacao: true };
  }
  const md = run.metadata || {};
  const erros = [];
  if (run.status === 'ERROR' && run.errorMessage) {
    erros.push(`${fonte}: ${run.errorMessage}`);
  } else if (run.status === 'TIMEOUT') {
    erros.push(`${fonte}: tempo esgotado (processamento interrompido no servidor)`);
  }
  if (Array.isArray(md.erros)) {
    for (const item of md.erros) {
      erros.push(`${fonte}: ${item}`);
    }
  }
  return {
    emailsLidos: Number(md.emailsLidos) || run.itemsProcessed || 0,
    publicacoesEncontradas: Number(md.publicacoesEncontradas) || 0,
    processosUnicos: Number(md.processosUnicos) || 0,
    publicacoesProcessadas: Number(md.publicacoesProcessadas) || run.itemsProcessed || 0,
    publicacoesDuplicadasIgnoradas: Number(md.publicacoesDuplicadasIgnoradas) || 0,
    vinculosAutomaticos: Number(md.vinculosAutomaticos) || 0,
    forcarAtualizacao: md.forcarAtualizacao ?? true,
    ultimaSincronizacaoGravada: md.ultimaSincronizacaoGravada || null,
    erros,
  };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function aguardarJobRun(jobRunId, { onProgress, fonte } = {}) {
  const inicio = Date.now();
  while (Date.now() - inicio < POLL_TIMEOUT_MS) {
    const run = await request(`/api/jobs/runs/${jobRunId}`);
    onProgress?.(run, fonte);
    if (run?.status && JOB_TERMINAL.has(run.status)) {
      return run;
    }
    await sleep(POLL_INTERVAL_MS);
  }
  return {
    status: 'TIMEOUT',
    errorMessage: 'Tempo máximo de espera excedido no navegador',
    metadata: { forcarAtualizacao: true },
  };
}

async function processarFonte(path, fonte, forcar) {
  const qs = forcar ? '?forcar=true' : '';
  try {
    return await request(`${path}${qs}`, { method: 'POST' });
  } catch (e) {
    return respostaFalha(fonte, e, forcar);
  }
}

/** Busca incremental (Projudi + TRT) ou caixa completa com `forcar: true` (assíncrono). */
export async function processarEmailsProjudiAgora({ forcar = false, onProgress } = {}) {
  if (!forcar) {
    const [projudi, trt] = await Promise.all([
      processarFonte('/api/email/projudi/processar', 'Projudi', false),
      processarFonte('/api/email/trt/processar', 'TRT', false),
    ]);
    return mesclarResumos([projudi, trt]);
  }

  const [projudiStart, trtStart] = await Promise.all([
    processarFonte('/api/email/projudi/processar', 'Projudi', true),
    processarFonte('/api/email/trt/processar', 'TRT', true),
  ]);

  const falhasHttp = [projudiStart, trtStart].filter((r) => Array.isArray(r?.erros) && r.erros.length);
  if (falhasHttp.length === 2) {
    return mesclarResumos(falhasHttp);
  }

  const runs = await Promise.all([
    projudiStart?.async && projudiStart?.jobRunId
      ? aguardarJobRun(projudiStart.jobRunId, { onProgress, fonte: 'Projudi' })
      : Promise.resolve(null),
    trtStart?.async && trtStart?.jobRunId
      ? aguardarJobRun(trtStart.jobRunId, { onProgress, fonte: 'TRT' })
      : Promise.resolve(null),
  ]);

  return mesclarResumos([
    ...(falhasHttp.length ? falhasHttp : []),
    jobRunParaResumo(runs[0], 'Projudi'),
    jobRunParaResumo(runs[1], 'TRT'),
  ]);
}
