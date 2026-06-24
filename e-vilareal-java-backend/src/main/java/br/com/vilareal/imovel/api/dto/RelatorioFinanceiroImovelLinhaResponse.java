package br.com.vilareal.imovel.api.dto;

import java.math.BigDecimal;

/** Linha do relatório financeiro imóveis — totais via reconciliação (sem extrato no browser). */
public record RelatorioFinanceiroImovelLinhaResponse(
        Integer numeroPlanilha,
        boolean imovelOcupado,
        String unidade,
        String condominio,
        String inquilino,
        String proprietario,
        String codigoCliente,
        Integer numeroInterno,
        BigDecimal valorAluguel,
        BigDecimal taxaAdministracaoPercent,
        Integer diaVencimentoAluguel,
        Integer diaRepasse,
        BigDecimal totalAluguel,
        BigDecimal totalRepasse,
        BigDecimal totalRepasseAnterior,
        String chaveMesAnterior) {}
