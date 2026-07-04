package br.com.vilareal.whatsapp.service;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

class WhatsAppMediaServiceNomeDeterministicoTest {

    @Test
    void mesmoMediaIdGeraMesmoNome() {
        String a = WhatsAppMediaService.montarNomeArquivoDeterministico("12345", "imagem.jpg", "image/jpeg");
        String b = WhatsAppMediaService.montarNomeArquivoDeterministico("12345", "imagem.jpg", "image/jpeg");
        assertEquals(a, b);
        assertEquals("12345_imagem.jpg", a);
    }

    @Test
    void semFilenameUsaExtensaoDoMime() {
        String nome = WhatsAppMediaService.montarNomeArquivoDeterministico("abc", null, "audio/ogg; codecs=opus");
        assertEquals("abc_arquivo.ogg", nome);
    }

    @Test
    void sanitizaCaracteresInvalidosNoFilename() {
        String nome = WhatsAppMediaService.montarNomeArquivoDeterministico(
                "mid1", "relatório/financeiro:2024?.pdf", "application/pdf");
        assertFalse(nome.contains("/"));
        assertFalse(nome.contains(":"));
        assertFalse(nome.contains("?"));
        assertTrue(nome.endsWith(".pdf"));
        assertTrue(nome.startsWith("mid1_"));
    }
}
