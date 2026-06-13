import { clampFinanceiroPageSize } from '../components/financeiro/constants/financeiroConstants.js';
import { request } from '../api/httpClient.js';
import { featureFlags } from '../config/featureFlags.js';
import {
  buildContaToLetraMerge,
  buildLetraToContaMerge,
  buildNumeroToNomeBancoMap,
  CARTAO_TO_NUMERO,
  getExtratosCartaoIniciais,
  getExtratosIniciais,
  isNomeCartaoFinanceiro,
  loadPersistedContasContabeisExtrasFinanceiro,
  loadPersistedContasExtrasFinanceiro,
  loadPersistedExtratosFinanceiro,
  codigoClienteExtratoDesdeApiDto,
  normalizarCodigoClienteFinanceiro,
  normalizarProcFinanceiro,
  savePersistedExtratosFinanceiro,
} from '../data/financeiroData.js';
import {
  buscarClientePorCodigo,
  clientePkFromApiDto,
  resolverProcessoId,
} from './processosRepository.js';
import {
  analisarLancamentosNovosDedupe,
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
  return codigoClienteExtratoDesdeApiDto(l);
}

function procExibicaoDesdeApi(l) {
  const grupo = String(l.grupoCompensacao ?? '').trim();
  if (grupo) return grupo;
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
    nomeBanco: String(saved.cartaoNome ?? saved.bancoNome ?? row.nomeBanco ?? ''),
    numeroBanco: saved.numeroCartao ?? saved.numeroBanco ?? row.numeroBanco ?? null,
    valor:
      saved.valor != null && saved.cartaoNome != null
        ? Number(saved.valor)
        : row.valor,
    _financeiroMeta: {
      ...(row._financeiroMeta || {}),
      clienteId: mascaraSoArquivoSemVinculo ? null : saved.clienteId ?? row._financeiroMeta?.clienteId ?? null,
      processoId: mascaraSoArquivoSemVinculo ? null : saved.processoId ?? row._financeiroMeta?.processoId ?? null,
      contaContabilId: saved.contaContabilId ?? row._financeiroMeta?.contaContabilId ?? null,
      cartaoId: saved.cartaoId ?? row._financeiroMeta?.cartaoId ?? null,
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
    pessoaRefId: l.pessoaRefId ?? null,
    codCliente: codClienteExibicaoDesdeApi(l),
    processoId: l.processoId ?? null,
    proc: procExibicaoDesdeApi(l),
    ref: String(l.refTipo || 'N').toUpperCase() === 'R' ? 'R' : 'N',
    dimensao: '',
    eq: '',
    parcela: '',
    nomeBanco: String(l.bancoNome ?? l.cartaoNome ?? ''),
    numeroBanco: l.numeroBanco ?? l.numeroCartao ?? null,
    origemImportacao,
    _financeiroMeta: {
      clienteId: l.clienteId ?? null,
      pessoaRefId: l.pessoaRefId ?? null,
      processoId: l.processoId ?? null,
      contaContabilId: l.contaContabilId ?? null,
      grupoCompensacao: l.grupoCompensacao ?? null,
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
    origem: String(t.origemImportacao ?? '').trim() || 'MANUAL',
    status: 'ATIVO',
    grupoCompensacao:
      String(t.letra ?? '').toUpperCase() === 'E'
        ? String(t.proc ?? t._financeiroMeta?.grupoCompensacao ?? '').trim() || null
        : null,
  };
  return body;
}

export async function listarContasFinanceiro(opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/contas', { signal });
}

/** Leitura API (fonte principal quando flag ativa). */
export async function listarLancamentosFinanceiro(filtros = {}, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/lancamentos', {
    signal,
    query: {
      clienteId: filtros.clienteId ?? undefined,
      processoId: filtros.processoId ?? undefined,
      contaContabilId: filtros.contaContabilId ?? undefined,
      dataInicio: filtros.dataInicio ?? undefined,
      dataFim: filtros.dataFim ?? undefined,
    },
  });
}

/** Saldo acumulado da conta bancária (todos os lançamentos importados). */
export async function obterSaldoBancoFinanceiro(numeroBanco, opts = {}) {
  const { signal, dataReferencia } = opts;
  if (!featureFlags.useApiFinanceiro || numeroBanco == null) return null;
  return request('/api/financeiro/lancamentos/saldo-banco', {
    signal,
    query: {
      numeroBanco: Number(numeroBanco),
      ...(dataReferencia ? { data: String(dataReferencia) } : {}),
    },
  });
}

