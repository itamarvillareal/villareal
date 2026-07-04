package br.com.vilareal.whatsapp;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppMediaMimeUtilTest {

    @Test
    void usaContentTypeQuandoUtilizavel() {
        var file = new MockMultipartFile("arquivo", "foto.jpg", "image/jpeg", new byte[] {1});
        assertThat(WhatsAppMediaMimeUtil.resolverMime(file, "foto.jpg")).isEqualTo("image/jpeg");
    }

    @Test
    void infereMimeDaExtensaoQuandoGenerico() {
        var file = new MockMultipartFile("arquivo", "doc.pdf", "application/octet-stream", new byte[] {1});
        assertThat(WhatsAppMediaMimeUtil.resolverMime(file, "doc.pdf")).isEqualTo("application/pdf");
    }

    @Test
    void sanitizaFilename() {
        assertThat(WhatsAppMediaMimeUtil.sanitizarFilename("  contrato final.pdf  "))
                .isEqualTo("contrato final.pdf");
    }
}
