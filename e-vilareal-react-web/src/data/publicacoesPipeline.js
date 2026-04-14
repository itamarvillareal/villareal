/**
 * Orquestra Camada 1 (PDF/parser) + Camada 2 (DataJud) sem substituir teor do PDF.
 */

import {
  processarTextoPdfPublicacoes,
  deduplicarParseados,
  fundirParesComplementaresPublicacoes,
  publicacaoSuprimivelSemTeorSemCnj,
} from './publicacoesPdfParser.js';
import { vincularPublicacaoAoCadastro } from './publicacoesVinculoProcessos.js';
import { consultarProcessoDatajud } from './datajudApiClient.js';
import {
  compararTribunalPdfComCnj,
  calcularScoreConfianca,
  comporStatusValidacaoCnj,
} from './publicacoesValidacaoScore.js';

/**
 * Processa texto extraído do PDF + enriquecimento DataJud + vínculo interno.
 * @param {{ skipDatajud?: boolean }} opts — desliga consultas à API (ex.: importação offline).
 */
export async function executarPipelineImportacaoPublicacoes(textoBruto, indiceCnjMap, opts = {}) {
  const { skipDatajud = false } = opts;
  const { limpo, blocos, parseados, metricas } = processarTextoPdfPublicacoes(textoBruto);
  const { itens: dedup, duplicatasDescartadas } = deduplicarParseados(parseados);
  const nAntesFusao = dedup.length;
  const dedupFundidos = fundirParesComplementaresPublicacoes(dedup);
  const fundidosComplementares = nAntesFusao - dedupFundidos.length;

  const dedupVisivel = [];
  let suprimidosSemTeorSemCnj = 0;
  for (const p of dedupFundidos) {
    if (publicacaoSuprimivelSemTeorSemCnj(p)) {
      suprimidosSemTeorSemCnj += 1;
      continue;
    }
    dedupVisivel.push(p);
  }

  const enriquecidos = [];
  const logsItens = [];
  let confirmadosCnj = 0;
  let naoConfirmados = 0;
  let consultasFalha = 0;
  let consultasPuladas = 0;

  for (const p of dedupVisivel) {
    const v = vincularPublicacaoAoCadastro(p, indiceCnjMap);
    let dj = null;
    let divergencias = [];
    if (skipDatajud) {
      consultasPuladas += 1;
      dj = { ok: false, motivo: 'camada2_desligada', hit: false };
    } else if (v.processoCnjNormalizado) {
      dj = await consultarProcessoDatajud(v.processoCnjNormalizado);
      if (dj?.hit) {
        confirmadosCnj += 1;
        divergencias = compararTribunalPdfComCnj(v.diario, v.processoCnjNormalizado, dj.dados);
      } else if (dj?.ok) {
        naoConfirmados += 1;
      } else {
        consultasFalha += 1;
      }
    }

    const statusVal = skipDatajud
      ? 'nao_consultado'
      : comporStatusValidacaoCnj(dj, divergencias);
    const score = calcularScoreConfianca({
      processoCnjNormalizado: v.processoCnjNormalizado,
      statusTeor: v.statusTeor,
      statusVinculo: v.statusVinculo,
      datajudResult: dj,
      divergencias,
    });

    const jsonBrutoTrunc =
      dj?.jsonBruto != null ? JSON.stringify(dj.jsonBruto).slice(0, 12000) : null;

    const reg = {
      ...v,
      divergenciasPdfCnj: divergencias,
      statusValidacaoCnj: statusVal,
      scoreConfianca: score,
      dadosDatajud: dj?.dados ?? null,
      jsonCnjBruto: jsonBrutoTrunc,
      ultimoMovimentoCnj: dj?.dados?.ultimoMovimentoTexto ?? null,
      dataUltimoMovimentoCnj: dj?.dados?.ultimoMovimentoData ?? null,
      tribunalCnj: dj?.dados?.tribunal ?? dj?.tribunalResolvido?.sigla ?? null,
      classeProcessual: dj?.dados?.classe ?? null,
      assuntos: dj?.dados?.assuntos ?? null,
      orgaoJulgador: dj?.dados?.orgaoJulgador ?? null,
      grau: dj?.dados?.grau ?? null,
      nivelSigilo: dj?.dados?.nivelSigilo ?? null,
    };

    enriquecidos.push(reg);
    logsItens.push({
      indice: v.indiceBloco,
      cnj: v.processoCnjNormalizado,
      datajudMotivo: dj?.motivo,
      divergencias: divergencias.length ? divergencias : undefined,
    });
  }

  const relatorio = {
    ...metricas,
    duplicatasDescartadas,
    fundidosComplementares,
    suprimidosSemTeorSemCnj,
    semTeorNaPrevia: enriquecidos.filter((x) => x.statusTeor === 'vazio').length,
    blocosAposDedup: enriquecidos.length,
    confirmadosDatajud: confirmadosCnj,
    naoConfirmadosDatajud: naoConfirmados,
    consultasComErroRede: consultasFalha,
    consultasDatajudPuladas: consultasPuladas,
    vinculadosInterno: enriquecidos.filter((x) => x.statusVinculo === 'vinculado').length,
    /** Alias para UI legada */
    vinculosEncontrados: enriquecidos.filter((x) => x.statusVinculo === 'vinculado').length,
    naoVinculados: enriquecidos.filter((x) => x.statusVinculo === 'nao_vinculado' || x.statusVinculo === 'sem_cnj').length,
  };

  return {
    limpo,
    blocos,
    parseados: enriquecidos,
    metricas: relatorio,
    logsItens,
  };
}
