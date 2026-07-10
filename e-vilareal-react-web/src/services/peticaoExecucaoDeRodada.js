/**
 * Geração da Petição de Execução a partir do cálculo aceito do processo,
 * sem passar pela tela de Cálculos.
 *
 * Por padrão usa a **última dimensão com parcelamento aceito** (maior dimensão aceita).
 * Carrega a rodada (`GET /api/calculos/rodadas/{cod}/{proc}/{dim}`), monta a petição
 * e dispara o PDF da petição + memória de cálculo.
 */

import { fetchCalculoRodada } from '../repositories/calculosRepository.js';
import { resolverUltimaDimensaoAceita } from './calculoRodadaAceito.js';
import { resolverProcessoId } from '../repositories/processosRepository.js';
import { resolverTextosPartesCabecalhoCalculo } from '../data/processosDadosRelatorio.js';
import { gerarPeticaoExecucao, downloadPdfBlob } from '../repositories/documentosRepository.js';
import {
  loadConfigCalculoCliente,
  mergeConfigPainelCalculo,
  padCliente8Config,
} from '../data/clienteConfigCalculoStorage.js';
import { calcularResumoTitulosGrade } from '../data/calculosRodadaTitulosPaginacao.js';
import { montarBodyPeticaoExecucao } from '../data/peticaoExecucaoBuilder.js';
import {
  construirRelatorioCalculoPdf,
  nomeArquivoRelatorioCalculoPdf,
} from '../data/relatorioCalculoPdf.js';

function tituloTemValor(t) {
  return String(t?.valorInicial ?? '').trim() !== '';
}

