package br.com.vilareal.documento.tema;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TemaDocumentoTest {

    @Test
    void padrao_temValoresVillaReal() {
        TemaDocumento padrao = TemaDocumento.padrao();

        assertThat(padrao.id()).isEqualTo(TemaDocumento.ID_PADRAO);
        assertThat(padrao.advogadoNomeEfetivo()).contains("Itamar");
        assertThat(padrao.advogadoOabEfetivo()).isEqualTo("OAB/GO 33.329");
        assertThat(padrao.logoCabecalhoPathEfetivo()).endsWith("logo_cabecalho.jpeg");
        assertThat(padrao.logoCabecalhoBase64Efetivo()).isNull();
    }

    @Test
    void personalizado_podeSobrescreverLogoBase64() {
        TemaDocumento tema = TemaDocumento.personalizado(
                "usuario.karla",
                null,
                "data:image/png;base64,abc",
                null,
                null,
                "Dra. Karla",
                "OAB/GO 12.345");

        assertThat(tema.logoCabecalhoBase64Efetivo()).isEqualTo("data:image/png;base64,abc");
        assertThat(tema.advogadoNomeEfetivo()).isEqualTo("Dra. Karla");
    }
}
