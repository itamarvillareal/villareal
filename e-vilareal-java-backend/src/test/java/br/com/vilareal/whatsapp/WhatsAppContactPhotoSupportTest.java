package br.com.vilareal.whatsapp;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppContactPhotoSupportTest {

    @Test
    void proxyUrl_montaCaminhoRelativo() {
        assertThat(WhatsAppContactPhotoSupport.proxyUrl("5562983452868"))
                .isEqualTo("/api/whatsapp/conversations/5562983452868/photo");
    }

    @Test
    void proxyUrl_nullParaTelefoneVazio() {
        assertThat(WhatsAppContactPhotoSupport.proxyUrl(null)).isNull();
        assertThat(WhatsAppContactPhotoSupport.proxyUrl("  ")).isNull();
    }
}
