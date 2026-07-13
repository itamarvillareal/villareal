package br.com.vilareal.email;

import com.google.api.services.gmail.model.Message;
import com.google.api.services.gmail.model.MessagePart;
import com.google.api.services.gmail.model.MessagePartHeader;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

class GmailEmailRecebimentoUtilTest {

    @Test
    void parseDateHeader_trtPushHorarioBrasilia() {
        Instant parsed = GmailEmailRecebimentoUtil.parseDateHeader("Sun, 12 Jul 2026 21:14:05 -0300");
        assertNotNull(parsed);
        assertEquals("2026-07-13T00:14:05Z", parsed.toString());
    }

    @Test
    void extrairDataRecebimento_prefereDateHeaderQuandoMaisRecenteQueInternalDate() {
        Message message = new Message();
        // internalDate antigo (thread Gmail)
        message.setInternalDate(Instant.parse("2026-07-11T15:07:16Z").toEpochMilli());
        MessagePart payload = new MessagePart();
        payload.setHeaders(List.of(new MessagePartHeader()
                .setName("Date")
                .setValue("Sun, 12 Jul 2026 21:14:05 -0300")));
        message.setPayload(payload);

        Instant recebido = GmailEmailRecebimentoUtil.extrairDataRecebimento(message);
        assertEquals(Instant.parse("2026-07-13T00:14:05Z"), recebido);
        assertTrue(recebido.isAfter(Instant.parse("2026-07-11T15:07:16Z")));
    }
}
