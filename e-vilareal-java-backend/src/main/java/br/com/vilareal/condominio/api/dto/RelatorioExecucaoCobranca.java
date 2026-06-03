package br.com.vilareal.condominio.api.dto;

import java.util.List;

/** Relatório completo da execução de cobrança automática (JSON do /processar e GET /relatorio). */
public record RelatorioExecucaoCobranca(
        String importacaoId,
        RelatorioCabecalhoDto cabecalho,
        RelatorioTotaisDocumentoDto totaisDocumento,
        RelatorioTotaisExecucaoDto totaisExecucao,
        List<RelatorioItemUnidadeDto> itens,
        List<CobrancaProcessarErroDto> erros,
        List<String> pontosAtencao) {}
