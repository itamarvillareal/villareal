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

    @Test
    void removerRequalificacaoLocadorDuplicada_retiraLocadorRepetidoAntesDeTemPorJusto() {
        String qualVrv =
                "VRV SOLUÇÕES LTDA, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 39.720.563/0001-90, "
                        + "com sede na Avenida Pinheiro Chagas, 232, nº 1, Jundiaí, cidade de Anápolis, estado de Goiás, "
                        + "CEP 75.110-580";
        String qualCarlos =
                "Carlos Ricardo de Carvalho Reimer, brasileiro, solteiro, portador do CPF nº 000.000.000-00";
        String qualMarcus =
                "MARCUS ANTONIO CARDOSO ANACLETO, brasileiro, solteiro, portador do CPF nº 111.111.111-11, "
                        + "telefone nº (62)98495-2521";

        String preambulo =
                "Pelo presente instrumento particular, como LOCADORA, "
                        + qualVrv
                        + ", e, como LOCATÁRIOS, "
                        + qualCarlos
                        + ", e "
                        + qualMarcus
                        + ", e Vrv Soluções Ltda, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº 39.720.563/0001-90, "
                        + "com sede na Avenida Pinheiro Chagas, 232, nº 1, Jundiaí, cidade de Anápolis, estado de Goiás, "
                        + "CEP 75.110-580, têm por justo e contratado o seguinte:";

        String out = ContratoLocacaoPreambuloUtil.removerRequalificacaoLocadorDuplicada(preambulo);

        assertThat(out).contains("como LOCADORA, " + qualVrv);
        assertThat(out).contains(qualMarcus);
        assertThat(out).doesNotContain("39.720.563/0001-90, têm por justo");
        assertThat(out).contains(qualMarcus + ", têm por justo e contratado o seguinte:");
        assertThat(out).doesNotContain(", e Vrv Soluções Ltda");
    }
}
