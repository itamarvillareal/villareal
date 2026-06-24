package br.com.vilareal.financeiro.api.dto;

import jakarta.validation.constraints.NotNull;

import java.util.List;

public class ExtratoImportacaoNumerosExistentesRequest {

    @NotNull
    private Integer numeroBanco;

    private List<String> numeros;

    public Integer getNumeroBanco() {
        return numeroBanco;
    }

    public void setNumeroBanco(Integer numeroBanco) {
        this.numeroBanco = numeroBanco;
    }

    public List<String> getNumeros() {
        return numeros;
    }

    public void setNumeros(List<String> numeros) {
        this.numeros = numeros;
    }
}