/** Saldo ao fim de cada dia do mês (todos os dias do calendário). */
export async function obterResumoConsolidadoContasApi(opts = {}) {
  const { signal, meses = 12 } = opts;
  if (!featureFlags.useApiFinanceiro) return { totaisPorConta: {}, meses: [] };
  return request('/api/financeiro/lancamentos/resumo-consolidado', {
    signal,
    query: { meses },
  });
}

export async function obterSaldoBancoMensalFinanceiro(numeroBanco, ano, mes, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro || numeroBanco == null) return null;
  return request('/api/financeiro/lancamentos/saldo-banco-mensal', {
    signal,
    query: {
      numeroBanco: Number(numeroBanco),
      ano: Number(ano),
      mes: Number(mes),
    },
  });
}

/** Saldo de abertura informado para a conta (ou null se não houver). */
export async function obterSaldoInicialBanco(numeroBanco, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro || numeroBanco == null) return null;
  return request('/api/financeiro/lancamentos/saldo-inicial', {
    signal,
    query: { numeroBanco: Number(numeroBanco) },
  });
}

/** Cria/atualiza o saldo de abertura da conta. `valor` é o saldo assinado (pode ser negativo). */
export async function salvarSaldoInicialBanco({ numeroBanco, bancoNome, dataReferencia, valor }, opts = {}) {
  const { signal } = opts;
  return request('/api/financeiro/lancamentos/saldo-inicial', {
    signal,
    method: 'PUT',
    body: {
      numeroBanco: Number(numeroBanco),
      bancoNome: bancoNome ?? null,
      dataReferencia: String(dataReferencia),
      valor: Number(valor),
    },
  });
}

/** Remove o saldo de abertura da conta. */
export async function removerSaldoInicialBanco(numeroBanco, opts = {}) {
  const { signal } = opts;
  return request('/api/financeiro/lancamentos/saldo-inicial', {
    signal,
    method: 'DELETE',
    query: { numeroBanco: Number(numeroBanco) },
  });
}

function queryLancamentosPaginados(filtros = {}) {
  return {
    page: filtros.page != null ? Math.max(0, Number(filtros.page) || 0) : 0,
    size: clampFinanceiroPageSize(filtros.size ?? 100),
    sort: filtros.sort ?? 'dataLancamento,desc',
    clienteId: filtros.clienteId ?? undefined,
    processoId: filtros.processoId ?? undefined,
    contaContabilId: filtros.contaContabilId ?? undefined,
    dataInicio: filtros.dataInicio ?? undefined,
    dataFim: filtros.dataFim ?? undefined,
    etapa: filtros.etapa ?? undefined,
    numeroBanco: filtros.numeroBanco ?? undefined,
    busca: filtros.busca ?? undefined,
    semClienteId: filtros.semClienteId === true ? true : undefined,
    semGrupoCompensacao: filtros.semGrupoCompensacao === true ? true : undefined,
    ano: filtros.ano ?? undefined,
    mes: filtros.mes ?? undefined,
  };
}

function erroRotaExtratoLegada(err) {
  const msg = String(err?.message ?? '');
  return (
    msg.includes('MethodArgumentTypeMismatch') ||
    msg.includes('extrato-paginada') ||
    msg.includes('extrato/paginada')
  );
}

function erroRotaInboxClassificarLegada(err) {
  const msg = String(err?.message ?? '');
  return (
    msg.includes('404') ||
    (/No static resource|NoResourceFound/i.test(msg) && /inbox\/classificar/i.test(msg))
  );
}

async function listarInboxClassificarPaginaLegada(filtros = {}, opts = {}) {
  const { signal } = opts;
  const pageRes = await listarLancamentosFinanceiroPaginados(
    {
      ...filtros,
      etapa: 'IMPORTADO',
    },
    { signal },
  );
  const content = pageRes?.content ?? [];
  const ids = content.map((l) => Number(l?.id)).filter((id) => Number.isFinite(id) && id > 0);
  let sugestoes = {};
  const LOTE = 1000;
  for (let i = 0; i < ids.length; i += LOTE) {
    const chunk = ids.slice(i, i + LOTE);
    const sugRes = await sugestoesClassificacaoLoteApi(chunk, { signal });
    if (sugRes?.sugestoes && typeof sugRes.sugestoes === 'object') {
      sugestoes = { ...sugestoes, ...sugRes.sugestoes };
    }
  }
  return {
    content,
    totalElements: Number(pageRes?.totalElements ?? content.length),
    totalPages: Number(pageRes?.totalPages ?? 1),
    page: Number(pageRes?.number ?? pageRes?.page ?? filtros.page ?? 0),
    size: Number(pageRes?.size ?? filtros.size ?? 50),
    sugestoes,
  };
}

