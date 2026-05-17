package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AutoParearRequest {

    private Integer numeroBanco;
    /** Formato YYYY-MM */
    private String mes;
    /** INTERBANCARIO, MESMO_BANCO, TODOS */
    private String tipo = "TODOS";
    private boolean dryRun = true;
    /** Janela de dias entre as datas dos lançamentos do par (default 3). */
    private Integer diasTolerancia;
}
