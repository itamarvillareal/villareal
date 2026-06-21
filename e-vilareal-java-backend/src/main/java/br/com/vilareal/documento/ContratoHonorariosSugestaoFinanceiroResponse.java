package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ContratoHonorariosSugestaoFinanceiroResponse(
        Long contratoId,
        Long processoId,
        String codigoCliente,
        Integer numeroInterno,
        String nomeContratante,
        Long parcelaId,
        Integer numeroParcela,
        BigDecimal parcelaValor,
        LocalDate parcelaDataVencimento,
        Long financeiroLancamentoId,
        BigDecimal financeiroValor,
        LocalDate financeiroData,
        String financeiroDescricao,
        Integer financeiroBancoNumero,
        String financeiroBancoNome,
        boolean precisaClassificarFinanceiro,
        int score,
        String motivo) {}