/** Grade do extrato — DTO enxuto (`/extrato/paginada`); fallback para `/paginada` se o backend ainda não foi reiniciado. */
export async function listarLancamentosExtratoPaginados(filtros = {}, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro) {
    return { content: [], totalElements: 0, totalPages: 0, size: filtros.size ?? 20, number: 0 };
  }
  const query = queryLancamentosPaginados(filtros);
  try {
    return await request('/api/financeiro/lancamentos/extrato/paginada', { query, signal });
  } catch (e) {
    if (erroRotaExtratoLegada(e) || String(e?.message ?? '').includes('404')) {
      return request('/api/financeiro/lancamentos/paginada', { query, signal });
    }
    throw e;
  }
}

export async function listarInboxClassificarPaginaApi(filtros = {}, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro) {
    return { content: [], totalElements: 0, totalPages: 0, sugestoes: {} };
  }
  const query = {
    page: filtros.page != null ? Math.max(0, Number(filtros.page) || 0) : 0,
    size: clampFinanceiroPageSize(filtros.size ?? 50),
    sort: filtros.sort ?? 'dataLancamento,desc',
    numeroBanco: filtros.numeroBanco ?? undefined,
    ano: filtros.ano ?? undefined,
    mes: filtros.mes ?? undefined,
  };
  try {
    return await request('/api/financeiro/lancamentos/inbox/classificar', { query, signal });
  } catch (e) {
    if (!erroRotaInboxClassificarLegada(e)) throw e;
    return listarInboxClassificarPaginaLegada({ ...filtros, ...query }, { signal });
  }
}

export async function listarLancamentosFinanceiroPaginados(filtros = {}, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro) {
    return { content: [], totalElements: 0, totalPages: 0, size: filtros.size ?? 20, number: 0 };
  }
  return request('/api/financeiro/lancamentos/paginada', {
    query: queryLancamentosPaginados(filtros),
    signal,
  });
}

/** Todos os lançamentos de extrato bancário em um intervalo (paginação automática). */
export async function listarLancamentosExtratoNoIntervalo(
  { dataInicio, dataFim, size = 500 } = {},
  opts = {},
) {
  if (!featureFlags.useApiFinanceiro || !dataInicio || !dataFim) return [];
  const { signal } = opts;
  const { contaToLetra } = contaMaps();
  const out = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const res = await listarLancamentosFinanceiroPaginados(
      { dataInicio, dataFim, page, size, sort: 'dataLancamento,asc' },
      { signal },
    );
    const content = res?.content ?? [];
    for (const l of content) {
      out.push(mapApiLancamentoToUi(l, contaToLetra));
    }
    totalPages = Math.max(1, Number(res?.totalPages ?? 1));
    page += 1;
    if (!content.length) break;
  }
  return out;
}

export async function buscarLancamentoFinanceiroApi(id, opts = {}) {
  if (!featureFlags.useApiFinanceiro || !Number(id)) return null;
  return request(`/api/financeiro/lancamentos/${Number(id)}`, { signal: opts.signal });
}

function mapApiLancamentoCartaoToUi(l, contaToLetra) {
  const letra = contaToLetra[l.contaContabilNome] || 'N';
  const valorNum = Number(l.valor ?? 0);
  const origemImportacao = String(l.origem ?? '').trim();
  const dataLancBr = toBrDate(l.dataLancamento);
  const dataCompBr = l.dataCompetencia != null ? toBrDate(l.dataCompetencia) : dataLancBr;
  return {
    apiId: l.id,
    letra,
    numero: String(l.numeroLancamento ?? ''),
    data: dataLancBr,
    dataCompetencia: dataCompBr,
    descricao: String(l.descricao ?? ''),
    valor: valorNum,
    saldo: 0,
    saldoDesc: '',
    descricaoDetalhada: String(l.descricaoDetalhada ?? ''),
    categoria: String(l.descricaoDetalhada ?? ''),
    codCliente: codClienteExibicaoDesdeApi(l),
    proc: procExibicaoDesdeApi(l),
    ref: String(l.refTipo || 'N').toUpperCase() === 'R' ? 'R' : 'N',
    dimensao: '',
    eq: '',
    parcela: '',
    nomeBanco: String(l.cartaoNome ?? ''),
    numeroBanco: l.numeroCartao ?? null,
    origemImportacao,
    origemExtrato: 'cartao',
    _financeiroMeta: {
      clienteId: l.clienteId ?? null,
      pessoaRefId: l.pessoaRefId ?? null,
      processoId: l.processoId ?? null,
      contaContabilId: l.contaContabilId ?? null,
      cartaoId: l.cartaoId ?? null,
    },
  };
}

