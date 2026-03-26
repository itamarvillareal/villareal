import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  appendPublicacoesConfirmadas,
  limparTodasPublicacoesImportadas,
  loadPublicacoesImportadas,
  updatePublicacaoImportada,
} from '../data/publicacoesStorage.js';
import { listarPublicacoesDoProcesso } from '../data/publicacoesPorProcesso.js';
import { normalizarCnjParaChave } from '../data/publicacoesPdfParser.js';
import { buscarProcessoPorChaveNatural, resolverProcessoId } from './processosRepository.js';

/**
 * Camadas deste módulo:
 * - API-first: leituras e PATCH quando `useApiPublicacoes`.
 * - Legado: `publicacoesStorage` / `publicacoesPorProcesso` quando a flag está off ou como fallback explícito.
 * - Transição: mesclagem API + itens locais sem par `hash_conteudo` correspondente (relatório por processo).
 */

const PHASE6_PUBLICACOES_DONE_KEY = 'vilareal:migration:phase6-publicacoes:done:v1';

/**
 * Limpa armazenamento local, o marcador da migração fase 6 e, com API ativa, tenta DELETE em cada publicação retornada pelo GET.
 */
export async function limparTodasPublicacoes() {
  limparTodasPublicacoesImportadas();
  if (typeof window !== 'undefined') {
    try {
      window.localStorage.removeItem(PHASE6_PUBLICACOES_DONE_KEY);
    } catch {
      /* ignore */
    }
  }

  let apiRemovidos = 0;
  if (featureFlags.useApiPublicacoes) {
    try {
      const data = await request('/api/publicacoes', { query: {} });
      const rows = Array.isArray(data) ? data : [];
      for (const r of rows) {
        const id = r?.id;
        if (id == null || !Number.isFinite(Number(id))) continue;
        try {
          await request(`/api/publicacoes/${Number(id)}`, { method: 'DELETE' });
          apiRemovidos += 1;
        } catch {
          /* ignora item (endpoint ausente, 404, etc.) */
        }
      }
    } catch {
      /* lista indisponível */
    }
  }

  return { apiRemovidos, localLimpo: true };
}

function padCodCliente(cod) {
  const n = String(cod ?? '').replace(/\D/g, '');
  if (!n) return '';
  return n.padStart(8, '0').slice(-8);
}

function normProcInterno(proc) {
  const n = Number(String(proc ?? '').replace(/\D/g, ''));
  if (!Number.isFinite(n) || n < 1) return '';
  return String(Math.floor(n));
}

function mapApiStatusToUiVinculo(statusTratamento, processoId) {
  if (statusTratamento === 'VINCULADA' || statusTratamento === 'TRATADA' || Number(processoId)) return 'vinculado';
  if (statusTratamento === 'IGNORADA') return 'ignorada';
  return 'nao_vinculado';
}

export function mapApiPublicacaoToUi(r) {
  return {
    id: String(r.id),
    _apiId: r.id,
    dataImportacao: r.createdAt || '',
    importacaoConfirmadaEm: r.createdAt || '',
    arquivoOrigem: r.arquivoOrigemNome || '',
    hashArquivo: r.arquivoOrigemHash || '',
    processoCnjNormalizado: r.numeroProcessoEncontrado || '',
    numero_processo_cnj: r.numeroProcessoEncontrado || '',
    procInterno: '',
    codCliente: '',
    cliente: r.clienteId ? `Cliente #${r.clienteId}` : '',
    diario: r.diario || r.fonte || '',
    tribunalPdf: '',
    tribunalCnj: '',
    orgaoTribunal: '',
    orgaoJulgador: '',
    classeProcessual: '',
    assuntos: null,
    grau: '',
    nivelSigilo: '',
    dataDisponibilizacao: r.dataDisponibilizacao ? String(r.dataDisponibilizacao).split('-').reverse().join('/') : '',
    dataPublicacao: r.dataPublicacao ? String(r.dataPublicacao).split('-').reverse().join('/') : '',
    tipoPublicacao: r.tipoPublicacao || '',
    teorIntegral: r.teor || '',
    resumoPublicacao: r.resumo || '',
    statusPublicacao: '',
    statusVinculo: mapApiStatusToUiVinculo(r.statusTratamento, r.processoId),
    statusValidacaoCnj: r.statusValidacaoCnj || 'nao_consultado',
    scoreConfianca: r.scoreConfianca || '',
    hashTeor: r.hashTeor || '',
    hashDedup: r.hashConteudo || '',
    observacoesTecnicas: r.observacao || '',
    jsonCnjBruto: r.jsonReferencia || null,
    linkArquivoOrigem: '',
    importadoPor: 'api',
    vinculoOrigem: r.processoId ? 'api' : '',
    _statusTratamento: r.statusTratamento || 'PENDENTE',
    _origemImportacao: r.origemImportacao || 'MANUAL',
    _processoId: r.processoId ?? null,
    _clienteId: r.clienteId ?? null,
  };
}

