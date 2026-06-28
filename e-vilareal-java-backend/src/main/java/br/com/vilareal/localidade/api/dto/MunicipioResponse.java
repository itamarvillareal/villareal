package br.com.vilareal.localidade.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Município (detalhe)")
public class MunicipioResponse extends MunicipioResumoResponse {

    private boolean favorito;
    private int usoCount;

    public MunicipioResponse() {}

    public MunicipioResponse(Integer id, String nome, String uf, boolean favorito, int usoCount) {
        super(id, nome, uf);
        this.favorito = favorito;
        this.usoCount = usoCount;
    }

    public boolean isFavorito() {
        return favorito;
    }

    public void setFavorito(boolean favorito) {
        this.favorito = favorito;
    }

    public int getUsoCount() {
        return usoCount;
    }

    public void setUsoCount(int usoCount) {
        this.usoCount = usoCount;
    }
}