function mapUiLancamentoCartaoToApi(t, contaIdByNome, letraToConta, cartaoIdByNome) {
  const contaNome = letraToConta[String(t.letra ?? '').toUpperCase()] || 'Conta Não Identificados';
  const contaContabilId = contaIdByNome.get(contaNome);
  const nomeCartao = String(t.nomeBanco ?? '').trim();
  const cartaoId = cartaoIdByNome.get(nomeCartao) ?? t._financeiroMeta?.cartaoId ?? null;
  if (!contaContabilId || !cartaoId) return null;
  const valorNum = Number(t.valor ?? 0);
  return {
    cartaoId: Number(cartaoId),
    contaContabilId,
    clienteId: Number(t._financeiroMeta?.clienteId) || null,
    processoId: Number(t._financeiroMeta?.processoId) || null,
    numeroLancamento: String(t.numero ?? ''),
    dataLancamento: parseBrDateToIso(t.data),
    dataCompetencia: parseBrDateToIso(t.dataCompetencia) || parseBrDateToIso(t.data),
    descricao: String(t.descricao || '').trim() || 'Lançamento cartão',
    descricaoDetalhada: String(t.descricaoDetalhada || t.categoria || '').trim(),
    valor: valorNum,
    refTipo: normalizarRef(t.ref),
    origem: String(t.origemImportacao ?? '').trim() || 'MANUAL',
    status: 'ATIVO',
  };
}

export async function listarCartoesFinanceiro(opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/cartoes', { signal });
}

export async function listarLancamentosCartaoFinanceiro(filtros = {}, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/cartoes/lancamentos', {
    signal,
    query: {
      clienteId: filtros.clienteId ?? undefined,
      processoId: filtros.processoId ?? undefined,
      contaContabilId: filtros.contaContabilId ?? undefined,
      cartaoId: filtros.cartaoId ?? undefined,
      dataInicio: filtros.dataInicio ?? undefined,
      dataFim: filtros.dataFim ?? undefined,
    },
  });
}

export async function salvarOuAtualizarLancamentoCartaoFinanceiroApi(t) {
  if (!featureFlags.useApiFinanceiro) return null;
  const [contas, cartoes] = await Promise.all([listarContasFinanceiro(), listarCartoesFinanceiro()]);
  const contaIdByNome = new Map((contas || []).map((c) => [c.nome, c.id]));
  const cartaoIdByNome = new Map((cartoes || []).map((c) => [c.nome, c.id]));
  const { letraToConta } = contaMaps();
  const body = mapUiLancamentoCartaoToApi(t, contaIdByNome, letraToConta, cartaoIdByNome);
  if (!body?.contaContabilId || !body.numeroLancamento || !body.dataLancamento) return null;
  if (Number(t.apiId)) {
    return request(`/api/financeiro/cartoes/lancamentos/${Number(t.apiId)}`, { method: 'PUT', body });
  }
  return request('/api/financeiro/cartoes/lancamentos', { method: 'POST', body });
}

export async function removerLancamentoCartaoFinanceiroApi(apiId) {
  if (!featureFlags.useApiFinanceiro || !Number(apiId)) return;
  await request(`/api/financeiro/cartoes/lancamentos/${Number(apiId)}`, { method: 'DELETE' });
}

export async function limparExtratoCartaoFinanceiroApi(nomeCartao, numeroCartao) {
  if (!featureFlags.useApiFinanceiro) {
    return { lancamentosRemovidos: 0 };
  }
  const nc = Number(numeroCartao);
  const body = {
    cartao: String(nomeCartao || '').trim(),
    ...(Number.isFinite(nc) ? { numeroCartao: nc } : {}),
  };
  return request('/api/financeiro/cartoes/limpar-extrato', { method: 'POST', body });
}

