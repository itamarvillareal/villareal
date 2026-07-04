package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.LocationContent;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppLocationSupportTest {

    @Test
    void toContentJson_serializaLatLongENome() {
        LocationContent location = new LocationContent(-16.686891, -49.264794, "Shopping Center", "Av. Principal");

        String json = WhatsAppLocationSupport.toContentJson(location);

        assertThat(json).contains("\"localizacao\"");
        assertThat(json).contains("\"latitude\":-16.686891");
        assertThat(json).contains("\"longitude\":-49.264794");
        assertThat(json).contains("\"name\":\"Shopping Center\"");
        assertThat(json).contains("\"address\":\"Av. Principal\"");
        assertThat(WhatsAppLocationSupport.resumoLegivel(json)).isEqualTo("📍 Shopping Center");
    }

    @Test
    void toContentJson_semNome_retornaResumoGenerico() {
        LocationContent location = new LocationContent(-16.68, -49.26, null, null);

        String json = WhatsAppLocationSupport.toContentJson(location);

        assertThat(json).isNotNull();
        assertThat(WhatsAppLocationSupport.resumoLegivel(json)).isEqualTo("📍 Localização");
    }

    @Test
    void toContentJson_semCoordenadas_retornaNull() {
        assertThat(WhatsAppLocationSupport.toContentJson(null)).isNull();
        assertThat(WhatsAppLocationSupport.toContentJson(new LocationContent(null, -49.26, "X", null)))
                .isNull();
    }

    @Test
    void resumoLegivel_jsonInvalido_degrada() {
        assertThat(WhatsAppLocationSupport.resumoLegivel("{")).isEqualTo("📍 Localização");
        assertThat(WhatsAppLocationSupport.resumoLegivel(null)).isEqualTo("📍 Localização");
    }
}
