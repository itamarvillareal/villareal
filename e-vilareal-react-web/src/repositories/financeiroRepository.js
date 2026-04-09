import { clampCadastroPessoasPageSize } from '../api/clientesService.js';
import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  buildLetraToContaMerge,
  getExtratosIniciais,
  loadPersistedContasContabeisExtrasFinanceiro,
  loadPersistedExtratosFinanceiro,
  savePersistedExtratosFinanceiro,
} from '../data/financeiroData.js';
import { resolverProcessoId } from './processosRepository.js';
import { chaveDedupeLancamento, listarLancamentosNovosDedupe } from '../utils/ofx.js';

function parseBrDateToIso(v) {
  const s = String(v ?? '').trim();
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  if (!m) return null;
  return `${m[3]}-${m[2]}-${m[1]}`;
}

function toBrDate(iso) {
  const s = String(iso ?? '').trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
  if (!m) return '';
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function contaMaps() {
  const extras = loadPersistedContasContabeisExtrasFinanceiro();
  return {
    contaToLetra: buildContaToLetraMerge(extras),
    letraToConta: buildLetraToContaMerge(extras),
  };
}

function mapApiLancamentoToUi(l, contaToLetra) {
  const letra = contaToLetra[l.contaContabilNome] || 'N';
  const valorNum = Number(l.valor ?? 0);
  const sinal = String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -1 : 1;
  return {
    apiId: l.id,
    letra,
    numero: String(l.numeroLancamento ?? ''),
    data: toBrDate(l.dataLancamento),
    descricao: String(l.descricao ?? ''),
    valor: valorNum * sinal,
    saldo: 0,
    saldoDesc: '',
    descricaoDetalhada: String(l.descricaoDetalhada ?? ''),
    categoria: String(l.descricaoDetalhada ?? ''),
    clienteId: l.clienteId ?? null,
    codCliente: l.clienteId ? String(l.clienteId) : '',
    processoId: l.processoId ?? null,
    proc: l.processoId ? String(l.processoId) : '',
    ref: String(l.refTipo || 'N').toUpperCase() === 'R' ? 'R' : 'N',
    dimensao: String(l.eqReferencia ?? ''),
    eq: String(l.eqReferencia ?? ''),
    parcela: String(l.parcelaRef ?? ''),
    nomeBanco: String(l.bancoNome ?? ''),
    numeroBanco: l.numeroBanco ?? null,
    _financeiroMeta: {
      clienteId: l.clienteId ?? null,
      processoId: l.processoId ?? null,
      contaContabilId: l.contaContabilId ?? null,
      classificacaoFinanceiraId: l.classificacaoFinanceiraId ?? null,
      eloFinanceiroId: l.eloFinanceiroId ?? null,
    },
  };
}

function normalizarRef(v) {
  return String(v ?? '').trim().toUpperCase() === 'R' ? 'R' : 'N';
}

function mapUiLancamentoToApi(t, contaIdByNome, letraToConta) {
  const contaNome = letraToConta[String(t.letra ?? '').toUpperCase()] || 'Conta Não Identificados';
  const contaContabilId = contaIdByNome.get(contaNome);
  if (!contaContabilId) return null;
  const valorNum = Number(t.valor ?? 0);
  const natureza = valorNum < 0 ? 'DEBITO' : 'CREDITO';
  return {
    contaContabilId,
    clienteId: Number(t._financeiroMeta?.clienteId) || null,
    processoId: Number(t._financeiroMeta?.processoId) || null,
    bancoNome: t.nomeBanco || null,
    numeroBanco: Number.isFinite(Number(t.numeroBanco)) ? Number(t.numeroBanco) : null,
    numeroLancamento: String(t.numero ?? ''),
    dataLancamento: parseBrDateToIso(t.data),
    dataCompetencia: parseBrDateToIso(t.data),
    descricao: String(t.descricao || '').trim() || 'Lançamento extrato',
    descricaoDetalhada: String(t.descricaoDetalhada || ''),
    valor: Math.abs(valorNum),
    natureza,
    refTipo: normalizarRef(t.ref),
    eqReferencia: String(t.eq || t.dimensao || ''),
    parcelaRef: String(t.parcela || ''),
    origem: String(t.origemImportacao ?? '').trim() || 'MANUAL',
    status: 'ATIVO',
  };
}

export async function listarContasFinanceiro() {
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/contas');
}

/** Leitura API (fonte principal quando flag ativa). */
export async function listarLancamentosFinanceiro(filtros = {}) {
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/lancamentos', {
    query: {
      clienteId: filtros.clienteId ?? undefined,
      processoId: filtros.processoId ?? undefined,
      contaContabilId: filtros.contaContabilId ?? undefined,
      dataInicio: filtros.dataInicio ?? undefined,
      dataFim: filtros.dataFim ?? undefined,
    },
  });
}

export async function listarLancamentosFinanceiroPaginados(filtros = {}) {
  if (!featureFlags.useApiFinanceiro) {
    return { content: [], totalElements: 0, totalPages: 0, size: filtros.size ?? 20, number: 0 };
  }
  const query = {
    page: filtros.page != null ? Math.max(0, Number(filtros.page) || 0) : 0,
    size: clampCadastroPessoasPageSize(filtros.size ?? 20),
    sort: filtros.sort ?? 'dataLancamento,asc',
    clienteId: filtros.clienteId ?? undefined,
    processoId: filtros.processoId ?? undefined,
    contaContabilId: filtros.contaContabilId ?? undefined,
    dataInicio: filtros.dataInicio ?? undefined,
    dataFim: filtros.dataFim ?? undefined,
  };
  return request('/api/financeiro/lancamentos/paginada', { query });
}

