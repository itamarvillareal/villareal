package br.com.vilareal.citacao.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;

public class CitacaoRegistrarRetornoRequest {

    @NotNull
    private Long tentativaId;

    @NotNull
    private LocalDate dataRetorno;

    @NotBlank
    private String motivoRetorno;

    private String movProjudiRetorno;

    private Long andamentoRetornoId;

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

    public String getMotivoRetorno() {
        return motivoRetorno;
    }

    public void setMotivoRetorno(String motivoRetorno) {
        this.motivoRetorno = motivoRetorno;
    }

    public String getMovProjudiRetorno() {
        return movProjudiRetorno;
    }

    public void setMovProjudiRetorno(String movProjudiRetorno) {
        this.movProjudiRetorno = movProjudiRetorno;
    }

    public Long getAndamentoRetornoId() {
        return andamentoRetornoId;
    }

    public void setAndamentoRetornoId(Long andamentoRetornoId) {
        this.andamentoRetornoId = andamentoRetornoId;
    }
}
