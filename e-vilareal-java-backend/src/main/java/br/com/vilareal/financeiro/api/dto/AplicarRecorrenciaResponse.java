package br.com.vilareal.financeiro.api.dto;

import lombok.Getter;
import lombok.Setter;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class AplicarRecorrenciaResponse {

    private int aplicadosNovos;
    private int aplicadosCompletados;
    private Long regraCriadaId;
    private boolean jaExistiaRegra;
    private List<String> erros = new ArrayList<>();
    /** Lançamentos que seriam (ou foram) alterados — preenchido também em dry-run. */
    private List<RecorrenciaLancamentoPreviewItem> lancamentos = new ArrayList<>();

    /** @deprecated usar {@link #getAplicadosNovos()} + {@link #getAplicadosCompletados()} */
    @Deprecated
    public int getAplicados() {
        return aplicadosNovos + aplicadosCompletados;
    }

    /** @deprecated usar {@link #setAplicadosNovos(int)} / {@link #setAplicadosCompletados(int)} */
    @Deprecated
    public void setAplicados(int aplicados) {
        this.aplicadosNovos = aplicados;
        this.aplicadosCompletados = 0;
    }
}
