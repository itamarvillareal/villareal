import {
  buildContaToLetraMerge,
  loadPersistedContasContabeisExtrasFinanceiro,
} from '../../../data/financeiroData.js';
import {
  arquivoExtratoEhOfx,
  arquivoExtratoEhPdf,
  carregarLancamentosDeExtratoPdf,
  isInstituicaoExtratoPdfImport,
  mensagemFalhaExtratoPdf,
  rotuloInstituicaoExtratoPdf,
} from '../../../utils/extratoPdfImport.js';
import {
  analisarLancamentosNovosDedupe,
  parseOfxToExtrato,
  readOfxFileAsText,
  sanitizarLancamentoImportacaoExtrato,
} from '../../../utils/ofx.js';
import { listarLancamentosFinanceiroPaginados, persistirImportacaoOfxFinanceiroApi } from '../../../repositories/financeiroRepository.js';
import { extratoRowToUi, mapApiLancamentoToExtratoRow } from './extratoMappers.js';

export { arquivoExtratoEhOfx, arquivoExtratoEhPdf, isInstituicaoExtratoPdfImport };

/**
 * @param {File} file
 * @param {string} nomeBanco
 * @returns {Promise<{ ok: true, rows: object[], origem: 'OFX'|'PDF', total: number } | { ok: false, message: string }>}
 */
export async function parseArquivoExtrato(file, nomeBanco) {
  if (!file) return { ok: false, message: 'Nenhum arquivo selecionado.' };
  const nome = String(nomeBanco ?? '').trim();
  if (!nome) return { ok: false, message: 'Selecione um banco.' };

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

    if (isInstituicaoExtratoPdfImport(nome)) {
      return {
        ok: false,
        message: `Para ${nome}, use PDF (${rotuloInstituicaoExtratoPdf(nome)}), não OFX.`,
      };
    }

    const text = await readOfxFileAsText(file);
    const rows = parseOfxToExtrato(text, { nomeBanco: nome });
    if (!rows?.length) {
      return { ok: false, message: 'Arquivo OFX sem lançamentos (<STMTTRN>).' };
    }
    return {
      ok: true,
      rows: rows.map((r) => sanitizarLancamentoImportacaoExtrato({ ...r, origemImportacao: 'OFX' })),
      origem: 'OFX',
      total: rows.length,
    };
  } catch (e) {
    return { ok: false, message: e?.message || String(e) };
  }
}

async function carregarLancamentosExistentesBanco(numeroBanco, signal) {
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

/**
 * Prévia de quantos lançamentos do arquivo seriam gravados (modo mesclar).
 * @param {object[]} rows
 * @param {number|null} numeroBanco
 * @param {AbortSignal} [signal]
 */
export async function resumirNovosImportacaoMesclar(rows, numeroBanco, signal, origemImportacao = '') {
  const existente = await carregarLancamentosExistentesBanco(numeroBanco, signal);
  const { novos, ignorados } = analisarLancamentosNovosDedupe(existente, rows, {
    respeitarExtratoComoMestre: /^PDF$/i.test(String(origemImportacao ?? '').trim()),
  });
  return {
    totalArquivo: rows?.length ?? 0,
    noBanco: existente.length,
    novos: novos.length,
    ignorados,
  };
}

/**
 * @param {{ nomeBanco: string, numeroBanco: number|null, modo: 'mesclar'|'substituir', rows: object[], origem: string, signal?: AbortSignal }}
 */
export async function executarImportacaoExtrato({
  nomeBanco,
  numeroBanco,
  modo,
  rows,
  origem,
  signal,
}) {
  const normBanco = String(nomeBanco ?? '').trim();
  const nb = numeroBanco != null && Number.isFinite(Number(numeroBanco)) ? Number(numeroBanco) : null;

  const transacoesAntesNoBanco =
    modo === 'mesclar' ? await carregarLancamentosExistentesBanco(nb, signal) : [];

  const result = await persistirImportacaoOfxFinanceiroApi({
    nomeBanco: normBanco,
    numeroBanco: nb,
    modo,
    transacoesOfx: rows,
    transacoesAntesNoBanco,
    origemImportacao: origem,
  });

  const totalArquivo = rows?.length ?? 0;
  const ignorados = result.ignorados ?? Math.max(0, totalArquivo - (result.criados ?? 0));

  return {
    ...result,
    importados: result.criados ?? 0,
    pendentes: result.criados ?? 0,
    ignorados,
    totalArquivo,
    porDiaDedupe: result.porDiaDedupe ?? {},
  };
}
