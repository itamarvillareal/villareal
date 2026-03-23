package br.com.vilareal.api.dto;

import br.com.vilareal.api.entity.enums.TarefaOperacionalOrigem;
import br.com.vilareal.api.entity.enums.TarefaOperacionalPrioridade;
import br.com.vilareal.api.entity.enums.TarefaOperacionalStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;

public class TarefaOperacionalRequest {
    @NotBlank
    @Size(max = 500)
    private String titulo;
    private String descricao;
    private TarefaOperacionalStatus status;
    private TarefaOperacionalPrioridade prioridade;
    private TarefaOperacionalOrigem origem;
    private Long responsavelUsuarioId;
    private Long criadorUsuarioId;
    private Long clienteId;
    private Long processoId;
    private Long publicacaoId;
    private Long agendaEventoId;
    private Long processoPrazoId;
    private LocalDate dataLimite;
    private String observacaoConclusao;

    public String getTitulo() { return titulo; }
    public void setTitulo(String titulo) { this.titulo = titulo; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public TarefaOperacionalStatus getStatus() { return status; }
    public void setStatus(TarefaOperacionalStatus status) { this.status = status; }
    public TarefaOperacionalPrioridade getPrioridade() { return prioridade; }
    public void setPrioridade(TarefaOperacionalPrioridade prioridade) { this.prioridade = prioridade; }
    public TarefaOperacionalOrigem getOrigem() { return origem; }
    public void setOrigem(TarefaOperacionalOrigem origem) { this.origem = origem; }
    public Long getResponsavelUsuarioId() { return responsavelUsuarioId; }
    public void setResponsavelUsuarioId(Long responsavelUsuarioId) { this.responsavelUsuarioId = responsavelUsuarioId; }
    public Long getCriadorUsuarioId() { return criadorUsuarioId; }
    public void setCriadorUsuarioId(Long criadorUsuarioId) { this.criadorUsuarioId = criadorUsuarioId; }
    public Long getClienteId() { return clienteId; }
    public void setClienteId(Long clienteId) { this.clienteId = clienteId; }
    public Long getProcessoId() { return processoId; }
    public void setProcessoId(Long processoId) { this.processoId = processoId; }
    public Long getPublicacaoId() { return publicacaoId; }
    public void setPublicacaoId(Long publicacaoId) { this.publicacaoId = publicacaoId; }
    public Long getAgendaEventoId() { return agendaEventoId; }
    public void setAgendaEventoId(Long agendaEventoId) { this.agendaEventoId = agendaEventoId; }
    public Long getProcessoPrazoId() { return processoPrazoId; }
    public void setProcessoPrazoId(Long processoPrazoId) { this.processoPrazoId = processoPrazoId; }
    public LocalDate getDataLimite() { return dataLimite; }
    public void setDataLimite(LocalDate dataLimite) { this.dataLimite = dataLimite; }
    public String getObservacaoConclusao() { return observacaoConclusao; }
    public void setObservacaoConclusao(String observacaoConclusao) { this.observacaoConclusao = observacaoConclusao; }
}
