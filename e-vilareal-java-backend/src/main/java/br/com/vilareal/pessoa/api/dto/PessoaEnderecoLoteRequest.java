package br.com.vilareal.pessoa.api.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

public class PessoaEnderecoLoteRequest {

    @NotBlank
    private String origem;

    private LocalDate dataOrigem;

    @NotEmpty
    @Valid
    private List<PessoaEnderecoItemRequest> enderecos = new ArrayList<>();

    public String getOrigem() {
        return origem;
    }

    public void setOrigem(String origem) {
        this.origem = origem;
    }

    public LocalDate getDataOrigem() {
        return dataOrigem;
    }

    public void setDataOrigem(LocalDate dataOrigem) {
        this.dataOrigem = dataOrigem;
    }

    public List<PessoaEnderecoItemRequest> getEnderecos() {
        return enderecos;
    }

    public void setEnderecos(List<PessoaEnderecoItemRequest> enderecos) {
        this.enderecos = enderecos != null ? enderecos : new ArrayList<>();
    }
}