/**
 * Carga total de extratos (legado / relatórios). Com API ativa o backend limita a 5000 lançamentos
 * em GET /lancamentos — preferir telas paginadas (/financeiro/extrato).
 */
export async function carregarExtratosFinanceiroApiFirst({ signal } = {}) {
  if (!featureFlags.useApiFinanceiro) {
    const persisted = loadPersistedExtratosFinanceiro();
    const merged = persisted ? { ...getExtratosIniciais(), ...persisted } : getExtratosIniciais();
    const cartoes = getExtratosCartaoIniciais();
    for (const nome of Object.keys(CARTAO_TO_NUMERO)) {
      if (Array.isArray(merged[nome])) cartoes[nome] = merged[nome];
      delete merged[nome];
    }
    return { extratosPorBanco: merged, extratosPorCartao: cartoes };
  }
  const [contas, lancs, lancsCartao] = await Promise.all([
    listarContasFinanceiro({ signal }),
    listarLancamentosFinanceiro({}, { signal }),
    listarLancamentosCartaoFinanceiro({}, { signal }),
  ]);
  const contaToLetra = {
    ...contaMaps().contaToLetra,
    ...Object.fromEntries((contas || []).map((c) => [c.nome, c.codigo])),
  };
  const numeroToNome = buildNumeroToNomeBancoMap(loadPersistedContasExtrasFinanceiro());
  const outBanco = {};
  for (const b of Object.keys(getExtratosIniciais())) {
    outBanco[b] = [];
  }
  for (const l of lancs || []) {
    const banco = nomeBancoChaveExtrato(l, numeroToNome);
    if (isNomeCartaoFinanceiro(banco)) continue;
    if (!Array.isArray(outBanco[banco])) outBanco[banco] = [];
    outBanco[banco].push(mapApiLancamentoToUi(l, contaToLetra));
  }
  const outCartao = {};
  for (const c of Object.keys(getExtratosCartaoIniciais())) {
    outCartao[c] = [];
  }
  for (const l of lancsCartao || []) {
    const nome = String(l.cartaoNome ?? '').trim();
    if (!nome) continue;
    if (!Array.isArray(outCartao[nome])) outCartao[nome] = [];
    outCartao[nome].push(mapApiLancamentoCartaoToUi(l, contaToLetra));
  }
  return { extratosPorBanco: outBanco, extratosPorCartao: outCartao };
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

  const analiseDedupe =
    modo === 'substituir'
      ? {
          novos: transacoesOfx || [],
          ignorados: 0,
          porDia: new Map(),
        }
      : analisarLancamentosNovosDedupe(transacoesAntesNoBanco, transacoesOfx, {
          respeitarExtratoComoMestre: /^PDF$/i.test(String(origemImportacao ?? '').trim()),
        });
  const paraCriar = analiseDedupe.novos;

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
    ignorados: analiseDedupe.ignorados,
    totalOfx: (transacoesOfx || []).length,
    porDiaDedupe: Object.fromEntries(analiseDedupe.porDia),
  };
}

/** Exclusão API com fallback decidido na camada de UI. */
export async function removerLancamentoFinanceiroApi(apiId) {
  if (!featureFlags.useApiFinanceiro || !Number(apiId)) return;
  await request(`/api/financeiro/lancamentos/${Number(apiId)}`, { method: 'DELETE' });
}

/**
 * Exclui vários lançamentos (sequencial — evita sobrecarga na API).
 * @param {Iterable<number|string>} apiIds
 * @returns {Promise<{ removidos: number[], erros: { id: number, message: string }[] }>}
 */
export async function removerLancamentosFinanceiroApiEmLote(apiIds) {
  const ids = [
    ...new Set(
      [...(apiIds || [])]
        .map((x) => Number(x))
        .filter((n) => Number.isFinite(n) && n > 0),
    ),
  ];
  const removidos = [];
  const erros = [];
  for (const id of ids) {
    try {
      await removerLancamentoFinanceiroApi(id);
      removidos.push(id);
    } catch (e) {
      erros.push({ id, message: e?.message || String(e) });
    }
  }
  return { removidos, erros };
}

/**
 * Retira o lançamento da Conta Corrente do processo: zera Cod. cliente e Proc. (API ou só local).
 * O registro permanece no extrato/consolidado.
 */
