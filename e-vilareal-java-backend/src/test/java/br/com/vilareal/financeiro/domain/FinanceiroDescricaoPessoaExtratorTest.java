package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class FinanceiroDescricaoPessoaExtratorTest {

    @Test
    void extraiNomeECpfDePagamentoRecebido() {
        String desc =
                "Pagamento recebido - Luciana Mendonça Gomides De Carvalho - 764.677.911-34";
        FinanceiroDescricaoPessoaExtracao ext = FinanceiroDescricaoPessoaExtrator.extrair(desc, null);

        assertThat(ext.cpfDigitos()).isEqualTo("76467791134");
        assertThat(ext.nome()).contains("Luciana");
    }

    @Test
    void extraiNomeSemCpfAposTraco() {
        String desc = "Transf Pix recebida - Geny Ferreira De Morais";
        FinanceiroDescricaoPessoaExtracao ext = FinanceiroDescricaoPessoaExtrator.extrair(desc, null);

        assertThat(ext.cpfDigitos()).isNull();
        assertThat(ext.temNome()).isTrue();
        assertThat(ext.nome()).containsIgnoringCase("Geny Ferreira");
    }
}
