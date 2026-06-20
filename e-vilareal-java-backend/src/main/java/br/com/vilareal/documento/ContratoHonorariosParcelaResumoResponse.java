package br.com.vilareal.documento;

import java.math.BigDecimal;
import java.time.LocalDate;

public record ContratoHonorariosParcelaResumoResponse(
        Long id,
        Integer numeroParcela,
        BigDecimal valor,
        LocalDate dataVencimento,
        Long pagamentoId,
        /** Status do pagamento RECEBER vinculado (ex.: EMITIDO, RECEBIDO, VENCIDO). */
        String pagamentoStatus,
        /** Data em que o cliente pagou (quando informada no recebível). */
        LocalDate pagamentoDataRecebimento,
        /** Lançamento na Conta Corrente / financeiro vinculado ao recebível. */
        Long pagamentoFinanceiroLancamentoId,
        /** Data efetiva do pagamento (recebível ou data do lançamento financeiro). */
        LocalDate pagamentoDataPagamento,
        /** Nº da conta bancária no financeiro (quando conciliado). */
        Integer pagamentoBancoNumero,
        /** Nome do banco no financeiro (quando conciliado). */
        String pagamentoBancoNome,
        /** Indica recebimento confirmado (RECEBIDO ou CONCILIADO). */
        Boolean pagamentoPago) {}
