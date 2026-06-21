package br.com.vilareal.imovel.api.dto;

import br.com.vilareal.imovel.domain.StatusRepasse;

import java.math.BigDecimal;

/** Ciclo com aluguel recebido e repasse ainda pendente ou divergente (carteira derivada dos vínculos). */
public record RepassePendenteItemResponse(
        Long contratoId,
        Integer imovelNumeroPlanilha,
        String imovelEndereco,
        String locadorNome,
        String dadosBancariosRepasse,
        String competencia,
        BigDecimal aluguel,
        BigDecimal taxaEsperadaValor,
        BigDecimal despesas,
        BigDecimal repasseEsperado,
        BigDecimal repassado,
        BigDecimal valorEmAberto,
        StatusRepasse statusRepasse) {}
