package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

@Schema(description = "Número WhatsApp para notificações automáticas do cliente")
public class ClienteWhatsAppItemRequest {

    private Long id;

    private Long pessoaId;

    private Long pessoaContatoId;

    @NotBlank
    @Size(max = 30)
    private String numero;

    @Size(max = 120)
    private String nomeLabel;

    private Boolean principal;

    private Boolean preenchidoAutomaticamente;

    private Boolean ativo;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getPessoaId() {
        return pessoaId;
    }

    public void setPessoaId(Long pessoaId) {
        this.pessoaId = pessoaId;
    }

    public Long getPessoaContatoId() {
        return pessoaContatoId;
    }

    public void setPessoaContatoId(Long pessoaContatoId) {
        this.pessoaContatoId = pessoaContatoId;
    }

    public String getNumero() {
        return numero;
    }

    public void setNumero(String numero) {
        this.numero = numero;
    }

    public String getNomeLabel() {
        return nomeLabel;
    }

    public void setNomeLabel(String nomeLabel) {
        this.nomeLabel = nomeLabel;
    }

    public Boolean getPrincipal() {
        return principal;
    }

    public void setPrincipal(Boolean principal) {
        this.principal = principal;
    }

    public Boolean getPreenchidoAutomaticamente() {
        return preenchidoAutomaticamente;
    }

    public void setPreenchidoAutomaticamente(Boolean preenchidoAutomaticamente) {
        this.preenchidoAutomaticamente = preenchidoAutomaticamente;
    }

    public Boolean getAtivo() {
        return ativo;
    }

    public void setAtivo(Boolean ativo) {
        this.ativo = ativo;
    }
}
