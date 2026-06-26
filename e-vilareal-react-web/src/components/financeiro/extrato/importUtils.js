import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  arquivoExtratoEhOfx,
  arquivoExtratoEhPdf,
  carregarLancamentosDeExtratoPdf,
  instituicaoAceitaOfx,
  isInstituicaoExtratoPdfImport,
  mensagemFalhaExtratoPdf,
  rotuloInstituicaoExtratoPdf,
} from '../../../utils/extratoPdfImport.js';
import {
  analisarLancamentosNovosDedupe,
  parseOfxContaBancaria,
  parseOfxToExtrato,
  readOfxFileAsText,
  sanitizarLancamentoImportacaoExtrato,
} from '../../../utils/ofx.js';
import { validarOfxParaContaDestino } from '../../../utils/ofxContaValidacao.js';
import {
  aplicarProtecaoDataCorteImportacao,
  aplicarProtecaoDataCorteImportacaoComData,
  formatarDataCorteBr,
} from '../../../utils/extratoImportProtecao.js';
import {
  consultarNumerosLancamentoExistentesApi,
  listarLancamentosFinanceiroPaginados,
  obterContextoImportacaoExtratoApi,
  persistirImportacaoOfxFinanceiroApi,
} from '../../../repositories/financeiroRepository.js';
import { extratoRowToUi, mapApiLancamentoToExtratoRow } from './extratoMappers.js';

export { arquivoExtratoEhOfx, arquivoExtratoEhPdf, isInstituicaoExtratoPdfImport };

/**
 * @param {File} file
 * @param {string} nomeBanco
 * @param {{ bancos?: object[] }} [opcoes]
 * @returns {Promise<
 *   | { ok: true, rows: object[], origem: 'OFX'|'PDF', total: number, ofxConta?: object|null }
 *   | { ok: false, message: string, contaSugerida?: { nome: string, numero: number }, ofxConta?: object|null }
 * >}
 */
export async function parseArquivoExtrato(file, nomeBanco, opcoes = {}) {
  if (!file) return { ok: false, message: 'Nenhum arquivo selecionado.' };
  const nome = String(nomeBanco ?? '').trim();
  if (!nome) return { ok: false, message: 'Selecione um banco.' };

  const bancos = Array.isArray(opcoes.bancos) ? opcoes.bancos : [];
  const bancoDestino = bancos.find((b) => b.nome === nome) ?? null;

  const pdf = arquivoExtratoEhPdf(file);
  const ofx = arquivoExtratoEhOfx(file);
  if (!pdf && !ofx) {
    return { ok: false, message: 'Use arquivo .ofx (ou .qfx) ou .pdf (BTG, Bradesco, Sicoob, 99 Pay).' };
  }

  try {
    if (pdf) {
      if (!isInstituicaoExtratoPdfImport(nome)) {
        return {
          ok: false,
          message: `Para ${nome}, use OFX. PDF disponível para BTG, Bradesco, Sicoob e 99 Pay.`,
        };
      }
      const { rows, texto } = await carregarLancamentosDeExtratoPdf(file, nome);
      if (!rows.length) {
        return {
          ok: false,
          message: mensagemFalhaExtratoPdf(texto, nome),
        };
      }
      return {
        ok: true,
        rows: rows.map((r) => sanitizarLancamentoImportacaoExtrato({ ...r, origemImportacao: 'PDF' })),
        origem: 'PDF',
        total: rows.length,
      };
    }

    if (!instituicaoAceitaOfx(nome, bancoDestino)) {
      return {
        ok: false,
        message: `Para ${nome}, use PDF (${rotuloInstituicaoExtratoPdf(nome)}), não OFX.`,
      };
    }

    const text = await readOfxFileAsText(file);
    const ofxConta = parseOfxContaBancaria(text);
    const validacao = validarOfxParaContaDestino(ofxConta, bancoDestino, bancos);
    if (!validacao.ok) {
      return {
        ok: false,
        message: validacao.message,
        contaSugerida: validacao.contaSugerida ?? null,
        ofxConta: validacao.ofxConta ?? ofxConta,
      };
    }

    const rows = parseOfxToExtrato(text, { nomeBanco: nome });
    if (!rows?.length) {
      return { ok: false, message: 'Arquivo OFX sem lançamentos (<STMTTRN>).' };
    }
    return {
      ok: true,
      rows: rows.map((r) => sanitizarLancamentoImportacaoExtrato({ ...r, origemImportacao: 'OFX' })),
      origem: 'OFX',
      total: rows.length,
      ofxConta: validacao.ofxConta ?? ofxConta,
    };
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
}

export async function carregarLancamentosExistentesBanco(numeroBanco, signal) {
  const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
  const nb = Number(numeroBanco);
  if (!Number.isFinite(nb)) return [];

  const out = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const res = await listarLancamentosFinanceiroPaginados(
      { numeroBanco: nb, page, size: 200, sort: 'dataLancamento,asc' },
      { signal },
    );
    for (const l of res?.content ?? []) {
      out.push(extratoRowToUi(mapApiLancamentoToExtratoRow(l, contaToLetra)));
    }
    totalPages = Math.max(1, Number(res?.totalPages ?? 1));
    page += 1;
  }
  return out;
}

