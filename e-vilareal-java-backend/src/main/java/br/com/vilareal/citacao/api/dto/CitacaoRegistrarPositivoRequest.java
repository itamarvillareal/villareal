package br.com.vilareal.citacao.api.dto;

import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class CitacaoRegistrarPositivoRequest {

    @NotNull
    private Long tentativaId;

    private LocalDate dataRetorno;

    public Long getTentativaId() {
        return tentativaId;
    }

    public void setTentativaId(Long tentativaId) {
        this.tentativaId = tentativaId;
    }

    public LocalDate getDataRetorno() {
        return dataRetorno;
    }

    public void setDataRetorno(LocalDate dataRetorno) {
        this.dataRetorno = dataRetorno;
    }
}
