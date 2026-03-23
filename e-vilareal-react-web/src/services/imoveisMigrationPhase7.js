import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import { getImovelMock, getImoveisMockTotal } from '../data/imoveisMockData.js';
import {
  mapMockToUi,
  resolverClienteIdPorCodigo,
  resolverProcessoIdPorChave,
  salvarImovelCadastro,
} from '../repositories/imoveisRepository.js';

/** @see docs/frontend-phase-7-imoveis-migration.md */
export const MARKER_PHASE7_IMOVEIS_KEY = 'vilareal:migration:phase7-imoveis:lastRun:v1';

/**
 * Imóvel já persistido na API com o mesmo par (clienteId, processoId) que o mock resolveria.
 * Encontrado: `GET /api/imoveis?clienteId=` + match em `processoId`.
 */
async function buscarImovelPorClienteEProcesso(clienteId, processoId) {
  const list = await request('/api/imoveis', { query: { clienteId } });
  return (list || []).find((x) => Number(x.processoId) === Number(processoId)) ?? null;
}

function lerMarcadorExecucao() {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(MARKER_PHASE7_IMOVEIS_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return { raw };
  }
}

function gravarMarcadorExecucao(resumo) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    MARKER_PHASE7_IMOVEIS_KEY,
    JSON.stringify({
      at: new Date().toISOString(),
      ...resumo,
    }),
  );
}

export function getStatusMigracaoAssistidaPhase7Imoveis() {
  return {
    habilitadaPorFlag: Boolean(featureFlags.enableImoveisMockMigrationPhase7),
    apiImoveisAtiva: Boolean(featureFlags.useApiImoveis),
    markerKey: MARKER_PHASE7_IMOVEIS_KEY,
    ultimaExecucao: lerMarcadorExecucao(),
    totalMockLegado: getImoveisMockTotal(),
  };
}

/**
 * Prévia: para cada nº de imóvel do mock (1..N), resolve cliente/processo na API e classifica ação.
 * Não grava dados.
 */
export async function previsualizarMigracaoAssistidaPhase7Imoveis() {
  const total = getImoveisMockTotal();
  const status = getStatusMigracaoAssistidaPhase7Imoveis();

  if (!status.apiImoveisAtiva || !status.habilitadaPorFlag) {
    return {
      ok: false,
      observacao:
        'Prévia completa exige VITE_USE_API_IMOVEIS=true e VITE_ENABLE_IMOVEIS_MOCK_MIGRATION_PHASE7=true.',
      totalMock: total,
      linhas: [],
      resumo: { semCliente: 0, semProcesso: 0, jaExiste: 0, elegivel: 0 },
    };
  }

  const linhas = [];
  let semCliente = 0;
  let semProcesso = 0;
  let jaExiste = 0;
  let elegivel = 0;

  for (let mockId = 1; mockId <= total; mockId++) {
    const mock = getImovelMock(mockId);
    if (!mock) continue;
    const ui = mapMockToUi(mock, mockId);
    const clienteId = await resolverClienteIdPorCodigo(ui.codigo);
    if (!clienteId) {
      semCliente += 1;
      linhas.push({
        mockId,
        acao: 'pular',
        motivo: 'cliente_nao_encontrado',
        codigo: ui.codigo,
        proc: ui.proc,
      });
      continue;
    }
    const processoId = await resolverProcessoIdPorChave(ui.codigo, ui.proc);
    if (!processoId) {
      semProcesso += 1;
      linhas.push({
        mockId,
        acao: 'pular',
        motivo: 'processo_nao_encontrado',
        codigo: ui.codigo,
        proc: ui.proc,
      });
      continue;
    }
    const existente = await buscarImovelPorClienteEProcesso(clienteId, processoId);
    if (existente) {
      jaExiste += 1;
      linhas.push({
        mockId,
        acao: 'pular',
        motivo: 'imovel_ja_existe',
        codigo: ui.codigo,
        proc: ui.proc,
        imovelIdApi: existente.id,
      });
      continue;
    }
    elegivel += 1;
    linhas.push({
      mockId,
      acao: 'criar',
      codigo: ui.codigo,
      proc: ui.proc,
      clienteId,
      processoId,
    });
  }

  return {
    ok: true,
    totalMock: total,
    linhas,
    resumo: { semCliente, semProcesso, jaExiste, elegivel },
  };
}

/**
 * Executa POST de imóvel + contrato (via `salvarImovelCadastro`) para cada item elegível.
 * Repasses/despesas do mock: inexistentes — nada a importar (ver documentação).
 */
export async function executarMigracaoAssistidaPhase7Imoveis() {
  const status = getStatusMigracaoAssistidaPhase7Imoveis();
  if (!status.apiImoveisAtiva || !status.habilitadaPorFlag) {
    return null;
  }

  const total = getImoveisMockTotal();
  let criados = 0;
  let pulados = 0;
  const erros = [];

  for (let mockId = 1; mockId <= total; mockId++) {
    const mock = getImovelMock(mockId);
    if (!mock) continue;
    const ui = mapMockToUi(mock, mockId);
    try {
      const clienteId = await resolverClienteIdPorCodigo(ui.codigo);
      if (!clienteId) {
        pulados += 1;
        continue;
      }
      const processoId = await resolverProcessoIdPorChave(ui.codigo, ui.proc);
      if (!processoId) {
        pulados += 1;
        continue;
      }
      const existente = await buscarImovelPorClienteEProcesso(clienteId, processoId);
      if (existente) {
        pulados += 1;
        continue;
      }
      await salvarImovelCadastro(ui);
      criados += 1;
    } catch (e) {
      erros.push({ mockId, message: e?.message || String(e) });
    }
  }

  const resumo = {
    criados,
    pulados,
    erros: erros.length,
    detalhesErros: erros,
  };
  gravarMarcadorExecucao(resumo);
  return resumo;
}