/** Só lançamentos a partir da data de corte (janela mínima para dedupe semântico). */
export async function carregarLancamentosExistentesBancoDesde(numeroBanco, dataCorteIso, signal) {
  const nb = Number(numeroBanco);
  const dataInicio = String(dataCorteIso ?? '').slice(0, 10);
  if (!Number.isFinite(nb) || !dataInicio) return [];

  const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
  const out = [];
  let page = 0;
  let totalPages = 1;
  while (page < totalPages) {
    const res = await listarLancamentosFinanceiroPaginados(
      { numeroBanco: nb, dataInicio, page, size: 500, sort: 'dataLancamento,asc' },
      { signal },
    );
    const content = res?.content ?? [];
    for (const l of content) {
      out.push(extratoRowToUi(mapApiLancamentoToExtratoRow(l, contaToLetra)));
    }
    totalPages = Math.max(1, Number(res?.totalPages ?? 1));
    page += 1;
    if (!content.length) break;
  }
  return out;
}

/** Lançamentos ATIVOS no intervalo DTSTART–DTEND (para diagnóstico Reparar). */
export async function carregarLancamentosExistentesBancoNoPeriodo(
  numeroBanco,
  dataInicioIso,
  dataFimIso,
  signal,
) {
  const nb = Number(numeroBanco);
  const dataInicio = String(dataInicioIso ?? '').slice(0, 10);
  const dataFim = String(dataFimIso ?? '').slice(0, 10);
  if (!Number.isFinite(nb) || !dataInicio || !dataFim) {
    return { rows: [], totalInPeriod: 0 };
  }

  const contaToLetra = buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro());
  const out = [];
  let page = 0;
  let totalPages = 1;
  let totalInPeriod = 0;
  while (page < totalPages) {
    const res = await listarLancamentosFinanceiroPaginados(
      { numeroBanco: nb, dataInicio, dataFim, page, size: 500, sort: 'dataLancamento,asc' },
      { signal },
    );
    if (page === 0) {
      totalInPeriod = Number(res?.totalElements ?? 0);
    }
    const content = res?.content ?? [];
    for (const l of content) {
      out.push(extratoRowToUi(mapApiLancamentoToExtratoRow(l, contaToLetra)));
    }
    totalPages = Math.max(1, Number(res?.totalPages ?? 1));
    page += 1;
    if (!content.length) break;
  }
  return { rows: out, totalInPeriod: totalInPeriod || out.length };
}

function montarExistenteParaDedupe(existenteSemantico, numerosJaExistentes) {
  const out = [...(existenteSemantico || [])];
  const numerosCarregados = new Set(out.map((t) => String(t?.numero ?? '').trim()).filter(Boolean));
  for (const num of numerosJaExistentes || []) {
    const n = String(num ?? '').trim();
    if (!n || numerosCarregados.has(n)) continue;
    out.push({ numero: n });
  }
  return out;
}

async function prepararImportacaoMesclarRapido(rows, numeroBanco, signal, origemImportacao = '') {
  const nb = Number(numeroBanco);
  const ctx = await obterContextoImportacaoExtratoApi(nb, signal);
  const dataCorte = ctx?.dataCorte ? String(ctx.dataCorte).slice(0, 10) : null;
  const protecao = dataCorte
    ? aplicarProtecaoDataCorteImportacaoComData(rows, dataCorte)
    : aplicarProtecaoDataCorteImportacao(rows, [], { modo: 'mesclar' });

  const existenteSemantico = dataCorte
    ? await carregarLancamentosExistentesBancoDesde(nb, dataCorte, signal)
    : [];

  const numeros = [
    ...new Set(protecao.rows.map((r) => String(r?.numero ?? '').trim()).filter(Boolean)),
  ];
  const existentesNumeros = numeros.length
    ? await consultarNumerosLancamentoExistentesApi(nb, numeros, signal)
    : [];

  const existente = montarExistenteParaDedupe(existenteSemantico, existentesNumeros);
  const analise = analisarLancamentosNovosDedupe(existente, protecao.rows, {
    respeitarExtratoComoMestre: /^PDF$/i.test(String(origemImportacao ?? '').trim()),
  });

  return {
    totalArquivo: protecao.totalArquivo,
    noBanco: Number(ctx?.totalNoBanco ?? existenteSemantico.length),
    novos: analise.novos.length,
    ignorados: analise.ignorados,
    ignoradosPorCorte: protecao.ignoradosPorCorte,
    dataCorte: protecao.dataCorte,
    dataCorteBr: formatarDataCorteBr(protecao.dataCorte),
    linhasAposCorte: protecao.rows.length,
    preparacao: {
      existente,
      protecao,
      linhasNovas: analise.novos,
    },
  };
}

