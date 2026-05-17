package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AutoClassificarRequest {

    private Integer numeroBanco;
    /** Formato YYYY-MM */
    private String mes;
    private ConfiancaSugestao confiancaMinima = ConfiancaSugestao.ALTA;
    private boolean dryRun = true;
}
