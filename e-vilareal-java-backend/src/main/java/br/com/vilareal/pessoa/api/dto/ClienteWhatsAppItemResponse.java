package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

import java.time.Instant;

@Schema(description = "Número WhatsApp cadastrado para notificações do cliente")
public class ClienteWhatsAppItemResponse {

    private Long id;
    private Long clienteId;
    private Long pessoaId;
    private Long pessoaContatoId;
    private String numero;
    private String nomeLabel;
    private boolean principal;
    private boolean preenchidoAutomaticamente;
    private boolean ativo;
    private Instant createdAt;
    private Instant updatedAt;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public Long getClienteId() {
        return clienteId;
    }

    public void setClienteId(Long clienteId) {
        this.clienteId = clienteId;
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

    public boolean isPrincipal() {
        return principal;
    }

    public void setPrincipal(boolean principal) {
        this.principal = principal;
    }

    public boolean isPreenchidoAutomaticamente() {
        return preenchidoAutomaticamente;
    }

    public void setPreenchidoAutomaticamente(boolean preenchidoAutomaticamente) {
        this.preenchidoAutomaticamente = preenchidoAutomaticamente;
    }

    public boolean isAtivo() {
        return ativo;
    }

    public void setAtivo(boolean ativo) {
        this.ativo = ativo;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(Instant createdAt) {
        this.createdAt = createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(Instant updatedAt) {
        this.updatedAt = updatedAt;
    }
}
