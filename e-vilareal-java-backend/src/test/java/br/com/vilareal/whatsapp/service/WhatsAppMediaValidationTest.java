package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppMediaProperties;
import br.com.vilareal.whatsapp.WhatsAppMediaCategory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class WhatsAppMediaValidationTest {

    private WhatsAppMediaValidation validation;

    @BeforeEach
    void setUp() {
        validation = new WhatsAppMediaValidation(new WhatsAppMediaProperties());
    }

    @Test
    void aceitaImagemDentroDoLimite() {
        var result = validation.validar("image/jpeg", 1024);
        assertThat(result.category()).isEqualTo(WhatsAppMediaCategory.IMAGE);
        assertThat(result.normalizedMime()).isEqualTo("image/jpeg");
    }

    @Test
    void rejeitaImagemAcimaDoLimite() {
        assertThatThrownBy(() -> validation.validar("image/png", 6L * 1024 * 1024))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("excede o limite");
    }

    @Test
    void mimeDesconhecidoCaiEmDocument() {
        var result = validation.validar("application/pdf", 1024);
        assertThat(result.category()).isEqualTo(WhatsAppMediaCategory.DOCUMENT);
    }

    @Test
    void rejeitaMimeProibido() {
        assertThatThrownBy(() -> validation.validar("application/x-msdownload", 100))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessageContaining("não permitido");
    }

    @Test
    void normalizaMimeComCharset() {
        var result = validation.validar("image/jpeg; charset=binary", 100);
        assertThat(result.normalizedMime()).isEqualTo("image/jpeg");
    }
}