/** Usado na importação (prévia PDF) e na migração assistida do legado — formato de item gravado localmente. */
function mapPreviewItemToApiRequest(item, arquivoOrigem, meta = {}) {
  const numeroProcessoEncontrado = normalizarCnjParaChave(item.numeroCnj || item.processoCnjNormalizado || '');
  const cod = padCodCliente(item.codCliente);
  const proc = normProcInterno(item.procInterno);
  return {
    numeroProcessoEncontrado: numeroProcessoEncontrado || String(item.numeroCnj || '').trim(),
    dataDisponibilizacao: toIsoDate(item.dataDisponibilizacao),
    dataPublicacao: toIsoDate(item.dataPublicacao),
    fonte: item.diario || 'PDF',
    diario: item.diario || null,
    titulo: item.tipoPublicacao || null,
    tipoPublicacao: item.tipoPublicacao || null,
    resumo: item.resumoAutomatico || item.resumoPublicacao || null,
    teor: item.teorIntegral || '',
    statusValidacaoCnj: item.statusValidacaoCnj || null,
    scoreConfianca: item.scoreConfianca || null,
    hashTeor: item.hashTeor || '',
    hashConteudo: item.hashDedup || null,
    origemImportacao: 'PDF',
    arquivoOrigemNome: arquivoOrigem || null,
    arquivoOrigemHash: meta.hashArquivo || null,
    jsonReferencia: item.jsonCnjBruto ? String(item.jsonCnjBruto) : null,
    statusTratamento: item.statusVinculo === 'vinculado' ? 'VINCULADA' : 'PENDENTE',
    lida: false,
    observacao: item.observacoesTecnicas || null,
    _codCliente: cod,
    _procInterno: proc,
  };
}

export function mapLegacyPublicacaoItemToApiRequest(item, arquivoOrigem, meta = {}) {
  return mapPreviewItemToApiRequest(item, arquivoOrigem, meta);
}

