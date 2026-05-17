package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
public class AutoClassificarRequest {

    private Integer numeroBanco;
    /** Formato YYYY-MM */
    private String mes;
    /** Confiança mínima da regra (0–1). Default 0,85. */
    private BigDecimal confiancaMinima = new BigDecimal("0.85");
    private boolean dryRun = true;
}
