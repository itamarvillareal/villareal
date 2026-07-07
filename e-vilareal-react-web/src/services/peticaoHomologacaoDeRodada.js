/**
 * Geração da Petição de Homologação de Acordo a partir do cálculo aceito do processo.
 */

import { fetchCalculoRodada, fetchCalculoRodadasResumo } from '../repositories/calculosRepository.js';
import { resolverProcessoId } from '../repositories/processosRepository.js';
import { gerarPeticaoHomologacaoAcordo, downloadPdfBlob } from '../repositories/documentosRepository.js';
import { padCliente8Config } from '../data/clienteConfigCalculoStorage.js';
import { carregarCalculoSalvo } from './peticaoExecucaoDeRodada.js';
import {
  extrairBoletosHomologacao,
  montarBodyPeticaoHomologacaoAcordo,
  validarElegibilidadeHomologacao,
} from '../data/peticaoHomologacaoAcordoBuilder.js';

const NOME_ARQUIVO_HOMOLOGACAO = '01.Homologatoria de Acordo.pdf';

function normalizarProc(val) {
  const n = Number(String(val ?? '').trim());
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

function parseDimensaoDaChave(chave) {
  const parts = String(chave ?? '').split(':');
  if (parts.length < 3) return NaN;
  return parseInt(parts[2], 10);
}

/** Lista dimensões com parcelamento aceito, da maior para a menor. */
export async function listarDimensoesAceitasProcesso({ codigoCliente, numeroInterno }) {
  const cod8 = padCliente8Config(codigoCliente);
  const proc = String(normalizarProc(numeroInterno));
  const prefixo = `${cod8}:${proc}:`;
  const resumo = await fetchCalculoRodadasResumo();
  const rodadas = Array.isArray(resumo?.rodadas) ? resumo.rodadas : [];
  return rodadas
    .filter((r) => r?.parcelamentoAceito && String(r?.chave ?? '').startsWith(prefixo))
    .map((r) => ({
      dimensao: parseDimensaoDaChave(r.chave),
      chave: r.chave,
    }))
    .filter((r) => Number.isFinite(r.dimensao))
    .sort((a, b) => b.dimensao - a.dimensao);
}

/**
 * Carrega cálculo aceito e valida elegibilidade para homologatória.
 */
export async function carregarCalculoAceitoHomologacao({
  codigoCliente,
  numeroInterno,
  dimensao = 0,
}) {
  const dados = await carregarCalculoSalvo({ codigoCliente, numeroInterno, dimensao });
  if (!dados) {
    return {
      dados: null,
      elegivel: false,
      motivo: 'Não há cálculo salvo para este processo.',
      boletos: [],
    };
  }
  const validacao = validarElegibilidadeHomologacao(dados.rodada);
  return {
    dados,
    elegivel: validacao.elegivel,
    motivo: validacao.motivo || '',
    boletos: validacao.boletos || extrairBoletosHomologacao(dados.rodada),
  };
}

/**
 * Gera o PDF da petição de homologação de acordo.
 */
export async function gerarPeticaoHomologacaoDeCalculoAceito({
  codigoCliente,
  numeroInterno,
  dimensao = 0,
  enderecamento,
  dataIso,
  numeroCnj,
  unidade,
  clausulas,
  dadosPreCarregados = null,
}) {
  const cod8 = padCliente8Config(codigoCliente);
  const proc = normalizarProc(numeroInterno);

  const carregado =
    dadosPreCarregados ??
    (await carregarCalculoAceitoHomologacao({ codigoCliente: cod8, numeroInterno: proc, dimensao }));
  if (!carregado?.dados) {
    throw new Error(carregado?.motivo || 'Não há cálculo salvo para este processo.');
  }
  if (!carregado.elegivel) {
    throw new Error(carregado.motivo || 'Cálculo não elegível para homologatória de acordo.');
  }

  const { dados, boletos } = carregado;
  if (!dados.titulos?.length) {
    throw new Error('O cálculo aceito não possui títulos com valor para gerar a petição.');
  }

  const processoId = await resolverProcessoId({ codigoCliente: cod8, numeroInterno: proc });
  if (!processoId) {
    throw new Error(`Não foi possível localizar o processo (cliente ${cod8}, proc. ${proc}) no banco.`);
  }

  const unidadeEfetiva =
    String(unidade ?? '').trim() ||
    String(dados.cabecalho?.unidade ?? '').trim() ||
    '';

  const body = montarBodyPeticaoHomologacaoAcordo({
    processoId,
    numeroCnj: numeroCnj || '',
    enderecamento,
    dataIso,
    unidade: unidadeEfetiva,
    titulos: dados.titulos,
    boletos,
    clausulas,
  });

  const blob = await gerarPeticaoHomologacaoAcordo(body);
  downloadPdfBlob(blob, NOME_ARQUIVO_HOMOLOGACAO);
  return { dados, body, boletos };
}

/** Carrega rodada bruta (útil para pré-visualizar dimensão específica). */
export async function fetchRodadaAceita({ codigoCliente, numeroInterno, dimensao }) {
  const cod8 = padCliente8Config(codigoCliente);
  const proc = normalizarProc(numeroInterno);
  return fetchCalculoRodada(cod8, proc, dimensao);
}

export { NOME_ARQUIVO_HOMOLOGACAO };
