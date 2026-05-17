package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.SugestaoGrupoInconsistente;
import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.List;

@Getter
@Setter
public class GrupoCompensacaoInconsistenteResponse {

    private String grupoCompensacao;
    private List<LancamentoFinanceiroResponse> lancamentos;
    private BigDecimal soma;
    private SugestaoGrupoInconsistente sugestao;
    private String descricaoSugestao;
}
