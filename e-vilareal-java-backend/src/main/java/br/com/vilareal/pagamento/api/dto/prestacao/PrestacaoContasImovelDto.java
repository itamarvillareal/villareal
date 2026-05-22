package br.com.vilareal.pagamento.api.dto.prestacao;

public class PrestacaoContasImovelDto {

    private Long id;
    private String numeroPlanilha;
    private String endereco;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getNumeroPlanilha() {
        return numeroPlanilha;
    }

    public void setNumeroPlanilha(String numeroPlanilha) {
        this.numeroPlanilha = numeroPlanilha;
    }

    public String getEndereco() {
        return endereco;
    }

    public void setEndereco(String endereco) {
        this.endereco = endereco;
    }
}
