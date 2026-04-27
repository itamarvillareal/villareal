package br.com.vilareal.pagamento.api.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class PagamentoMarcarPagoRequest {

    @NotNull
    private LocalDate dataPagamentoEfetivo;

    /** If true, status is PAGO_SEM_COMPROVANTE until receipt is uploaded. */
    private boolean semComprovante;

    public LocalDate getDataPagamentoEfetivo() {
        return dataPagamentoEfetivo;
    }

    public void setDataPagamentoEfetivo(LocalDate dataPagamentoEfetivo) {
        this.dataPagamentoEfetivo = dataPagamentoEfetivo;
    }

    public boolean isSemComprovante() {
        return semComprovante;
    }

    public void setSemComprovante(boolean semComprovante) {
        this.semComprovante = semComprovante;
    }
}
