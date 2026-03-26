package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.time.Instant;

@Schema(description = "Contato (ModalContatos)")
public class PessoaContatoItemRequest {

    @NotBlank
    @Pattern(regexp = "^(email|telefone|website)$")
    private String tipo;

    @NotBlank
    @Size(max = 500)
    private String valor;

    private Instant dataLancamento;
    private Instant dataAlteracao;

    @NotBlank
    @Size(max = 120)
    private String usuario;

    public String getTipo() {
        return tipo;
    }

    public void setTipo(String tipo) {
        this.tipo = tipo;
    }

    public String getValor() {
        return valor;
    }

    public void setValor(String valor) {
        this.valor = valor;
    }

    public Instant getDataLancamento() {
        return dataLancamento;
    }

    public void setDataLancamento(Instant dataLancamento) {
        this.dataLancamento = dataLancamento;
    }

    public Instant getDataAlteracao() {
        return dataAlteracao;
    }

    public void setDataAlteracao(Instant dataAlteracao) {
        this.dataAlteracao = dataAlteracao;
    }

    public String getUsuario() {
        return usuario;
    }

    public void setUsuario(String usuario) {
        this.usuario = usuario;
    }
}
