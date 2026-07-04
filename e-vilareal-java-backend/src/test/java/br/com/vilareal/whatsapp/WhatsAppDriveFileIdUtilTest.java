package br.com.vilareal.whatsapp;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class WhatsAppDriveFileIdUtilTest {

    @Test
    void extraiFileIdDePathPadrao() {
        assertEquals(
                "1AbCdEfGhIjKlMnOp",
                WhatsAppDriveFileIdUtil.extrairFileIdDeWebViewLink(
                        "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=drivesdk"));
    }

    @Test
    void extraiFileIdDeQueryId() {
        assertEquals(
                "xyz123",
                WhatsAppDriveFileIdUtil.extrairFileIdDeWebViewLink("https://drive.google.com/open?id=xyz123"));
    }

    @Test
    void resolverFileIdPriorizaColuna() {
        assertEquals(
                "coluna-id",
                WhatsAppDriveFileIdUtil.resolverFileId(
                        "coluna-id", "https://drive.google.com/file/d/outro-id/view"));
    }

    @Test
    void retornaNullQuandoLinkInvalido() {
        assertNull(WhatsAppDriveFileIdUtil.extrairFileIdDeWebViewLink("https://example.com/doc"));
        assertNull(WhatsAppDriveFileIdUtil.extrairFileIdDeWebViewLink(null));
    }
}
