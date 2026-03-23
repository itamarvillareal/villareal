package br.com.vilareal.api.dto;

public class PublicacaoVinculoProcessoPatchRequest {
    private Long processoId;
    private Long usuarioId;
    private String observacao;

    public Long getProcessoId() { return processoId; }
    public void setProcessoId(Long processoId) { this.processoId = processoId; }
    public Long getUsuarioId() { return usuarioId; }
    public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
}
