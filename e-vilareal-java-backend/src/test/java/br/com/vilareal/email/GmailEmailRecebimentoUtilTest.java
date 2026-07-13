package br.com.vilareal.email;

import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePart;
import com.google.api.services.gmail.model.MessagePartHeader;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class GmailEmailRecebimentoUtilTest {

    @Test
    void parseDateHeader_trtPushHorarioBrasilia() {
        Instant parsed = GmailEmailRecebimentoUtil.parseDateHeader("Sun, 12 Jul 2026 21:14:05 -0300");
        assertNotNull(parsed);
        assertEquals("2026-07-13T00:14:05Z", parsed.toString());
    }

    @Test
    void extrairDataRecebimento_usaInternalDateComoGmailInbox() {
        Message message = new Message();
        message.setInternalDate(Instant.parse("2026-07-13T00:14:05Z").toEpochMilli());
        MessagePart payload = new MessagePart();
        payload.setHeaders(List.of(new MessagePartHeader()
                .setName("Date")
                .setValue("Fri, 11 Jul 2026 12:07:16 -0300")));
        message.setPayload(payload);

        Instant recebido = GmailEmailRecebimentoUtil.extrairDataRecebimento(message);
        assertEquals(Instant.parse("2026-07-13T00:14:05Z"), recebido);
    }
}
