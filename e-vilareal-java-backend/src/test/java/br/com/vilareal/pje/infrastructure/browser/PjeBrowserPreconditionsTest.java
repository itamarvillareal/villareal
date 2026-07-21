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

    @Test
    void detectaHttp401NoConteudo() {
        var msg = PjeBrowserPreconditions.mensagemErroAutenticacao(
                "<html>JBWEB000065: HTTP Status 401 - requires HTTP authentication</html>");
        assertThat(msg).isPresent();
        assertThat(msg.get()).contains("HTTP 401");
    }

    @Test
    void detectaCredencialInvalidaKeycloak() {
        var msg = PjeBrowserPreconditions.mensagemErroAutenticacao(
                "<html><span>Invalid username or password</span></html>");
        assertThat(msg).isPresent();
        assertThat(msg.get()).contains("Credenciais rejeitadas");
    }
}
