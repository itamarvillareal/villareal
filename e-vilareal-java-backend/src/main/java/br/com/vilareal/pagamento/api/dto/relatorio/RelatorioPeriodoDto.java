package br.com.vilareal.pagamento.api.dto.relatorio;

import java.time.LocalDate;

public class RelatorioPeriodoDto {

    private LocalDate inicio;
    private LocalDate fim;

    public RelatorioPeriodoDto() {}

    public RelatorioPeriodoDto(LocalDate inicio, LocalDate fim) {
        this.inicio = inicio;
        this.fim = fim;
    }

    public LocalDate getInicio() {
        return inicio;
    }

    public void setInicio(LocalDate inicio) {
        this.inicio = inicio;
    }

    public LocalDate getFim() {
        return fim;
    }

    public void setFim(LocalDate fim) {
        this.fim = fim;
    }
}
