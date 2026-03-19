package br.com.vilareal.api.exception;

public class CadastroPessoaNaoEncontradaException extends RuntimeException {

    private final Long id;

    public CadastroPessoaNaoEncontradaException(Long id) {
        super("Cadastro de pessoa não encontrado com id: " + id);
        this.id = id;
    }

    public Long getId() {
        return id;
    }
}
