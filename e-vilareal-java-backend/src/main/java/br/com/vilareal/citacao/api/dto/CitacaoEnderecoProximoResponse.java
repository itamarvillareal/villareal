package br.com.vilareal.citacao.api.dto;

import br.com.vilareal.pessoa.api.dto.PessoaEnderecoItemResponse;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class CitacaoEnderecoProximoResponse {

    private Long pessoaEnderecoId;
    private Integer numeroOrdem;
    private PessoaEnderecoItemResponse endereco;
    private String enderecoFormatado;

    public Long getPessoaEnderecoId() {
        return pessoaEnderecoId;
    }

    public void setPessoaEnderecoId(Long pessoaEnderecoId) {
        this.pessoaEnderecoId = pessoaEnderecoId;
    }

    public Integer getNumeroOrdem() {
        return numeroOrdem;
    }

    public void setNumeroOrdem(Integer numeroOrdem) {
        this.numeroOrdem = numeroOrdem;
    }

    public PessoaEnderecoItemResponse getEndereco() {
        return endereco;
    }

    public void setEndereco(PessoaEnderecoItemResponse endereco) {
        this.endereco = endereco;
    }

    public String getEnderecoFormatado() {
        return enderecoFormatado;
    }

    public void setEnderecoFormatado(String enderecoFormatado) {
        this.enderecoFormatado = enderecoFormatado;
    }
}
