package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DocumentoPdfServiceHtmlSanitizerTest {

    @Test
    void sanitizarHtmlParaOpenPdf_converteNbspEmCaractereUnicode() {
        assertThat(DocumentoPdfService.sanitizarHtmlParaOpenPdf("a)&nbsp;texto"))
                .isEqualTo("a)\u00A0texto");
    }

    @Test
    void sanitizarHtmlParaOpenPdf_preservaHtmlValido() {
        assertThat(DocumentoPdfService.sanitizarHtmlParaOpenPdf("<p>ok</p>")).isEqualTo("<p>ok</p>");
    }
}
