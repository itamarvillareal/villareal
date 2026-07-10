/**
 * Geração da Petição de Homologação de Acordo a partir do cálculo aceito do processo.
 */

import { fetchCalculoRodada } from '../repositories/calculosRepository.js';
import {
  listarDimensoesAceitasProcesso,
  resolverUltimaDimensaoAceita,
  MSG_SEM_CALCULO_ACEITO,
} from './calculoRodadaAceito.js';
import { resolverProcessoId } from '../repositories/processosRepository.js';
import {
  gerarPeticaoHomologacaoAcordo,
  previewConteudoPeticaoHomologacaoAcordo,
  previewPdfPeticaoHomologacaoAcordo,
  downloadPdfBlob,
} from '../repositories/documentosRepository.js';
import { padCliente8Config } from '../data/clienteConfigCalculoStorage.js';
import { carregarCalculoSalvo } from './peticaoExecucaoDeRodada.js';
import {
  extrairBoletosHomologacao,
  montarBodyPeticaoHomologacaoAcordo,
  validarElegibilidadeHomologacao,
} from '../data/peticaoHomologacaoAcordoBuilder.js';

export { listarDimensoesAceitasProcesso, resolverUltimaDimensaoAceita, MSG_SEM_CALCULO_ACEITO } from './calculoRodadaAceito.js';

const NOME_ARQUIVO_HOMOLOGACAO = '01.Homologatoria de Acordo.pdf';

function normalizarProc(val) {
  const n = Number(String(val ?? '').trim());
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

/**
 * Carrega cálculo aceito e valida elegibilidade para homologatória.
 * Sempre usa a última dimensão com parcelamento aceito.
 */
export async function carregarCalculoAceitoHomologacao({ codigoCliente, numeroInterno }) {
  const { dimensao, motivo } = await resolverUltimaDimensaoAceita({ codigoCliente, numeroInterno });
  if (dimensao == null) {
    return {
      dados: null,
      elegivel: false,
      motivo,
      boletos: [],
      dimensao: null,
    };
  }
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
    dados: { ...dados, dimensao },
    elegivel: validacao.elegivel,
    motivo: validacao.motivo || '',
    boletos: validacao.boletos || extrairBoletosHomologacao(dados.rodada),
    dimensao,
  };
}

async function prepararHomologacao({
  codigoCliente,
  numeroInterno,
  enderecamento,
  dataIso,
  numeroCnj,
  unidade,
  clausulas,
}) {
  const cod8 = padCliente8Config(codigoCliente);
  const proc = normalizarProc(numeroInterno);

  const carregado = await carregarCalculoAceitoHomologacao({ codigoCliente: cod8, numeroInterno: proc });
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

  return { dados, body, boletos, carregado };
}

function paramsHomologacaoComuns(input) {
  return {
    codigoCliente: input.codigoCliente,
    numeroInterno: input.numeroInterno,
    enderecamento: input.enderecamento,
    dataIso: input.dataIso,
    numeroCnj: input.numeroCnj,
    unidade: input.unidade,
    clausulas: input.clausulas,
  };
}

/**
 * Monta o HTML editável da homologatória (corpo único para a prévia).
 */
export async function previewConteudoHomologacaoDeCalculoAceito(input) {
  const { body, dados, boletos } = await prepararHomologacao(paramsHomologacaoComuns(input));
  const conteudo = await previewConteudoPeticaoHomologacaoAcordo(body);
  return { conteudo, body, dados, boletos, processoId: body.processoId };
}

/**
 * Gera prévia inline do PDF a partir do conteúdo editado (sem salvar no Drive).
 */
export async function previewPdfHomologacaoEditada(conteudo, processoId) {
  return previewPdfPeticaoHomologacaoAcordo(conteudo, { processoId });
}

/**
 * Gera prévia inline do PDF da homologatória (sem salvar no Drive).
 * @deprecated Prefer previewConteudoHomologacaoDeCalculoAceito + previewPdfHomologacaoEditada.
 */
export async function previewPeticaoHomologacaoDeCalculoAceito(input) {
  const { conteudo, body, dados, boletos, processoId } =
    await previewConteudoHomologacaoDeCalculoAceito(input);
  const blob = await previewPdfHomologacaoEditada(conteudo, processoId);
  return { blob, conteudo, dados, body, boletos, processoId };
}

/**
 * Gera o PDF final da homologatória (download + salva no Drive).
 */
export async function gerarPeticaoHomologacaoDeCalculoAceito(input, conteudoEditado = null) {
  const { body, dados, boletos } = await prepararHomologacao(paramsHomologacaoComuns(input));
  if (conteudoEditado) {
    body.conteudoEditado = conteudoEditado;
  }
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
