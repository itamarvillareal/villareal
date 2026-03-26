package br.com.vilareal.tarefa.api.dto;

import br.com.vilareal.tarefa.model.TarefaPrioridade;
import br.com.vilareal.tarefa.model.TarefaStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;

@Getter
@Setter
public class TarefaOperacionalWriteRequest {

    @NotBlank(message = "titulo é obrigatório.")
    @Size(max = 500)
    private String titulo;

    private String descricao;

    private Long responsavelUsuarioId;

    private TarefaStatus status;

    private TarefaPrioridade prioridade;

    private LocalDate dataLimite;

    private Long clienteId;
    private Long processoId;
    private Long publicacaoId;
    private Long processoPrazoId;

    @Size(max = 80)
    private String origem;
}
