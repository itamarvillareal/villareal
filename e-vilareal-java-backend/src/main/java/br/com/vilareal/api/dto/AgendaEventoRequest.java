package br.com.vilareal.api.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.time.LocalTime;

public class AgendaEventoRequest {
    @NotNull
    private Long usuarioId;

    @NotNull
    private LocalDate dataEvento;

    private LocalTime horaEvento;

    @NotBlank
    private String descricao;

    private String statusCurto;
    private String processoRef;
    private String origem;

    public Long getUsuarioId() { return usuarioId; }
    public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }
    public LocalDate getDataEvento() { return dataEvento; }
    public void setDataEvento(LocalDate dataEvento) { this.dataEvento = dataEvento; }
    public LocalTime getHoraEvento() { return horaEvento; }
    public void setHoraEvento(LocalTime horaEvento) { this.horaEvento = horaEvento; }
    public String getDescricao() { return descricao; }
    public void setDescricao(String descricao) { this.descricao = descricao; }
    public String getStatusCurto() { return statusCurto; }
    public void setStatusCurto(String statusCurto) { this.statusCurto = statusCurto; }
    public String getProcessoRef() { return processoRef; }
    public void setProcessoRef(String processoRef) { this.processoRef = processoRef; }
    public String getOrigem() { return origem; }
    public void setOrigem(String origem) { this.origem = origem; }
}
