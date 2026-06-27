package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static br.com.vilareal.documento.FlexaoUtil.Genero.FEMININO;
import static br.com.vilareal.documento.FlexaoUtil.Genero.MASCULINO;
import static br.com.vilareal.documento.FlexaoUtil.Numero.PLURAL;
import static br.com.vilareal.documento.FlexaoUtil.Numero.SINGULAR;
import static org.assertj.core.api.Assertions.assertThat;

class LocacaoConcordanciaReuUtilTest {

    @Test
    void injetarAdequaReuPalavrasSoltas_envolveVerboEAdjetivo() {
        String template =
                "§3º Ucase(Propercase(Adequa(\"@\",\"Reu\",\"os\"))) Adequa(\"@\",\"Reu\",\"locatário\") fica responsável.";

        String out = LocacaoConcordanciaReuUtil.injetarAdequaReuPalavrasSoltas(template);

        assertThat(out).contains("Adequa(\"@\",\"Reu\",\"fica\")");
        assertThat(out).contains("Adequa(\"@\",\"Reu\",\"responsável\")");
    }

    @Test
    void injetarAdequaReuPalavrasSoltas_preservaZonaLocador() {
        String template = "O Locador fica responsável pelas chaves. Os Locatários fica responsável pelo aluguel.";

        String out = LocacaoConcordanciaReuUtil.injetarAdequaReuPalavrasSoltas(template);

        assertThat(out).contains("O Locador fica responsável pelas chaves");
        assertThat(out).contains("Adequa(\"@\",\"Reu\",\"fica\")");
    }

    @Test
    void aplicarConcordanciaLocatarioProcessado_pluralizaVerboEAdjetivo() {
        String texto = "§3º OS Locatários fica responsável pelo pagamento.";

        String out = LocacaoConcordanciaReuUtil.aplicarConcordanciaLocatarioProcessado(texto, 2, false);

        assertThat(out).isEqualTo("§3º Os Locatários ficam responsáveis pelo pagamento.");
    }

    @Test
    void aplicarConcordanciaLocatarioProcessado_femininoPlural() {
        String texto = "As Locatárias fica responsável pelo pagamento.";

        String out = LocacaoConcordanciaReuUtil.aplicarConcordanciaLocatarioProcessado(texto, 2, true);

        assertThat(out).isEqualTo("As Locatárias ficam responsáveis pelo pagamento.");
    }

    @Test
    void flexaoUtil_ficaPlural() {
        assertThat(FlexaoUtil.adequar("fica", MASCULINO, PLURAL)).isEqualTo("ficam");
        assertThat(FlexaoUtil.adequar("responsável", MASCULINO, PLURAL)).isEqualTo("responsáveis");
        assertThat(FlexaoUtil.adequar("deve", MASCULINO, PLURAL)).isEqualTo("devem");
    }

    @Test
    void flexaoUtil_ficaSingular() {
        assertThat(FlexaoUtil.adequar("fica", MASCULINO, SINGULAR)).isEqualTo("fica");
        assertThat(FlexaoUtil.adequar("fica", FEMININO, SINGULAR)).isEqualTo("fica");
    }

    @Test
    void injetarAdequaReuPalavrasSoltas_naoFlexionaEAgudoDentroDePalavras() {
        String template =
                "aviso prévio de 30 dias. §2º Também é de responsabilidade. energia elétrica e débito. "
                        + "Dr. Itamar Alexandre Félix Villa Real Junior.";

        String out = LocacaoConcordanciaReuUtil.injetarAdequaReuPalavrasSoltas(template);

        assertThat(out).contains("aviso prévio");
        assertThat(out).contains("Também Adequa(\"@\",\"Reu\",\"é\") de responsabilidade");
        assertThat(out).contains("energia elétrica");
        assertThat(out).contains("débito");
        assertThat(out).contains("Félix");
        assertThat(out).doesNotContain("prsãovio");
        assertThat(out).doesNotContain("Tambsãom");
        assertThat(out).doesNotContain("elsãotrica");
        assertThat(out).doesNotContain("dsãobito");
        assertThat(out).doesNotContain("Fsãolix");
    }
}
