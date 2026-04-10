import { clampCadastroPessoasPageSize } from '../api/clientesService.js';
import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  buildLetraToContaMerge,
  buildNumeroToNomeBancoMap,
  getExtratosIniciais,
  loadPersistedContasContabeisExtrasFinanceiro,
  loadPersistedContasExtrasFinanceiro,
  loadPersistedExtratosFinanceiro,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
  savePersistedExtratosFinanceiro,
} from '../data/financeiroData.js';
import { resolverProcessoId } from './processosRepository.js';
import {
  chaveDedupeLancamento,
  listarLancamentosNovosDedupe,
  sanitizarLancamentoImportacaoExtrato,
} from '../utils/ofx.js';

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

function nomeBancoChaveExtrato(l, numeroToNome) {
  const nome = String(l.bancoNome ?? '').trim();
  if (nome) return nome;
  const n = Number(l.numeroBanco);
  if (Number.isFinite(n) && numeroToNome[n]) return numeroToNome[n];
  return 'API';
}

function lancamentoPertenceAoBancoExtrato(l, normBanco, numeroToNome) {
  const nome = String(l.bancoNome ?? '').trim();
  if (nome && nome === normBanco) return true;
  const n = Number(l.numeroBanco);
  if (Number.isFinite(n) && numeroToNome[n] === normBanco) return true;
  return false;
}

function codClienteExibicaoDesdeApi(l) {
  const raw = l.codigoCliente != null ? String(l.codigoCliente).trim() : '';
  if (raw === '') return '';
  const digits = raw.replace(/\D/g, '');
  const n = Number(digits);
  return normalizarCodigoClienteFinanceiro(Number.isFinite(n) && n >= 1 ? n : '');
}

function procExibicaoDesdeApi(l) {
  const ni = l.numeroInternoProcesso ?? l.numero_interno_processo;
  if (ni == null || ni === '') return '';
  return normalizarProcFinanceiro(ni) || '';
}

/**
 * True se o DTO da API já tem vínculo (edição / modal «Vincular»). Import OFX/PDF só zera colunas quando isto é falso.
 */
function apiDtoTemVinculoClienteOuProcesso(dto) {
  if (!dto) return false;
  const cid = Number(dto.clienteId);
  const pid = Number(dto.processoId);
  if (Number.isFinite(cid) && cid > 0) return true;
  if (Number.isFinite(pid) && pid > 0) return true;
  if (codClienteExibicaoDesdeApi(dto) !== '') return true;
  if (procExibicaoDesdeApi(dto) !== '') return true;
  return false;
}

/**
 * Após POST/PUT: mantém `codCliente`/`proc` como exibição (API) e não só ids em `_financeiroMeta`.
 * Origem OFX/PDF sem vínculo na API: não reaplica colunas só do ficheiro; com vínculo gravado, exibe o que a API devolveu.
 */
export function mergeUiLancamentoComRespostaApi(row, saved) {
  if (!saved || saved.id == null) return row;
  const fromArquivo = /^(OFX|PDF)$/i.test(String(saved?.origem ?? row.origemImportacao ?? '').trim());
  const mascaraSoArquivoSemVinculo = fromArquivo && !apiDtoTemVinculoClienteOuProcesso(saved);
  const codApi = codClienteExibicaoDesdeApi(saved);
  const procApi = procExibicaoDesdeApi(saved);
  const dataCompetenciaMerged =
    saved.dataCompetencia != null
      ? toBrDate(saved.dataCompetencia)
      : String(row.dataCompetencia ?? '').trim() || toBrDate(saved.dataLancamento);
  return {
    ...row,
    apiId: Number(saved.id),
    dataCompetencia: dataCompetenciaMerged,
    origemImportacao: String(saved.origem ?? row.origemImportacao ?? '').trim(),
    codCliente: mascaraSoArquivoSemVinculo
      ? ''
      : codApi !== ''
        ? codApi
        : String(row.codCliente ?? '').trim(),
    proc: mascaraSoArquivoSemVinculo ? '' : procApi !== '' ? procApi : String(row.proc ?? '').trim(),
    ref: mascaraSoArquivoSemVinculo ? '' : row.ref,
    dimensao: mascaraSoArquivoSemVinculo ? '' : row.dimensao,
    eq: mascaraSoArquivoSemVinculo ? '' : row.eq,
    parcela: mascaraSoArquivoSemVinculo ? '' : row.parcela,
    categoria: mascaraSoArquivoSemVinculo ? '' : row.categoria,
    numeroBanco: saved.numeroBanco ?? row.numeroBanco ?? null,
    _financeiroMeta: {
      ...(row._financeiroMeta || {}),
      clienteId: mascaraSoArquivoSemVinculo ? null : saved.clienteId ?? row._financeiroMeta?.clienteId ?? null,
      processoId: mascaraSoArquivoSemVinculo ? null : saved.processoId ?? row._financeiroMeta?.processoId ?? null,
      contaContabilId: saved.contaContabilId ?? row._financeiroMeta?.contaContabilId ?? null,
      classificacaoFinanceiraId: mascaraSoArquivoSemVinculo
        ? null
        : saved.classificacaoFinanceiraId ?? row._financeiroMeta?.classificacaoFinanceiraId ?? null,
      eloFinanceiroId: mascaraSoArquivoSemVinculo
        ? null
        : saved.eloFinanceiroId ?? row._financeiroMeta?.eloFinanceiroId ?? null,
    },
  };
}

