package br.com.vilareal.financeiro.api.dto;

import br.com.vilareal.financeiro.domain.EscopoAplicarRecorrencia;
import br.com.vilareal.financeiro.domain.PrecisaoValorRecorrencia;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class AplicarRecorrenciaRequest {

    private String descricaoNorm;
    private Integer numeroBanco;
    private Long contaContabilId;
    private Long clienteId;
    private Long processoId;
    private boolean criarRegra;
    private boolean dryRun;
    private EscopoAplicarRecorrencia escopo = EscopoAplicarRecorrencia.TODOS;
    private PrecisaoValorRecorrencia precisaoValor = PrecisaoValorRecorrencia.EXATO;
}