/**
 * Prévia de quantos lançamentos do arquivo seriam gravados (modo mesclar).
 * @param {object[]} rows
 * @param {number|null} numeroBanco
 * @param {AbortSignal} [signal]
 */
export async function resumirNovosImportacaoMesclar(rows, numeroBanco, signal, origemImportacao = '') {
  const nb = Number(numeroBanco);
  if (featureFlags.useApiFinanceiro && Number.isFinite(nb)) {
    try {
      return await prepararImportacaoMesclarRapido(rows, nb, signal, origemImportacao);
    } catch {
      /* fallback legado abaixo */
    }
  }

  const existente = await carregarLancamentosExistentesBanco(numeroBanco, signal);
  const protecao = aplicarProtecaoDataCorteImportacao(rows, existente, { modo: 'mesclar' });
  const { novos, ignorados } = analisarLancamentosNovosDedupe(existente, protecao.rows, {
    respeitarExtratoComoMestre: /^PDF$/i.test(String(origemImportacao ?? '').trim()),
  });
  return {
    totalArquivo: protecao.totalArquivo,
    noBanco: existente.length,
    novos: novos.length,
    ignorados,
    ignoradosPorCorte: protecao.ignoradosPorCorte,
    dataCorte: protecao.dataCorte,
    dataCorteBr: formatarDataCorteBr(protecao.dataCorte),
    linhasAposCorte: protecao.rows.length,
    preparacao: {
      existente,
      protecao,
      linhasNovas: novos,
    },
  };
}

/**
 * @param {{ nomeBanco: string, numeroBanco: number|null, modo: 'mesclar'|'substituir', rows: object[], origem: string, signal?: AbortSignal, preparacaoCache?: object }}
 */
export async function executarImportacaoExtrato({
  nomeBanco,
  numeroBanco,
  modo,
  rows,
  origem,
  signal,
  preparacaoCache,
}) {
  const normBanco = String(nomeBanco ?? '').trim();
  const nb = numeroBanco != null && Number.isFinite(Number(numeroBanco)) ? Number(numeroBanco) : null;

  let transacoesAntesNoBanco = [];
  let protecao;
  let linhasNovasPrecomputadas = null;

  if (modo === 'mesclar') {
    if (preparacaoCache?.protecao && preparacaoCache?.existente) {
      transacoesAntesNoBanco = preparacaoCache.existente;
      protecao = preparacaoCache.protecao;
      linhasNovasPrecomputadas = preparacaoCache.linhasNovas ?? null;
    } else if (featureFlags.useApiFinanceiro && nb != null) {
      try {
        const prep = await prepararImportacaoMesclarRapido(rows, nb, signal, origem);
        transacoesAntesNoBanco = prep.preparacao.existente;
        protecao = prep.preparacao.protecao;
        linhasNovasPrecomputadas = prep.preparacao.linhasNovas;
      } catch {
        transacoesAntesNoBanco = await carregarLancamentosExistentesBanco(nb, signal);
        protecao = aplicarProtecaoDataCorteImportacao(rows, transacoesAntesNoBanco, { modo });
      }
    } else {
      transacoesAntesNoBanco = await carregarLancamentosExistentesBanco(nb, signal);
      protecao = aplicarProtecaoDataCorteImportacao(rows, transacoesAntesNoBanco, { modo });
    }
  } else {
    protecao = aplicarProtecaoDataCorteImportacao(rows, [], { modo });
  }

  const result = await persistirImportacaoOfxFinanceiroApi({
    nomeBanco: normBanco,
    numeroBanco: nb,
    modo,
    transacoesOfx: protecao.rows,
    transacoesAntesNoBanco,
    origemImportacao: origem,
    dataCorteImportacao: protecao.dataCorte,
    linhasNovasPrecomputadas,
  });

  const totalArquivo = protecao.totalArquivo;
  const ignoradosDedupe = result.ignorados ?? Math.max(0, protecao.rows.length - (result.criados ?? 0));

  return {
    ...result,
    importados: result.criados ?? 0,
    pendentes: result.criados ?? 0,
    ignorados: ignoradosDedupe + (protecao.ignoradosPorCorte ?? 0),
    ignoradosDedupe,
    ignoradosPorCorte: protecao.ignoradosPorCorte ?? 0,
    dataCorte: protecao.dataCorte,
    dataCorteBr: formatarDataCorteBr(protecao.dataCorte),
    totalArquivo,
    porDiaDedupe: result.porDiaDedupe ?? {},
  };
}
