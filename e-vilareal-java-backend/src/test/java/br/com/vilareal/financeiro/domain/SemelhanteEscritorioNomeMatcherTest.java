package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class SemelhanteEscritorioNomeMatcherTest {

    @Test
    void parear_nomeParteOpostaNaDescricao_sugereBaixaConfianca() {
        var pend = List.of(new SemelhanteEscritorioMatcher.PendenteItem(
                10L,
                LocalDate.of(2026, 6, 17),
                "PIX TRANSF FRANCISCO JEFFERSON DA SILVA SOUZA 17 06",
                "pix transf francisco jefferson da silva souza 17 06",
                new BigDecimal("195.80"),
                756,
                "Sicoob"));

        var refs = List.of(new SemelhanteEscritorioNomeMatcher.PessoaProcessoRef(
                501L, "Francisco Jefferson Da Silva Souza", 99L, 1345L));
        var nomes = Map.of(501L, "Francisco Jefferson Da Silva Souza");

        var matches = SemelhanteEscritorioNomeMatcher.parear(pend, refs, nomes);

        assertThat(matches).hasSize(1);
        assertThat(matches.get(0).origem()).isEqualTo(SemelhanteEscritorioOrigem.NOME_PESSOA);
        assertThat(matches.get(0).confianca()).isEqualTo(ConfiancaSugestao.BAIXA);
        assertThat(matches.get(0).sugestaoProcessoId()).isEqualTo(1345L);
        assertThat(matches.get(0).pagadorPessoaId()).isEqualTo(501L);
    }

    @Test
    void parear_nomeAusente_naoSugere() {
        var pend = List.of(new SemelhanteEscritorioMatcher.PendenteItem(
                11L,
                LocalDate.of(2026, 6, 17),
                "PIX TRANSF OUTRA PESSOA",
                "pix transf outra pessoa",
                new BigDecimal("100.00"),
                756,
                "Sicoob"));

        var refs = List.of(new SemelhanteEscritorioNomeMatcher.PessoaProcessoRef(
                501L, "Francisco Jefferson Da Silva Souza", 99L, 1345L));
        var nomes = Map.of(501L, "Francisco Jefferson Da Silva Souza");

        assertThat(SemelhanteEscritorioNomeMatcher.parear(pend, refs, nomes)).isEmpty();
    }
}
