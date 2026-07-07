package br.com.vilareal.processo.application;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DiagnosticoAguardandoProtocoloAssinarServiceTest {

    @Test
    void isNomeCanonicoStorePdf_reconheceCopiasDoBackend() {
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_1_14f46e51.pdf"))
                .isTrue();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf(" 119_12_14F46E51.pdf "))
                .isTrue();
    }

    @Test
    void isNomeCanonicoStorePdf_preservaNomesOriginaisDoUsuario() {
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("Petição.pdf"))
                .isFalse();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("Cálculo.pdf"))
                .isFalse();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_peticao.pdf"))
                .isFalse();
        assertThat(DiagnosticoAguardandoProtocoloAssinarService.isNomeCanonicoStorePdf("119_1_sha8.pdf"))
                .isFalse();
    }
}
