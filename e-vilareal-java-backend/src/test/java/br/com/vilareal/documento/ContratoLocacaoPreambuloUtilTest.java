package br.com.vilareal.documento;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ContratoLocacaoPreambuloUtilTest {

    @Mock
    private QualificacaoPessoaUtil qualificacaoPessoaUtil;

    @Test
    void injetarFiadoresNoPreambuloHtml_insereAntesDeTemPorJusto() {
        PessoaEntity fiador = new PessoaEntity();
        fiador.setId(99L);
        fiador.setNome("Maria Silva");
        when(qualificacaoPessoaUtil.gerarQualificacaoContratoLocacaoPorPessoaId(99L))
                .thenReturn("MARIA SILVA, brasileira");

        String preambulo =
                "Pelo presente instrumento particular, como LOCADOR, A, e, como LOCATÁRIO, B, têm por justo e contratado o seguinte:";

        String out = ContratoLocacaoPreambuloUtil.injetarFiadoresNoPreambuloHtml(
                preambulo, List.of(fiador), qualificacaoPessoaUtil);

        assertThat(out).contains("FIADORA");
        assertThat(out).contains("MARIA SILVA, brasileira");
        assertThat(out).doesNotContain("<strong>");
        assertThat(out).doesNotContain("&lt;strong");
        assertThat(out.indexOf("FIADORA")).isLessThan(out.indexOf("têm por justo"));
    }

    @Test
    void ajustarRotuloLocatarioPluralHtml_pluralizaRotulo() {
        String html = "... , e, como LOCATÁRIO, Qualificação ...";
        assertThat(ContratoLocacaoPreambuloUtil.ajustarRotuloLocatarioPluralHtml(html, 2))
                .contains("LOCATÁRIOS");
    }

    @Test
    void injetarFiadoresNoPreambuloHtml_naoDuplicaQuandoJaHaFiador() {
        String preambulo = "... como FIADOR, X, têm por justo e contratado o seguinte:";
        PessoaEntity fiador = new PessoaEntity();
        fiador.setId(1L);
        fiador.setNome("João");

        String out = ContratoLocacaoPreambuloUtil.injetarFiadoresNoPreambuloHtml(
                preambulo, List.of(fiador), qualificacaoPessoaUtil);

        assertThat(out).isEqualTo(preambulo);
    }
}
