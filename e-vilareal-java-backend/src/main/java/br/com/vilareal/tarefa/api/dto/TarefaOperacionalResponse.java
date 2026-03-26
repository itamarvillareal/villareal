package br.com.vilareal.tarefa.api.dto;

import br.com.vilareal.tarefa.model.TarefaPrioridade;
import br.com.vilareal.tarefa.model.TarefaStatus;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.time.LocalDate;

/**
 * Contrato JSON alinhado ao React ({@code tarefasBoardAdapter.js} / Pendências).
 */
@Getter
@Setter
public class TarefaOperacionalResponse {

    private Long id;
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
    private String origem;
    private Instant createdAt;
    private Instant dataConclusao;
}
