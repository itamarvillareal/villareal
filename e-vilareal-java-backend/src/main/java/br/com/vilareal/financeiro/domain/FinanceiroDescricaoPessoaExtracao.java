package br.com.vilareal.financeiro.domain;

/**
 * Nome e CPF extraídos da descrição de um lançamento (ex.: PIX / pagamento recebido).
 */
public record FinanceiroDescricaoPessoaExtracao(String cpfDigitos, String nome) {

    public boolean temCpf() {
        return cpfDigitos != null && cpfDigitos.length() == 11;
    }

    public boolean temNome() {
        return nome != null && nome.trim().length() >= 3;
    }
}
