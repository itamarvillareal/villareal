package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoPdfServiceHtmlSanitizerTest {

    @Test
    void sanitizarHtmlParaOpenPdf_converteNbspEmCaractereUnicode() {
        assertThat(DocumentoPdfService.sanitizarHtmlParaOpenPdf("a)&nbsp;texto"))
                .isEqualTo("a)\u00A0tex" + PortuguesHifenizacaoUtil.HIFEN_OPCIONAL + "to");
    }

    @Test
    void sanitizarHtmlParaOpenPdf_hifenizaJoaoNoLimiteSilabico() {
        char shy = PortuguesHifenizacaoUtil.HIFEN_OPCIONAL;
        String html = "<p class=\"qualificacao-parte\">em face de <strong>OSVALDO&nbsp;JOÃO</strong></p>";
        String out = DocumentoPdfService.sanitizarHtmlParaOpenPdf(html);
        assertThat(out).contains("JO" + shy + "ÃO");
        assertThat(out).contains("OS" + shy + "VAL" + shy + "DO\u00A0");
    }
}