function mapApiLancamentoToUi(l, contaToLetra) {
  const letra = contaToLetra[l.contaContabilNome] || 'N';
  const valorNum = Number(l.valor ?? 0);
  const sinal = String(l.natureza ?? '').toUpperCase() === 'DEBITO' ? -1 : 1;
  const origemImportacao = String(l.origem ?? '').trim();
  const fromArquivo = /^(OFX|PDF)$/i.test(origemImportacao);
  const dataLancBr = toBrDate(l.dataLancamento);
  const dataCompBr = l.dataCompetencia != null ? toBrDate(l.dataCompetencia) : dataLancBr;
  const base = {
    apiId: l.id,
    letra,
    numero: String(l.numeroLancamento ?? ''),
    data: dataLancBr,
    dataCompetencia: dataCompBr,
    descricao: String(l.descricao ?? ''),
    valor: valorNum * sinal,
    saldo: 0,
    saldoDesc: '',
    descricaoDetalhada: String(l.descricaoDetalhada ?? ''),
    categoria: String(l.descricaoDetalhada ?? ''),
    clienteId: l.clienteId ?? null,
    codCliente: codClienteExibicaoDesdeApi(l),
    processoId: l.processoId ?? null,
    proc: procExibicaoDesdeApi(l),
    ref: String(l.refTipo || 'N').toUpperCase() === 'R' ? 'R' : 'N',
    dimensao: String(l.eqReferencia ?? ''),
    eq: String(l.eqReferencia ?? ''),
    parcela: String(l.parcelaRef ?? ''),
    nomeBanco: String(l.bancoNome ?? ''),
    numeroBanco: l.numeroBanco ?? null,
    origemImportacao,
    _financeiroMeta: {
      clienteId: l.clienteId ?? null,
      processoId: l.processoId ?? null,
      contaContabilId: l.contaContabilId ?? null,
      classificacaoFinanceiraId: l.classificacaoFinanceiraId ?? null,
      eloFinanceiroId: l.eloFinanceiroId ?? null,
    },
  };
  if (!fromArquivo || apiDtoTemVinculoClienteOuProcesso(l)) return base;
  return {
    ...base,
    codCliente: '',
    proc: '',
    ref: '',
    dimensao: '',
    eq: '',
    parcela: '',
    categoria: '',
    clienteId: null,
    processoId: null,
    _financeiroMeta: {
      ...base._financeiroMeta,
      clienteId: null,
      processoId: null,
      eloFinanceiroId: null,
      classificacaoFinanceiraId: null,
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
  const meta = t._financeiroMeta || {};
  const cf = meta.classificacaoFinanceiraId;
  const elo = meta.eloFinanceiroId;
  const body = {
    contaContabilId,
    clienteId: Number(meta.clienteId) || null,
    processoId: Number(meta.processoId) || null,
    bancoNome: t.nomeBanco || null,
    numeroBanco: Number.isFinite(Number(t.numeroBanco)) ? Number(t.numeroBanco) : null,
    numeroLancamento: String(t.numero ?? ''),
    dataLancamento: parseBrDateToIso(t.data),
    dataCompetencia: parseBrDateToIso(t.dataCompetencia) || parseBrDateToIso(t.data),
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
  const cfN = Number(cf);
  if (cf != null && Number.isFinite(cfN) && cfN > 0) body.classificacaoFinanceiraId = cfN;
  const eloN = Number(elo);
  if (elo != null && Number.isFinite(eloN) && eloN > 0) body.eloFinanceiroId = eloN;
  return body;
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
  const numeroToNome = buildNumeroToNomeBancoMap(loadPersistedContasExtrasFinanceiro());
  const out = {};
  for (const b of Object.keys(getExtratosIniciais())) {
    out[b] = [];
  }
  for (const l of lancs || []) {
    const banco = nomeBancoChaveExtrato(l, numeroToNome);
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
  origemImportacao = 'OFX',
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
      const numeroToNome = buildNumeroToNomeBancoMap(loadPersistedContasExtrasFinanceiro());
      const doBanco = (todos || []).filter((l) => lancamentoPertenceAoBancoExtrato(l, normBanco, numeroToNome));
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
    const t = sanitizarLancamentoImportacaoExtrato({
      ...row,
      nomeBanco: normBanco,
      numeroBanco: nb,
      origemImportacao: String(origemImportacao || 'OFX').trim() || 'OFX',
    });
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

/**
 * Apaga na API todos os lançamentos do extrato do banco e desfaz elos de compensação nos outros bancos.
 * Com `useApiFinanceiro` desligado, não chama o servidor (use limpeza local em `financeiroData`).
 */
export async function limparExtratoBancoFinanceiroApi(nomeBanco, numeroBanco) {
  if (!featureFlags.useApiFinanceiro) {
    return { lancamentosRemovidos: 0, lancamentosDesvinculadosOutrosBancos: 0 };
  }
  const nb = Number(numeroBanco);
  const body = {
    banco: String(nomeBanco || '').trim(),
    ...(Number.isFinite(nb) ? { numeroBanco: nb } : {}),
  };
  return request('/api/financeiro/lancamentos/limpar-extrato', { method: 'POST', body });
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

/** Cache local dos extratos: com API ativa continua útil para 1ª pintura e se o GET falhar ou atrasar. */
export function persistirFallbackExtratos(extratos) {
  savePersistedExtratosFinanceiro(extratos);
}
