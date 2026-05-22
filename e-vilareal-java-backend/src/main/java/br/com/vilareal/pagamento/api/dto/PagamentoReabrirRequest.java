package br.com.vilareal.pagamento.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public class PagamentoReabrirRequest {

    @NotBlank
    @Size(min = 5, max = 500)
    private String observacao;

    public String getObservacao() {
        return observacao;
    }

    public void setObservacao(String observacao) {
        this.observacao = observacao;
    }
}