/** Inteiro do processo (>= 1), igual a `normalizarProc` da tela Cálculos. */
function normalizarProc(val) {
  const n = Number(String(val ?? '').trim());
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/**
 * Carrega e normaliza o cálculo salvo de um processo.
 * @param {{ codigoCliente: string, numeroInterno: (string|number), dimensao?: (string|number) }} args
 * @returns {Promise<null | {
 *   rodada: object, titulos: object[], config: object, cabecalho: object,
 *   aceito: boolean, dataCalculo: string, resumo: object
 * }>}
 */
export async function carregarCalculoSalvo({ codigoCliente, numeroInterno, dimensao = 0 }) {
  const cod8 = padCliente8Config(codigoCliente);
  const proc = normalizarProc(numeroInterno);
  const raw = await fetchCalculoRodada(cod8, proc, dimensao);
  if (!raw || typeof raw !== 'object') return null;

  const aceito = raw.parcelamentoAceito === true;
  const fonteTitulos =
    aceito && Array.isArray(raw.titulosGravadosAceito) && raw.titulosGravadosAceito.length > 0
      ? raw.titulosGravadosAceito
      : Array.isArray(raw.titulos)
        ? raw.titulos
        : [];
  const titulos = fonteTitulos.filter(tituloTemValor);

  const def = loadConfigCalculoCliente(codigoCliente);
  const config = mergeConfigPainelCalculo(def, raw.panelConfig);

  return {
    rodada: raw,
    titulos,
    config,
    cabecalho: raw.cabecalho || {},
    aceito,
    dataCalculo: String(raw.dataCalculoRodada || raw.dataCalculo || '').trim(),
    resumo: calcularResumoTitulosGrade(titulos),
  };
}

/**
 * Carrega a última dimensão com cálculo aceito (parcelamento aceito).
 * @returns {Promise<{ dados: object | null, dimensao: number | null, erro: string }>}
 */
export async function carregarUltimoCalculoAceitoSalvo({ codigoCliente, numeroInterno }) {
  const resolved = await resolverUltimaDimensaoAceita({ codigoCliente, numeroInterno });
  if (resolved.dimensao == null) {
    return { dados: null, dimensao: null, erro: resolved.motivo };
  }
  const dados = await carregarCalculoSalvo({
    codigoCliente,
    numeroInterno,
    dimensao: resolved.dimensao,
  });
  if (!dados) {
    return {
      dados: null,
      dimensao: resolved.dimensao,
      erro: 'Não foi possível carregar o cálculo aceito deste processo.',
    };
  }
  if (!dados.aceito) {
    return {
      dados: null,
      dimensao: resolved.dimensao,
      erro: 'A última dimensão aceita não está disponível para gerar a petição.',
    };
  }
  if (!dados.titulos.length) {
    return {
      dados: null,
      dimensao: resolved.dimensao,
      erro: 'O cálculo aceito não possui títulos com valor para gerar a petição.',
    };
  }
  return {
    dados: { ...dados, dimensao: resolved.dimensao },
    dimensao: resolved.dimensao,
    erro: '',
  };
}

/**
 * Gera a petição de execução (e a memória de cálculo) a partir do cálculo salvo.
 * Lança erro com mensagem amigável quando não há cálculo/títulos ou processo.
 *
 * @param {object} args
 * @param {string} args.codigoCliente
 * @param {string|number} args.numeroInterno
 * @param {string|number} [args.dimensao] — se omitido, usa a última dimensão aceita
 * @param {string} args.enderecamento
 * @param {string} args.modo — 'Completo' | 'Resumido'
 * @param {string} args.dataIso — yyyy-mm-dd
 * @param {object} [args.dadosPreCarregados] — resultado de `carregarCalculoSalvo` (evita refetch)
 */
export async function gerarPeticaoExecucaoDeCalculoSalvo({
  codigoCliente,
  numeroInterno,
  dimensao,
  enderecamento,
  modo,
  dataIso,
  dadosPreCarregados = null,
}) {
  const cod8 = padCliente8Config(codigoCliente);
  const proc = normalizarProc(numeroInterno);

  let dimEfetiva = dimensao;
  if (dimEfetiva == null || dimEfetiva === '') {
    const resolved = await resolverUltimaDimensaoAceita({ codigoCliente: cod8, numeroInterno: proc });
    if (resolved.dimensao == null) {
      throw new Error(resolved.motivo);
    }
    dimEfetiva = resolved.dimensao;
  }

  const dados =
    dadosPreCarregados ??
    (await carregarCalculoSalvo({ codigoCliente, numeroInterno, dimensao: dimEfetiva }));
  if (!dados) {
    throw new Error('Não há cálculo aceito para este processo. Aceite o parcelamento na tela de Cálculos primeiro.');
  }
  if (!dados.aceito) {
    throw new Error('Use um cálculo com parcelamento aceito para gerar a petição de execução.');
  }
  if (!dados.titulos.length) {
    throw new Error('O cálculo salvo não possui títulos com valor para gerar a petição.');
  }

  const processoId = await resolverProcessoId({ codigoCliente: cod8, numeroInterno: proc });
  if (!processoId) {
    throw new Error(
      `Não foi possível localizar o processo (cliente ${cod8}, proc. ${proc}) no banco.`
    );
  }

  const body = montarBodyPeticaoExecucao({
    processoId,
    enderecamento,
    modo,
    dataIso,
    config: dados.config,
    titulos: dados.titulos,
  });

  const blob = await gerarPeticaoExecucao(body);
  downloadPdfBlob(blob, `peticao-execucao-${cod8}-${proc}.pdf`);

  // Junto com a petição, entrega também o PDF do relatório de cálculos (memória de cálculo).
  try {
    let cabPdf = dados.cabecalho || {};
    if (!String(cabPdf.unidade ?? '').trim()) {
      try {
        const partes = await resolverTextosPartesCabecalhoCalculo(cod8, proc);
        if (String(partes.unidade ?? '').trim()) {
          cabPdf = { ...cabPdf, unidade: partes.unidade };
        }
      } catch {
        /* mantém cabecalho salvo */
      }
    }
    const doc = construirRelatorioCalculoPdf({
      titulos: dados.titulos,
      resumo: dados.resumo,
      cabecalho: cabPdf,
      codigoCliente: cod8,
      proc,
      dataCalculo: dados.dataCalculo || dataIso,
      juros: dados.config.juros,
      multa: dados.config.multa,
      honorariosTipo: dados.config.honorariosTipo,
      honorariosValor: dados.config.honorariosValor,
      indice: dados.config.indice,
    });
    doc.save(nomeArquivoRelatorioCalculoPdf(cod8));
  } catch (e) {
    console.warn('[vilareal] Petição gerada, mas falhou o PDF de cálculos:', e);
  }

  return { dados, body };
}
