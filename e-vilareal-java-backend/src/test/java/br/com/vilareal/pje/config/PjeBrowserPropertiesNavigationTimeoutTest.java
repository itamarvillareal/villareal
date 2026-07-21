package br.com.vilareal.pje.config;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PjeBrowserPropertiesNavigationTimeoutTest {

    @Test
    void navigationTimeoutEfetivo_sobeComProxy() {
        PjeBrowserProperties props = new PjeBrowserProperties();
        props.setTimeoutMs(90_000);
        props.setProxy("socks5://100.123.21.81:1080");

        assertThat(props.navigationTimeoutEfetivoMs()).isEqualTo(120_000);
        assertThat(props.timeoutEfetivoMs()).isEqualTo(90_000);
    }

    @Test
    void navigationTimeoutEfetivo_respeitaOverrideExplicito() {
        PjeBrowserProperties props = new PjeBrowserProperties();
        props.setTimeoutMs(90_000);
        props.setNavigationTimeoutMs(150_000);
        props.setProxy("socks5://100.123.21.81:1080");

        assertThat(props.navigationTimeoutEfetivoMs()).isEqualTo(150_000);
    }

    @Test
    void navigationTimeoutEfetivo_semProxyIgualTimeoutLocators() {
        PjeBrowserProperties props = new PjeBrowserProperties();
        props.setTimeoutMs(90_000);

        assertThat(props.navigationTimeoutEfetivoMs()).isEqualTo(90_000);
    }
}
