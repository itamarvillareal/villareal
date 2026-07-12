package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.time.Instant;

/** Resultado da marcação de conferência (Etapa 5b). */
@Getter
@Setter
public class AcertoConferenciaResponse {

    private int atualizados;
    private Instant conferidoEm;
    private String conferidoPorNome;
}
