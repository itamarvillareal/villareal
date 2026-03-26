package br.com.vilareal.pessoa.api.dto;

import io.swagger.v3.oas.annotations.media.Schema;

@Schema(description = "Endereço persistido")
public class PessoaEnderecoItemResponse {

    private Long id;
    private Integer numero;
    private String rua;
    private String bairro;
    private String estado;
    private String cidade;
    private String cep;
    private Boolean autoPreenchido;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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
