package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.imovel.domain.StatusRepasse;

import java.math.BigDecimal;

/**
 * Linha da visão geral do portfólio de imóveis: cadastro resumido + contrato vigente
 * + situação financeira da competência, tudo numa única chamada.
 */
public record ImovelVisaoGeralItemResponse(
        Long imovelId,
        Integer numeroPlanilha,
        String titulo,
        String enderecoCompleto,
        String condominio,
        String unidade,
        String tipoImovel,
        String situacao,
        boolean ocupado,
        String inquilino,
        String proprietario,
        String codigoCliente,
        Integer numeroInterno,
        Long contratoId,
        String contratoStatus,
        BigDecimal valorAluguel,
        BigDecimal taxaAdministracaoPercent,
        Integer diaVencimentoAluguel,
        Integer diaRepasse,
        BigDecimal aluguelRecebido,
        BigDecimal repassado,
        BigDecimal despesas,
        BigDecimal resultadoEscritorio,
        StatusRepasse statusRepasse,
        boolean repasseInterno,
        BigDecimal repasseMesAnterior,
        String chaveMesAnterior) {}
