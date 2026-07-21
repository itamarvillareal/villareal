package br.com.vilareal.pje.application;

import br.com.vilareal.pje.config.PjeBrowserProperties;
import br.com.vilareal.pje.config.PjeTrt18Properties;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PjeCopiaIntegralRetrySupportTest {

    @Test
    void ehRetentavel_timeoutPlaywrightComoNas1808() {
        String msg =
                "Error { message='Timeout 90000ms exceeded. name='TimeoutError stack='TimeoutError: Timeout 90000ms exceeded.";
        assertThat(PjeCopiaIntegralRetrySupport.ehRetentavel(msg)).isTrue();
    }

    @Test
    void ehRetentavel_roboOcupado() {
        assertThat(PjeCopiaIntegralRetrySupport.ehRetentavel("robô global ocupado; tente novamente"))
                .isTrue();
    }

    @Test
    void ehRetentavel_naoParaConfiguracao() {
        assertThat(PjeCopiaIntegralRetrySupport.ehRetentavel("Playwright desabilitado")).isFalse();
        assertThat(PjeCopiaIntegralRetrySupport.ehRetentavel("login PJe TRT18 não configurado")).isFalse();
        assertThat(PjeCopiaIntegralRetrySupport.ehRetentavel("robô PJe TRT18 em auto-freio")).isFalse();
    }

    @Test
    void pausaMaiorComProxy() {
        PjeTrt18Properties trt18 = new PjeTrt18Properties();
        trt18.setExecucaoRetryPauseMs(8_000);
        trt18.setExecucaoRetryPauseComProxyMs(15_000);

        PjeBrowserProperties browser = new PjeBrowserProperties();
        browser.setProxy("socks5://100.123.21.81:1080");

        assertThat(PjeCopiaIntegralRetrySupport.pausaEntreTentativasMs(trt18, browser)).isEqualTo(15_000L);
        browser.setProxy("");
        assertThat(PjeCopiaIntegralRetrySupport.pausaEntreTentativasMs(trt18, browser)).isEqualTo(8_000L);
    }

    @Test
    void rotuloProxy_mascaraCredenciais() {
        PjeBrowserProperties browser = new PjeBrowserProperties();
        browser.setProxy("socks5://user:secret@100.123.21.81:1080");
        assertThat(PjeCopiaIntegralRetrySupport.rotuloProxy(browser))
                .isEqualTo("ativo (100.123.21.81:1080)");
    }
}
