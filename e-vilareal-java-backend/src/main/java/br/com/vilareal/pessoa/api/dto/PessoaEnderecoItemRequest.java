package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

@Schema(description = "Endereço (ModalEnderecos)")
public class PessoaEnderecoItemRequest {

    @NotNull
    private Integer numero;

    @NotBlank
    @Size(max = 255)
    private String rua;

    @Size(max = 120)
    private String bairro;

    @Size(max = 2)
    private String estado;

    @Size(max = 120)
    private String cidade;

    @Size(max = 8)
    private String cep;

    private Boolean autoPreenchido = false;

    public Integer getNumero() {
        return numero;
    }

    public void setNumero(Integer numero) {
        this.numero = numero;
    }

    public String getRua() {
        return rua;
    }

    public void setRua(String rua) {
        this.rua = rua;
    }

    public String getBairro() {
        return bairro;
    }

    public void setBairro(String bairro) {
        this.bairro = bairro;
    }

    public String getEstado() {
        return estado;
    }

    public void setEstado(String estado) {
        this.estado = estado;
    }

    public String getCidade() {
        return cidade;
    }

    public void setCidade(String cidade) {
        this.cidade = cidade;
    }

    public String getCep() {
        return cep;
    }

    public void setCep(String cep) {
        this.cep = cep;
    }

    public Boolean getAutoPreenchido() {
        return autoPreenchido;
    }

    public void setAutoPreenchido(Boolean autoPreenchido) {
        this.autoPreenchido = autoPreenchido;
    }
}
