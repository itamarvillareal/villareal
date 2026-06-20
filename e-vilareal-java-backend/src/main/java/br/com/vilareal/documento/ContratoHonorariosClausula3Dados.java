package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.time.LocalDate;

/** Dados estruturados da Cláusula 3ª (remuneração) do contrato de honorários. */
public record ContratoHonorariosClausula3Dados(
        /** {@code PERCENTUAL_PROVEITO}, {@code VALOR_FIXO} ou {@code MISTO}. */
        String tipoRemuneracao,
        BigDecimal percentualProveito,
        BigDecimal valorFixo,
        /** Quando true, inclui texto de parcelamento na Cláusula 3ª. */
        Boolean temParcelamento,
        /** Quando true, gera recebíveis (pagamento RECEBER) vinculados ao processo. */
        Boolean gerarRecebiveis,
        Integer quantidadeParcelas,
        BigDecimal valorTotalParcelas,
        LocalDate primeiroVencimento,
        /** {@code MENSAL} (padrão) ou {@code UNICA}. */
        String intervaloParcelas,
        String formaPagamento) {}
