package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.util.List;

@Getter
@Setter
public class AutoParearResponse {

    private boolean simulacao;
    private int paresEncontrados;
    private int interbancarios;
    private int mesmoBanco;
    private List<AutoParearDetalheResponse> detalhes;
}
