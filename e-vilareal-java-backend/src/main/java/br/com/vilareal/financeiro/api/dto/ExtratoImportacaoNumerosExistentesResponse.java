package br.com.vilareal.financeiro.api.dto;

import java.util.List;

public class ExtratoImportacaoNumerosExistentesResponse {

    private Integer numeroBanco;
    private List<String> existentes;

    public Integer getNumeroBanco() {
        return numeroBanco;
    }

    public void setNumeroBanco(Integer numeroBanco) {
        this.numeroBanco = numeroBanco;
    }

    public List<String> getExistentes() {
        return existentes;
    }

    public void setExistentes(List<String> existentes) {
        this.existentes = existentes;
    }
}
