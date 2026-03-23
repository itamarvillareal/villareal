package br.com.vilareal.api.dto;

import br.com.vilareal.api.entity.enums.PublicacaoStatusTratamento;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public class PublicacaoStatusPatchRequest {
    @NotNull
    private PublicacaoStatusTratamento status;
    @Size(max = 500)
    private String observacao;
    private Long usuarioId;

    public PublicacaoStatusTratamento getStatus() { return status; }
    public void setStatus(PublicacaoStatusTratamento status) { this.status = status; }
    public String getObservacao() { return observacao; }
    public void setObservacao(String observacao) { this.observacao = observacao; }
    public Long getUsuarioId() { return usuarioId; }
    public void setUsuarioId(Long usuarioId) { this.usuarioId = usuarioId; }
}
