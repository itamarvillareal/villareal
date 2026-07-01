package br.com.vilareal.whatsapp;

import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.SharedContact;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.SharedContactEmail;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.SharedContactName;
import br.com.vilareal.whatsapp.dto.WhatsAppWebhookPayload.SharedContactPhone;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class WhatsAppContactCardSupportTest {

    @Test
    void toContentJson_serializaNomeETelefones() {
        SharedContact contact = new SharedContact(
                new SharedContactName("Carlos Silva", "Carlos", "Silva"),
                List.of(new SharedContactPhone("+55 62 99999-0000", "5562999990000", "CELL")),
                List.of(new SharedContactEmail("carlos@example.com", "WORK")));

        String json = WhatsAppContactCardSupport.toContentJson(List.of(contact));

        assertThat(json).contains("\"nome\":\"Carlos Silva\"");
        assertThat(json).contains("\"waId\":\"5562999990000\"");
        assertThat(json).contains("carlos@example.com");
        assertThat(WhatsAppContactCardSupport.resumoLegivel(json)).isEqualTo("Cartão de contato: Carlos Silva");
    }
}
