import { featureFlags } from '../config/featureFlags.js';
import { request } from '../api/httpClient.js';
import {
  STORAGE_PUBLICACOES_IMPORTADAS,
  loadPublicacoesImportadas,
} from '../data/publicacoesStorage.js';
import {
  mapLegacyPublicacaoItemToApiRequest,
  vincularPublicacaoProcessoPorProcessoId,
} from '../repositories/publicacoesRepository.js';
import { buscarProcessoPorChaveNatural } from '../repositories/processosRepository.js';

/** Marcador para evitar reimportação cega; UI dedicada pode vir em etapa futura. */
export const IMPORT_PUBLICACOES_PHASE6_DONE_KEY = 'vilareal:migration:phase6-publicacoes:done:v1';

export const LOCALSTORAGE_KEYS_PHASE6_PUBLICACOES = [STORAGE_PUBLICACOES_IMPORTADAS, 'vilareal.processos.publicacoes.v1'];

function getMarcadorImportacao() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(IMPORT_PUBLICACOES_PHASE6_DONE_KEY) === '1';
}

export function getStatusMigracaoAssistidaPhase6Publicacoes() {
  return {
    habilitadaPorFlag: Boolean(featureFlags.enableLocalStorageImportPhase6Publicacoes),
    apiPublicacoesAtiva: Boolean(featureFlags.useApiPublicacoes),
    jaExecutada: getMarcadorImportacao(),
    markerKey: IMPORT_PUBLICACOES_PHASE6_DONE_KEY,
    storageKeysLidas: [...LOCALSTORAGE_KEYS_PHASE6_PUBLICACOES],
  };
}

/**
 * Prévia apenas local (encontrado no frontend): contagens e duplicidade de hash no próprio JSON legado.
 * Não consulta a API em lote (evita GET massivo); deduplicação real com o servidor ocorre na execução (409/erro de unicidade).
 */
export function previsualizarMigracaoAssistidaPhase6Publicacoes() {
  const itens = loadPublicacoesImportadas();
  const porHash = new Map();
  for (const i of itens) {
    const h = i.hashDedup;
    if (!h) continue;
    porHash.set(h, (porHash.get(h) || 0) + 1);
  }
  let duplicatasLocais = 0;
  for (const c of porHash.values()) {
    if (c > 1) duplicatasLocais += c - 1;
  }
  const comHash = itens.filter((i) => i.hashDedup).length;
  const semVinculoEstimado = itens.filter((i) => {
    const cod = String(i.codCliente ?? '').trim();
    const proc = String(i.procInterno ?? '').trim();
    return !cod || !proc;
  }).length;
  return {
    ...getStatusMigracaoAssistidaPhase6Publicacoes(),
    totalLegado: itens.length,
    importavelEstimado: Math.max(0, itens.length - duplicatasLocais),
    comHashConteudo: comHash,
    semHashConteudo: itens.length - comHash,
    duplicatasLocaisEstimadas: duplicatasLocais,
    semVinculoEstimado,
    observacao:
      'Formato legado: `{ v: 2, itens: [...] }` em vilareal.processos.publicacoes.v2. Deduplicação no servidor usa `hash_conteudo` (alinhado a `hashDedup` local).',
  };
}

/**
 * Envia cada item do legado via POST /api/publicacoes; ignora falhas (ex.: hash duplicado).
 * Vínculo inicial usa código×proc quando resolvível na API de processos.
 * Exige flags; respeita marcador (não executa se já marcado).
 */
export async function executarMigracaoAssistidaPhase6Publicacoes() {
  if (typeof window === 'undefined') return null;
  if (getMarcadorImportacao()) {
    return { ignorado: true, motivo: 'Marcador de importação já presente.' };
  }
  if (!featureFlags.enableLocalStorageImportPhase6Publicacoes || !featureFlags.useApiPublicacoes) {
    return {
      ignorado: true,
      motivo: 'Ative VITE_ENABLE_LOCALSTORAGE_IMPORT_PHASE6_PUBLICACOES e VITE_USE_API_PUBLICACOES.',
    };
  }

  const itens = loadPublicacoesImportadas();
  let gravados = 0;
  let ignorados = 0;
  let semVinculo = 0;

  for (const item of itens) {
    const body = mapLegacyPublicacaoItemToApiRequest(item, item.arquivoOrigem, { hashArquivo: item.hashArquivo });
    try {
      const saved = await request('/api/publicacoes', { method: 'POST', body });
      if (saved?.id) {
        gravados += 1;
        if (body._codCliente && body._procInterno) {
          const proc = await buscarProcessoPorChaveNatural(body._codCliente, Number(body._procInterno));
          if (proc?.id) {
            await vincularPublicacaoProcessoPorProcessoId(saved.id, proc.id, 'Migração assistida fase 6 (legado).');
          } else {
            semVinculo += 1;
          }
        } else {
          semVinculo += 1;
        }
      }
    } catch {
      ignorados += 1;
    }
  }

  try {
    window.localStorage.setItem(IMPORT_PUBLICACOES_PHASE6_DONE_KEY, '1');
  } catch {
    /* ignore */
  }

  return { gravados, ignorados, semVinculo, total: itens.length };
}