export async function carregarExtratosFinanceiroApiFirst() {
  if (!featureFlags.useApiFinanceiro) {
    const persisted = loadPersistedExtratosFinanceiro();
    return persisted ? { ...getExtratosIniciais(), ...persisted } : getExtratosIniciais();
  }
  const [contas, lancs] = await Promise.all([listarContasFinanceiro(), listarLancamentosFinanceiro()]);
  const contaToLetra = {
    ...contaMaps().contaToLetra,
    ...Object.fromEntries((contas || []).map((c) => [c.nome, c.codigo])),
  };
  const out = {};
  for (const l of lancs || []) {
    const banco = String(l.bancoNome || 'API');
    if (!Array.isArray(out[banco])) out[banco] = [];
    out[banco].push(mapApiLancamentoToUi(l, contaToLetra));
  }
  return out;
}

export async function salvarOuAtualizarLancamentoFinanceiroApi(t) {
  if (!featureFlags.useApiFinanceiro) return null;
  const [contas] = await Promise.all([listarContasFinanceiro()]);
  const contaIdByNome = new Map((contas || []).map((c) => [c.nome, c.id]));
  const { letraToConta } = contaMaps();
  const body = mapUiLancamentoToApi(t, contaIdByNome, letraToConta);
  if (!body?.contaContabilId || !body.numeroLancamento || !body.dataLancamento || !body.descricao) return null;
  if (Number(t.apiId)) {
    return request(`/api/financeiro/lancamentos/${Number(t.apiId)}`, { method: 'PUT', body });
  }
  return request('/api/financeiro/lancamentos', { method: 'POST', body });
}

/**
 * Grava na API os lançamentos de uma importação OFX (modo mesclar = só linhas novas; substituir = apaga lançamentos do banco na API e recria).
 * Com `useApiFinanceiro` desligado, retorna ok sem fazer nada.
 */
export async function persistirImportacaoOfxFinanceiroApi({
  nomeBanco,
  numeroBanco = null,
  modo,
  transacoesOfx,
  transacoesAntesNoBanco,
}) {
  if (!featureFlags.useApiFinanceiro) {
    return { ok: true, criados: 0, removidos: 0, erros: [], savedPairs: [] };
  }
  const normBanco = String(nomeBanco || '').trim();
  const erros = [];
  const savedPairs = [];
  let removidos = 0;

  if (modo === 'substituir') {
    try {
      const todos = await listarLancamentosFinanceiro();
      const doBanco = (todos || []).filter((l) => String(l.bancoNome || '').trim() === normBanco);
      for (const l of doBanco) {
        try {
          await removerLancamentoFinanceiroApi(l.id);
          removidos += 1;
        } catch (e) {
          erros.push(`Remover ${l.id}: ${e?.message || e}`);
        }
      }
    } catch (e) {
      erros.push(`Listar lançamentos: ${e?.message || e}`);
    }
  }

  const paraCriar =
    modo === 'substituir'
      ? transacoesOfx || []
      : listarLancamentosNovosDedupe(transacoesAntesNoBanco, transacoesOfx);

  const nb =
    numeroBanco != null && Number.isFinite(Number(numeroBanco)) ? Number(numeroBanco) : null;

  for (const row of paraCriar) {
    const t = {
      ...row,
      nomeBanco: normBanco,
      numeroBanco: nb,
      origemImportacao: 'OFX',
    };
    try {
      const saved = await salvarOuAtualizarLancamentoFinanceiroApi(t);
      if (saved?.id) {
        savedPairs.push({ row, saved });
      } else {
        erros.push(
          `${String(row.numero)} ${String(row.data)}: falha (verifique se existe a conta contábil «Conta Não Identificados» na API).`,
        );
      }
    } catch (e) {
      erros.push(`${String(row.numero)} ${String(row.data)}: ${e?.message || e}`);
    }
  }

  return {
    ok: erros.length === 0,
    criados: savedPairs.length,
    removidos,
    erros,
    savedPairs,
  };
}

/** Exclusão API com fallback decidido na camada de UI. */
export async function removerLancamentoFinanceiroApi(apiId) {
  if (!featureFlags.useApiFinanceiro || !Number(apiId)) return;
  await request(`/api/financeiro/lancamentos/${Number(apiId)}`, { method: 'DELETE' });
}

export async function carregarResumoContaCorrenteProcesso(processoId) {
  if (!featureFlags.useApiFinanceiro || !Number(processoId)) return null;
  return request(`/api/financeiro/lancamentos/resumo-processo/${Number(processoId)}`);
}

/** Leitura de transações por processo em modo API-first, aceitando chave natural como compatibilidade. */
export async function listarLancamentosProcessoApiFirst({ processoId, codigoCliente, numeroInterno }) {
  if (!featureFlags.useApiFinanceiro) return [];
  const resolvedProcessoId = await resolverProcessoId({ processoId, codigoCliente, numeroInterno });
  if (!resolvedProcessoId) return [];
  const rows = await listarLancamentosFinanceiro({ processoId: resolvedProcessoId });
  const { contaToLetra } = contaMaps();
  return (rows || []).map((l) => mapApiLancamentoToUi(l, contaToLetra));
}

export function persistirFallbackExtratos(extratos) {
  if (featureFlags.useApiFinanceiro) return;
  savePersistedExtratosFinanceiro(extratos);
}
