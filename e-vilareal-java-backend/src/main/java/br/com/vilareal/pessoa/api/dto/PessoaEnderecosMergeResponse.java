package br.com.vilareal.pessoa.api.dto;

import java.util.ArrayList;
import java.util.List;

public class PessoaEnderecosMergeResponse {

    private List<PessoaEnderecoItemResponse> enderecos = new ArrayList<>();
    private List<String> avisos = new ArrayList<>();

    public List<PessoaEnderecoItemResponse> getEnderecos() {
        return enderecos;
    }

    public void setEnderecos(List<PessoaEnderecoItemResponse> enderecos) {
        this.enderecos = enderecos != null ? enderecos : new ArrayList<>();
    }

    public List<String> getAvisos() {
        return avisos;
    }

    public void setAvisos(List<String> avisos) {
        this.avisos = avisos != null ? avisos : new ArrayList<>();
    }
}
