package br.com.vilareal.api.dto;

import br.com.vilareal.api.entity.enums.TarefaOperacionalStatus;
import jakarta.validation.constraints.NotNull;

public class TarefaOperacionalStatusPatchRequest {
    @NotNull
    private TarefaOperacionalStatus status;
    private String observacaoConclusao;

    public TarefaOperacionalStatus getStatus() { return status; }
    public void setStatus(TarefaOperacionalStatus status) { this.status = status; }
    public String getObservacaoConclusao() { return observacaoConclusao; }
    public void setObservacaoConclusao(String observacaoConclusao) { this.observacaoConclusao = observacaoConclusao; }
}
