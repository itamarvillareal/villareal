package br.com.vilareal.pessoa.api.dto;

import java.util.ArrayList;
import java.util.List;

public class PessoaEnderecoLoteResponse {

    private int inseridos;
    private int ignorados;
    private List<PessoaEnderecoItemResponse> enderecos = new ArrayList<>();

    public int getInseridos() {
        return inseridos;
    }

    public void setInseridos(int inseridos) {
        this.inseridos = inseridos;
    }

    public int getIgnorados() {
        return ignorados;
    }

    public void setIgnorados(int ignorados) {
        this.ignorados = ignorados;
    }

    public List<PessoaEnderecoItemResponse> getEnderecos() {
        return enderecos;
    }

    public void setEnderecos(List<PessoaEnderecoItemResponse> enderecos) {
        this.enderecos = enderecos != null ? enderecos : new ArrayList<>();
    }
}
