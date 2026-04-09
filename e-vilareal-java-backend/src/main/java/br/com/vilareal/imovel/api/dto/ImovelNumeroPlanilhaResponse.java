package br.com.vilareal.imovel.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Número do imóvel na planilha (col. A) para o par cliente + proc")
public class ImovelNumeroPlanilhaResponse {

    private Integer numeroPlanilha;

    public Integer getNumeroPlanilha() {
        return numeroPlanilha;
    }

    public void setNumeroPlanilha(Integer numeroPlanilha) {
        this.numeroPlanilha = numeroPlanilha;
    }
}
