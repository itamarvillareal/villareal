package br.com.vilareal.imovel.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.util.ArrayList;
import java.util.List;

@Schema(description = "Todos os vínculos processo para um nº de imóvel (planilha)")
public class ImovelVinculosProcessoResponse {

    private Integer numeroPlanilha;
    private List<ImovelVinculoProcessoItemResponse> vinculos = new ArrayList<>();

    public Integer getNumeroPlanilha() {
        return numeroPlanilha;
    }

    public void setNumeroPlanilha(Integer numeroPlanilha) {
        this.numeroPlanilha = numeroPlanilha;
    }

    public List<ImovelVinculoProcessoItemResponse> getVinculos() {
        return vinculos;
    }

    public void setVinculos(List<ImovelVinculoProcessoItemResponse> vinculos) {
        this.vinculos = vinculos != null ? vinculos : new ArrayList<>();
    }
}
