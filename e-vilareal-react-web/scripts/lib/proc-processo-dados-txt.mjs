/**
 * Agrega todos os dados TXT de um processo (cliente × nº interno).
 */

import path from 'node:path';
import { coletarEntradasHistoricoLocal } from './historico-local-txt-iterar.mjs';
import { DEFAULT_BASE_HISTORICO_LOCAL } from './historico-local-txt-paths.mjs';
import {
  levantarFasesProcessos,
  lerStatusProcessoTxt,
  resolverAtivoFromStatusProcessoTxt,
  resolverBaseBancoDados,
} from './gerais-fase-processo-txt.mjs';
import { levantarCamposSemanticosProcesso } from './proc-processo-semantic-txt.mjs';
import { lerCabecalhoProcessoTxt } from './proc-processo-cabecalho-txt.mjs';
import { levantarVinculosImovelProc } from './proc-imovel-vinculo-txt.mjs';
import { lerNumeroPessoaCliente151Txt } from './cliente-pessoa-151-txt.mjs';
import { formatCod8 } from './historico-local-txt-paths.mjs';

/**
 * @param {number} codNum
 * @param {number} numeroInterno
 * @param {{
 *   baseBanco?: string,
 *   baseHistorico?: string,
 * }} [opts]
 */
export function levantarDadosProcessoTxt(codNum, numeroInterno, opts = {}) {
  const baseBanco = opts.baseBanco ?? resolverBaseBancoDados();
  const baseHistorico = opts.baseHistorico ?? DEFAULT_BASE_HISTORICO_LOCAL;
  const cod8 = formatCod8(codNum);
  const chave = `${cod8}|${numeroInterno}`;

  const cabecalho = lerCabecalhoProcessoTxt(codNum, numeroInterno, { baseBanco });
  const pessoaCliente = lerNumeroPessoaCliente151Txt(codNum, { baseBanco });

  const semanticMap = levantarCamposSemanticosProcesso({
    clienteFiltro: codNum,
    baseProcMil: path.join(baseBanco, 'Proc', '1000'),
    baseGeraisMil: path.join(baseBanco, 'Gerais', '1000'),
  });
  const semantic = semanticMap.get(chave) ?? null;

  const baseFase = path.join(baseBanco, 'fase');
  const baseGeraisMil = path.join(baseBanco, 'Gerais', '1000');
  const statusProcesso = lerStatusProcessoTxt(codNum, numeroInterno, { baseBanco, baseGeraisMil });
  const faseReg =
    levantarFasesProcessos(baseFase, baseGeraisMil, { clienteFiltro: codNum }).find(
      (r) => r.numeroInterno === numeroInterno
    ) ?? null;

  const imovel =
    levantarVinculosImovelProc(path.join(baseBanco, 'Proc'), { clienteFiltro: codNum }).find(
      (r) => r.numeroInterno === numeroInterno
    ) ?? null;

  const entradasHistorico = coletarEntradasHistoricoLocal({
    base: baseHistorico,
    clienteMin: codNum,
    clienteMax: codNum,
    filtroClienteCod: codNum,
    filtroProcesso: numeroInterno,
  });

  return {
    cod8,
    codNum,
    numeroInterno,
    cabecalho,
    pessoaCliente,
    semantic,
    fase: faseReg,
    statusProcesso,
    imovel,
    entradasHistorico,
    resumo: {
      camposCabecalho: Object.keys(cabecalho.campos).length,
      camposSemanticos: semantic ? Object.keys(semantic.campos).length : 0,
      temFase: Boolean(faseReg?.faseCanonica),
      temObsFase: Boolean(faseReg?.observacaoFase),
      statusInativo: Boolean(statusProcesso.statusInativo),
      temArquivoStatus: Boolean(statusProcesso.temArquivoStatus),
      statusBruto: statusProcesso.statusBruto ?? null,
      pessoaClienteTxt: pessoaCliente.pessoaId ?? null,
      temResponsavel: Boolean(cabecalho.partesTxt?.responsavelNome),
      temUnidade: Boolean(cabecalho.campos.unidade),
      temAudiencia: Boolean(
        semantic?.campos?.audienciaData ||
          semantic?.campos?.audienciaHora ||
          semantic?.campos?.audienciaTipo
      ),
      temPrazo: Boolean(cabecalho.campos.prazoFatal),
      temTramitacao: Boolean(cabecalho.campos.tramitacao),
      temImovel: Boolean(imovel?.numeroPlanilha),
      entradasHistorico: entradasHistorico.length,
    },
  };
}

/**
 * Monta patch para PUT /api/processos/{id}.
 * @param {ReturnType<typeof levantarDadosProcessoTxt>} dados
 */
export function montarPatchProcessoFromTxt(dados) {
  /** @type {Record<string, unknown>} */
  const patch = {
    descricaoAcao: null,
    naturezaAcao: null,
    ...dados.cabecalho.campos,
  };

  if (dados.semantic?.campos) {
    Object.assign(patch, dados.semantic.campos);
  }

  const st =
    dados.statusProcesso ??
    resolverAtivoFromStatusProcessoTxt(dados.fase?.statusBruto ?? null, {
      temArquivo: Boolean(dados.fase?.arquivoStatus),
    });

  patch.ativo = st.ativo;
  if (st.statusInativo) {
    patch.observacaoFase = null;
    delete patch.fase;
  } else if (dados.fase?.statusInativo) {
    /* legado: fase txt com INATIVO sem ficheiro Status.Processo */
    patch.ativo = false;
    patch.observacaoFase = null;
    delete patch.fase;
  } else {
    if (dados.fase?.faseCanonica) patch.fase = dados.fase.faseCanonica;
    if (dados.fase?.observacaoFase != null) patch.observacaoFase = dados.fase.observacaoFase;
  }

  const responsavelNome = dados.cabecalho.partesTxt?.responsavelNome;
  if (responsavelNome) {
    patch._responsavelNome = responsavelNome;
  }

  delete patch._tituloAutor11;
  delete patch._tituloReu61;
  delete patch._parteClienteNome;
  delete patch._parteContraparteNome;

  return patch;
}
