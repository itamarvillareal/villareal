package br.com.vilareal.topicos.api.dto;

import java.util.ArrayList;
import java.util.List;

public class TopicoProcessarMultiplosResponse {

    private List<TopicoProcessarResponse> itens = new ArrayList<>();

    public List<TopicoProcessarResponse> getItens() {
        return itens;
    }

    public void setItens(List<TopicoProcessarResponse> itens) {
        this.itens = itens;
    }
}
