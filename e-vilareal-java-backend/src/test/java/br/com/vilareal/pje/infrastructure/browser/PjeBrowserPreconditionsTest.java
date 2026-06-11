package br.com.vilareal.pje.infrastructure.browser;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PjeBrowserPreconditionsTest {

    @Test
    void detectaPaginaEnrollmentPorTextoQr() {
        String html = "<html><body><h1>Configure o aplicativo</h1><p>Escaneie o QR code</p></body></html>";
        assertThat(PjeBrowserPreconditions.contemIndicioEnrollment(html.toLowerCase())).isTrue();
    }

    @Test
    void naoConfundeOtpComEnrollmentQuandoCampoOtpPresente() {
        // Heurística de conteúdo isolada — campo OTP visível é checado no driver com Page real.
        String html = "<html><body><input name='otp' maxlength='6'/></body></html>";
        assertThat(PjeBrowserPreconditions.contemIndicioEnrollment(html.toLowerCase())).isFalse();
    }
}