function toIsoDate(dataBr) {
  const s = String(dataBr ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function pesoDataPublicacaoBr(s) {
  const t = String(s ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
  if (!m) return 0;
  return Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
}

function mergeAndSortPublicacoesRelatorio(itensApi, extrasLegado) {
  const vistos = new Set();
  const out = [];
  for (const r of itensApi) {
    const k = r.hashDedup ? `h:${r.hashDedup}` : `id:${r.id}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(r);
  }
  for (const r of extrasLegado) {
    const k = r.hashDedup ? `h:${r.hashDedup}` : `id:${r.id}`;
    if (vistos.has(k)) continue;
    vistos.add(k);
    out.push(r);
  }
  return out.sort((a, b) => pesoDataPublicacaoBr(b.dataPublicacao) - pesoDataPublicacaoBr(a.dataPublicacao));
}

/**
 * Relatório «Publicações deste processo» (modal em Processos).
 * Prioriza `processoId` nativo; resolve via API de processos quando possível; fallback legado sem apagar dados locais.
 */
export async function listarPublicacoesRelatorioPorProcesso({
  processoIdFromUi,
  codigoCliente,
  processo,
  numeroProcessoNovo,
}) {
  const legado = () => listarPublicacoesDoProcesso(codigoCliente, processo, numeroProcessoNovo);

  if (!featureFlags.useApiPublicacoes) {
    return {
      fonte: 'legado',
      processoIdResolvido: null,
      itens: legado(),
      aviso: null,
      erro: null,
    };
  }

  let pid =
    Number.isFinite(Number(processoIdFromUi)) && Number(processoIdFromUi) > 0 ? Number(processoIdFromUi) : null;
  if (!pid) {
    pid = await resolverProcessoId({
      processoId: null,
      codigoCliente,
      numeroInterno: processo,
    });
  }

  if (!pid) {
    return {
      fonte: 'legado_fallback_sem_id',
      processoIdResolvido: null,
      itens: legado(),
      aviso:
        'Processo não identificado na API (ative processos na API ou informe vínculo). Exibindo publicações do armazenamento local.',
      erro: null,
    };
  }

  try {
    const data = await request('/api/publicacoes', { query: { processoId: pid } });
    const itensApi = (data || []).map(mapApiPublicacaoToUi);
    const legadoItens = legado();
    const apiHashes = new Set(itensApi.map((i) => i.hashDedup).filter(Boolean));
    const extrasLegado = legadoItens.filter((l) => {
      const h = l.hashDedup;
      return !h || !apiHashes.has(h);
    });
    const merged = mergeAndSortPublicacoesRelatorio(itensApi, extrasLegado);
    return {
      fonte: extrasLegado.length ? 'api_mesclado_legado' : 'api',
      processoIdResolvido: pid,
      itens: merged,
      aviso: extrasLegado.length
        ? `${extrasLegado.length} registro(s) local(is) sem par na API (por hash) foram incluídos para não perder dados na transição.`
        : null,
      erro: null,
    };
  } catch (e) {
    return {
      fonte: 'legado_fallback_erro',
      processoIdResolvido: pid,
      itens: legado(),
      aviso: null,
      erro: e?.message || 'Falha ao carregar publicações na API.',
    };
  }
}

// --- Leitura principal (módulo Publicações) ---

export async function listarPublicacoesModulo({
  dataInicio,
  dataFim,
  statusTratamento,
  processoId,
  clienteId,
  texto,
  origemImportacao,
  filtroVinculo = 'todos',
}) {
  if (!featureFlags.useApiPublicacoes) {
    let rows = loadPublicacoesImportadas();
    if (filtroVinculo === 'nao_vinculados') {
      rows = rows.filter((r) => r.statusVinculo === 'nao_vinculado' || r.statusVinculo === 'sem_cnj');
    }
    const q = String(texto || '').trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        [
          r.numero_processo_cnj,
          r.codCliente,
          r.procInterno,
          r.cliente,
          r.tipoPublicacao,
          r.teorIntegral,
          r.statusValidacaoCnj,
          r.scoreConfianca,
          r.diario,
        ]
          .join(' ')
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }
  const data = await request('/api/publicacoes', {
    query: {
      dataInicio: dataInicio || undefined,
      dataFim: dataFim || undefined,
      status: statusTratamento || undefined,
      processoId: processoId || undefined,
      clienteId: clienteId || undefined,
      texto: texto || undefined,
      origemImportacao: origemImportacao || undefined,
    },
  });
  let rows = (data || []).map(mapApiPublicacaoToUi);
  if (filtroVinculo === 'nao_vinculados') {
    rows = rows.filter((r) => r.statusVinculo !== 'vinculado');
  }
  return rows;
}

// --- Escrita / importação ---

export async function importarPublicacoesDaPrevia(itens, arquivoOrigem, meta = {}) {
  if (!featureFlags.useApiPublicacoes) {
    return appendPublicacoesConfirmadas(itens, arquivoOrigem, meta);
  }
  let gravados = 0;
  let ignoradosDuplicata = 0;
  for (const item of itens) {
    const body = mapPreviewItemToApiRequest(item, arquivoOrigem, meta);
    try {
      const saved = await request('/api/publicacoes', { method: 'POST', body });
      gravados += saved?.id ? 1 : 0;
      if (saved?.id && body._codCliente && body._procInterno) {
        const processo = await buscarProcessoPorChaveNatural(body._codCliente, Number(body._procInterno));
        if (processo?.id) {
          await request(`/api/publicacoes/${saved.id}/vinculo-processo`, {
            method: 'PATCH',
            body: { processoId: processo.id, observacao: 'Vínculo inicial da importação.' },
          });
        }
      }
    } catch {
      ignoradosDuplicata += 1;
    }
  }
  return { gravados, ignoradosDuplicata };
}

// --- Ações operacionais (status / vínculo) ---

export async function alterarStatusPublicacao(id, status, observacao = '') {
  if (!featureFlags.useApiPublicacoes) {
    const statusVinculo = status === 'VINCULADA' || status === 'TRATADA' ? 'vinculado' : status === 'IGNORADA' ? 'ignorada' : 'nao_vinculado';
    updatePublicacaoImportada(id, { statusVinculo, observacoesTecnicas: observacao || '' });
    return null;
  }
  return request(`/api/publicacoes/${Number(id)}/status`, {
    method: 'PATCH',
    body: { status, observacao },
  });
}

/** Vínculo preferencial quando já se conhece o id numérico do processo na API. */
export async function vincularPublicacaoProcessoPorProcessoId(id, processoId, observacao = '') {
  if (!featureFlags.useApiPublicacoes) return null;
  const pid = Number(processoId);
  if (!Number.isFinite(pid) || pid <= 0) return null;
  return request(`/api/publicacoes/${Number(id)}/vinculo-processo`, {
    method: 'PATCH',
    body: { processoId: pid, observacao: observacao || '' },
  });
}

/** Compatibilidade: resolve processo por código cliente × proc. interno e delega a `vincularPublicacaoProcessoPorProcessoId`. */
export async function vincularPublicacaoProcessoPorChaveNatural(id, codCliente, procInterno, observacao = '') {
  if (!featureFlags.useApiPublicacoes) return null;
  const cod = padCodCliente(codCliente);
  const proc = Number(normProcInterno(procInterno));
  if (!cod || !proc) return null;
  const processo = await buscarProcessoPorChaveNatural(cod, proc);
  if (!processo?.id) return null;
  return vincularPublicacaoProcessoPorProcessoId(id, processo.id, observacao);
}
