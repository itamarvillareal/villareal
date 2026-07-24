package br.com.vilareal.patrimonio.domain.finance;

import java.math.BigDecimal;
import java.time.LocalDate;

/**
 * Uma linha do cronograma de pagamento.
 */
public record ParcelaCronograma(
        int numero,
        LocalDate vencimento,
        BigDecimal valorParcela,
        BigDecimal amortizacao,
        BigDecimal juros,
        BigDecimal segurosTaxas,
        BigDecimal saldoApos
) {
    public BigDecimal valorTotal() {
        return valorParcela.add(segurosTaxas != null ? segurosTaxas : BigDecimal.ZERO);
    }
}
