package br.com.vilareal.tarefa.api.dto;

import br.com.vilareal.tarefa.model.TarefaStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

@Getter
@Setter
public class TarefaStatusPatchRequest {

    @NotNull(message = "status é obrigatório.")
    private TarefaStatus status;
}
