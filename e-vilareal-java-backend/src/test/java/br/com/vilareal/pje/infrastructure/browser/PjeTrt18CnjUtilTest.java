package br.com.vilareal.pje.infrastructure.browser;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PjeTrt18CnjUtilTest {

    @Test
    void formataNomeArquivoPdfCnj20Digitos() {
        assertThat(PjeTrt18CnjUtil.nomeArquivoPdf("5059346-36.2026.8.09.0007"))
                .isEqualTo("Processo_5059346-36.2026.8.09.0007.pdf");
    }
}
