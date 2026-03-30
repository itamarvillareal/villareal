package br.com.vilareal.importacao;

import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class DadosImportacaoLinhaTest {

    @Test
    void dedupeMantemMenorOrdemPorPoloEPessoa() {
        var a = new DadosImportacaoLinha.ParteSlot("AUTOR", 3, 10L);
        var b = new DadosImportacaoLinha.ParteSlot("AUTOR", 1, 10L);
        var c = new DadosImportacaoLinha.ParteSlot("REU", 2, 10L);
        List<DadosImportacaoLinha.ParteSlot> out =
                DadosImportacaoLinha.deduplicarPorPoloEPessoa(List.of(a, b, c));
        assertThat(out).hasSize(2);
        assertThat(out.stream().filter(p -> p.polo().equals("AUTOR")).findFirst().orElseThrow().ordem())
                .isEqualTo(1);
    }
}