export async function desvincularLancamentoClienteProcesso(t) {
  if (!t || typeof t !== 'object') {
    return { ok: false, message: 'Lançamento inválido.' };
  }
  const cleared = {
    ...t,
    codCliente: '',
    proc: '',
    clienteId: null,
    processoId: null,
    _financeiroMeta: {
      ...(t._financeiroMeta || {}),
      clienteId: null,
      processoId: null,
      grupoCompensacao: null,
    },
  };
  if (String(cleared.letra ?? '').toUpperCase() === 'E' || String(cleared.grupoCompensacao ?? '').trim()) {
    cleared.grupoCompensacao = null;
  }
  const nome = String(cleared.nomeBanco ?? '').trim();
  const ehCartao =
    isNomeCartaoFinanceiro(nome) || Number(cleared._financeiroMeta?.cartaoId) > 0;

  if (featureFlags.useApiFinanceiro && Number(cleared.apiId) > 0) {
    const saved = ehCartao
      ? await salvarOuAtualizarLancamentoCartaoFinanceiroApi(cleared)
      : await salvarOuAtualizarLancamentoFinanceiroApi(cleared);
    if (!saved?.id) {
      return { ok: false, message: 'Falha ao gravar desvinculação na API.' };
    }
    return { ok: true, saved };
  }
  return { ok: true, saved: cleared };
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

/** Pessoa id = dígitos do código (00000938 → 938), mesmo critério do extrato / vínculo na planilha. */
export function pessoaIdDesdeCodigoClienteFinanceiro(codigoCliente) {
  const codNorm = normalizarCodigoClienteFinanceiro(codigoCliente);
  if (!codNorm) return null;
  const n = Number(codNorm);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/**
 * Mesmo critério da Conta Corrente local ({@code getLancamentosContaCorrente}): cod. cliente + proc.,
 * não só o processoId da resolução oficial (que pode apontar para outra pessoa).
 */
export function lancamentoBateContaCorrenteProcesso(l, { codigoNorm, procNorm, resolvedProcessoId }) {
  const codApi = codClienteExibicaoDesdeApi(l);
  if (codigoNorm && codApi !== codigoNorm) return false;

  if (procNorm === '0') {
    const ni = l.numeroInternoProcesso;
    return ni == null || ni === '' || Number(ni) === 0;
  }

  if (procNorm) {
    const ni = Number(l.numeroInternoProcesso);
    if (Number.isFinite(ni) && String(ni) === procNorm) return true;
    if (resolvedProcessoId && Number(l.processoId) === resolvedProcessoId) return true;
    return false;
  }

  return true;
}

export async function carregarResumoContaCorrenteProcesso(
  processoId,
  { codigoCliente, numeroInterno } = {},
) {
  if (!featureFlags.useApiFinanceiro) return null;
  const codigoNorm = normalizarCodigoClienteFinanceiro(codigoCliente);
  const procNorm = normalizarProcFinanceiro(numeroInterno);
  if (codigoNorm && procNorm !== '') {
    const rows = await listarLancamentosProcessoApiFirst({
      processoId,
      codigoCliente,
      numeroInterno,
    });
    const saldo = (rows || []).reduce((s, r) => s + (Number(r.valor) || 0), 0);
    return { saldo, totalLancamentos: rows.length };
  }
  if (!Number(processoId)) return null;
  return request(`/api/financeiro/lancamentos/resumo-processo/${Number(processoId)}`);
}

function mesclarLancamentosApiSemDuplicar(partes) {
  const byKey = new Map();
  for (const list of partes) {
    for (const l of list || []) {
      if (l?.id == null) continue;
      const key =
        l.cartaoId != null || String(l.cartaoNome ?? '').trim() !== '' ? `c-${l.id}` : `b-${l.id}`;
      byKey.set(key, l);
    }
  }
  return [...byKey.values()];
}

/** Leitura de transações por processo em modo API-first, aceitando chave natural como compatibilidade. */
export async function listarLancamentosProcessoApiFirst({ processoId, codigoCliente, numeroInterno }) {
  if (!featureFlags.useApiFinanceiro) return [];
  const codigoNorm = normalizarCodigoClienteFinanceiro(codigoCliente);
  const procNorm = normalizarProcFinanceiro(numeroInterno);
  const resolvedProcessoId = await resolverProcessoId({ processoId, codigoCliente, numeroInterno });
  let clientePk = null;
  if (codigoNorm && featureFlags.useApiProcessos) {
    try {
      const c = await buscarClientePorCodigo(codigoNorm);
      clientePk = clientePkFromApiDto(c);
    } catch {
      /* fallback por processo abaixo */
    }
  }

  const consultas = [];
  if (clientePk) {
    consultas.push(listarLancamentosFinanceiro({ clienteId: clientePk }));
    consultas.push(listarLancamentosCartaoFinanceiro({ clienteId: clientePk }));
  }
  if (resolvedProcessoId) {
    consultas.push(listarLancamentosFinanceiro({ processoId: resolvedProcessoId }));
    consultas.push(listarLancamentosCartaoFinanceiro({ processoId: resolvedProcessoId }));
  }

  const rows = consultas.length > 0 ? mesclarLancamentosApiSemDuplicar(await Promise.all(consultas)) : [];

  const filtered = rows.filter((l) =>
    lancamentoBateContaCorrenteProcesso(l, { codigoNorm, procNorm, resolvedProcessoId }),
  );

  const { contaToLetra } = contaMaps();
  const ehCartao = (l) => l.cartaoId != null || String(l.cartaoNome ?? '').trim() !== '';
  return filtered.map((l) =>
    ehCartao(l) ? mapApiLancamentoCartaoToUi(l, contaToLetra) : mapApiLancamentoToUi(l, contaToLetra),
  );
}

/** Cache local dos extratos: com API ativa continua útil para 1ª pintura e se o GET falhar ou atrasar. */
export function persistirFallbackExtratos(extratos) {
  savePersistedExtratosFinanceiro(extratos);
}

export async function listarVinculosPagamentoFaturaApi() {
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/pagamentos-fatura/vinculos');
}

export async function criarVinculoPagamentoFaturaApi(lancamentoBancoId, lancamentoCartaoId) {
  if (!featureFlags.useApiFinanceiro) {
    throw new Error('API financeiro desativada');
  }
  return request('/api/financeiro/pagamentos-fatura/vinculos', {
    method: 'POST',
    body: { lancamentoBancoId: Number(lancamentoBancoId), lancamentoCartaoId: Number(lancamentoCartaoId) },
  });
}

export async function removerVinculoPagamentoFaturaApi(vinculoId) {
  if (!featureFlags.useApiFinanceiro || !Number(vinculoId)) return;
  await request(`/api/financeiro/pagamentos-fatura/vinculos/${Number(vinculoId)}`, { method: 'DELETE' });
}

export async function obterSaudeFinanceiroApi(opts = {}) {
  if (!featureFlags.useApiFinanceiro) return null;
  return request('/api/financeiro/saude', { signal: opts.signal });
}

export async function listarContadoresEtapaApi(opts = {}) {
  if (!featureFlags.useApiFinanceiro) return null;
  return request('/api/financeiro/lancamentos/contadores-etapa', { signal: opts.signal });
}

export async function listarParesSugeridosCompensacaoApi(opts = {}) {
  if (!featureFlags.useApiFinanceiro) return { pares: [], totalPares: 0, totalPages: 0 };
  const {
    page = 0,
    size = 50,
    numeroBanco,
    ano,
    mes,
    apenasInterbancario,
    apenasMesmoBanco,
    apenasMesmoDiaCalendario,
    apenasDiaDivergente,
    signal,
  } = opts;
  return request('/api/financeiro/lancamentos/pares-sugeridos', {
    query: {
      page,
      size: clampFinanceiroPageSize(size),
      numeroBanco,
      ano,
      mes,
      apenasInterbancario: apenasInterbancario ? true : undefined,
      apenasMesmoBanco: apenasMesmoBanco ? true : undefined,
      apenasMesmoDiaCalendario: apenasMesmoDiaCalendario ? true : undefined,
      apenasDiaDivergente: apenasDiaDivergente ? true : undefined,
    },
    signal,
  });
}

export async function listarGruposCompensacaoInconsistentesApi(opts = {}) {
  if (!featureFlags.useApiFinanceiro) return { grupos: [], total: 0, totalPages: 0 };
  const { page = 0, size = 20, numeroBanco, ano, mes, signal } = opts;
  return request('/api/financeiro/lancamentos/grupos-compensacao/inconsistentes', {
    query: { page, size, numeroBanco, ano, mes },
    signal,
  });
}

export async function sugestoesClassificacaoLoteApi(lancamentoIds, opts = {}) {
  if (!featureFlags.useApiFinanceiro) return { sugestoes: {} };
  return request('/api/financeiro/lancamentos/sugestoes-classificacao/lote', {
    method: 'POST',
    body: { lancamentoIds },
    signal: opts.signal,
  });
}

export async function aplicarSugestoesLoteApi(aplicacoes, opts = {}) {
  if (!featureFlags.useApiFinanceiro) throw new Error('API financeiro desativada');
  return request('/api/financeiro/lancamentos/aplicar-sugestoes/lote', {
    method: 'POST',
    body: { aplicacoes },
    signal: opts.signal,
  });
}

export async function listarSugestoesPagamentoFaturaApi(mesRef, opts = {}) {
  if (!featureFlags.useApiFinanceiro) return { sugestoes: [], totalSugestoes: 0 };
  const { page = 0, size = 20, signal } = opts;
  return request('/api/financeiro/pagamentos-fatura/sugestoes', {
    query: { mes: mesRef, page, size },
    signal,
  });
}

export async function obterSugestaoClassificacaoApi(lancamentoId, opts = {}) {
  if (!featureFlags.useApiFinanceiro) return null;
  return request(`/api/financeiro/lancamentos/${lancamentoId}/sugestao-classificacao`, {
    signal: opts.signal,
  });
}

export async function aplicarSugestaoClassificacaoApi(body, opts = {}) {
  if (!featureFlags.useApiFinanceiro) throw new Error('API financeiro desativada');
  return request('/api/financeiro/lancamentos/aplicar-sugestao', {
    method: 'POST',
    body,
    signal: opts.signal,
  });
}

export async function parearCompensacaoApi(body, opts = {}) {
  if (!featureFlags.useApiFinanceiro) throw new Error('API financeiro desativada');
  return request('/api/financeiro/lancamentos/parear', { method: 'POST', body, signal: opts.signal });
}

export async function listarCartaoBancoMapeamentoApi(opts = {}) {
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/cartao-banco-mapeamento', { signal: opts.signal });
}

export async function criarCartaoBancoMapeamentoApi(body, opts = {}) {
  if (!featureFlags.useApiFinanceiro) throw new Error('API financeiro desativada');
  return request('/api/financeiro/cartao-banco-mapeamento', {
    method: 'POST',
    body,
    signal: opts.signal,
  });
}

export async function atualizarCartaoBancoMapeamentoApi(id, body, opts = {}) {
  if (!featureFlags.useApiFinanceiro) throw new Error('API financeiro desativada');
  return request(`/api/financeiro/cartao-banco-mapeamento/${Number(id)}`, {
    method: 'PUT',
    body,
    signal: opts.signal,
  });
}

export async function removerCartaoBancoMapeamentoApi(id, opts = {}) {
  if (!featureFlags.useApiFinanceiro) return;
  await request(`/api/financeiro/cartao-banco-mapeamento/${Number(id)}`, {
    method: 'DELETE',
    signal: opts.signal,
  });
}

export async function listarRegrasClassificacaoApi(opts = {}) {
  if (!featureFlags.useApiFinanceiro) return [];
  return request('/api/financeiro/regras-classificacao', { signal: opts.signal });
}

export async function criarRegraClassificacaoApi(body, opts = {}) {
  if (!featureFlags.useApiFinanceiro) throw new Error('API financeiro desativada');
  return request('/api/financeiro/regras-classificacao', {
    method: 'POST',
    body,
    signal: opts.signal,
  });
}

export async function atualizarRegraClassificacaoApi(id, body, opts = {}) {
  if (!featureFlags.useApiFinanceiro) throw new Error('API financeiro desativada');
  return request(`/api/financeiro/regras-classificacao/${Number(id)}`, {
    method: 'PUT',
    body,
    signal: opts.signal,
  });
}

export async function removerRegraClassificacaoApi(id, opts = {}) {
  if (!featureFlags.useApiFinanceiro) return;
  await request(`/api/financeiro/regras-classificacao/${Number(id)}`, {
    method: 'DELETE',
    signal: opts.signal,
  });
}

/** Débitos do extrato ainda não vinculados a pagamento operacional. */
export async function buscarLancamentosNaoVinculados(params = {}, opts = {}) {
  const { signal } = opts;
  if (!featureFlags.useApiFinanceiro) return [];
  const q = {};
  if (params.periodoInicio) q.periodoInicio = params.periodoInicio;
  if (params.periodoFim) q.periodoFim = params.periodoFim;
  if (params.numeroBanco != null && String(params.numeroBanco).trim() !== '') {
    q.numeroBanco = Number(params.numeroBanco);
  }
  return request('/api/financeiro/lancamentos/nao-vinculados-pagamento', { query: q, signal });
}
