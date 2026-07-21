package br.com.vilareal.whatsapp;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppForwardTextUtilTest {

    @Test
    void extraiLegendaRealIgnorandoPlaceholder() {
        assertThat(WhatsAppForwardTextUtil.extrairLegendaMidia("📷 Imagem recebida", null)).isNull();
        assertThat(WhatsAppForwardTextUtil.extrairLegendaMidia("Minha legenda", null)).isEqualTo("Minha legenda");
        assertThat(WhatsAppForwardTextUtil.extrairLegendaMidia("Original", "Nova")).isEqualTo("Nova");
    }

    @Test
    void montaTextoLocalizacaoComLink() {
        String json =
                """
                {"localizacao":{"latitude":-23.5,"longitude":-46.6,"name":"Escritório"}}
                """;
        String texto = WhatsAppForwardTextUtil.montarTextoEncaminhamento(WhatsAppMessageType.LOCATION, json);
        assertThat(texto).contains("Escritório");
        assertThat(texto).contains("google.com/maps");
    }
}
