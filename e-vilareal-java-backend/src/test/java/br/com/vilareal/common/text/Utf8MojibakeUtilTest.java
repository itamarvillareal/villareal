package br.com.vilareal.common.text;

import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

class Utf8MojibakeUtilTest {

    @Test
    void nuloEVazio() {
        assertNull(Utf8MojibakeUtil.corrigir(null));
        assertEquals("", Utf8MojibakeUtil.corrigir(""));
    }

    @Test
    void utf8LidoComoLatin1EAcute() {
        byte[] utf8 = "INQUÉRITO 2762012".getBytes(StandardCharsets.UTF_8);
        String mojibake = new String(utf8, StandardCharsets.ISO_8859_1);
        assertEquals("INQUÉRITO 2762012", Utf8MojibakeUtil.corrigir(mojibake));
    }

    @Test
    void textoCorretoPermanece() {
        assertEquals("Processo sem acento", Utf8MojibakeUtil.corrigir("Processo sem acento"));
        assertEquals("São Paulo", Utf8MojibakeUtil.corrigir("São Paulo"));
    }

    @Test
    void utf8DuplaCamadaComCaracteresBoxDrawing() {
        String original = "1ª TURMA JULGADORA MISTA DA 3ª REGIÃO";
        byte[] utf8 = original.getBytes(StandardCharsets.UTF_8);
        String camada1 = new String(utf8, StandardCharsets.ISO_8859_1);
        byte[] utf8Novamente = camada1.getBytes(StandardCharsets.UTF_8);
        String camada2 = new String(utf8Novamente, StandardCharsets.UTF_8);
        assertEquals(original, Utf8MojibakeUtil.corrigir(camada2));
    }

    @Test
    void observacaoComCedilhaDuplaCamada() {
        String original = "INDENIZAÇÃO DANO MORAL C/C REPETIÇÃO INDÉBITO";
        byte[] utf8 = original.getBytes(StandardCharsets.UTF_8);
        String camada1 = new String(utf8, StandardCharsets.ISO_8859_1);
        String camada2 = new String(camada1.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
        assertEquals(original, Utf8MojibakeUtil.corrigir(camada2));
    }

    @Test
    void triplaCodificacaoUtf8() {
        String original = "COMPETÊNCIA TESTE";
        String c = original;
        for (int i = 0; i < 3; i++) {
            c = new String(c.getBytes(StandardCharsets.UTF_8), StandardCharsets.ISO_8859_1);
            c = new String(c.getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
        }
        assertEquals(original, Utf8MojibakeUtil.corrigir(c));
    }

    /**
     * Mojibake em duas+ camadas costuma ficar só com caracteres U+00FF; o loop de reversão não pode
     * abortar só por {@code latin1Somente}.
     */
    @Test
    void competenciaDuasCamadasSoLatin1() {
        String original = "2ª VARA DE FAMÍLIA E SUCESSÕES";
        String c = original;
        for (int i = 0; i < 2; i++) {
            byte[] u = c.getBytes(StandardCharsets.UTF_8);
            c = new String(new String(u, StandardCharsets.ISO_8859_1).getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
        }
        assertEquals(original, Utf8MojibakeUtil.corrigir(c));
    }

    @Test
    void observacaoTresCamadasSoLatin1() {
        String original = "EXECUÇÃO DE PENSÃO";
        String c = original;
        for (int i = 0; i < 3; i++) {
            byte[] u = c.getBytes(StandardCharsets.UTF_8);
            c = new String(new String(u, StandardCharsets.ISO_8859_1).getBytes(StandardCharsets.UTF_8), StandardCharsets.UTF_8);
        }
        assertEquals(original, Utf8MojibakeUtil.corrigir(c));
    }

    /** Texto real da API/BD: UTF-8 válido com U+251C (├), irreversível só com Latin-1 em cadeia. */
    @Test
    void execucaoDePensaoComBlocoDesenhoU251c() {
        String corrupto = "EXECU\u251c\u00e2\u00d4\u00c7\u00ed\u251c\u00e2\u00e3\u00c6O DE PENS\u251c\u00e2\u00e3\u00c6O";
        assertEquals("EXECUÇÃO DE PENSÃO", Utf8MojibakeUtil.corrigir(corrupto));
    }

    @Test
    void competenciaOrdinalFemininoBlocoDesenho() {
        String corrupto = "1\u251c\u00e9\u252c\u00ac TURMA JULGADORA MISTA DA 3\u251c\u00e9\u252c\u00ac REGI\u00c3O";
        assertEquals("1ª TURMA JULGADORA MISTA DA 3ª REGIÃO", Utf8MojibakeUtil.corrigir(corrupto));
    }

    @Test
    void observacaoIndebitoComEAgudoMaiusculo() {
        String corrupto =
                "INDENIZA\u00c7\u00c3O DANO MORAL C/C REPETI\u00c7\u00c3O IND\u251c\u00e2\u00d4\u00c7\u2019BITO";
        assertEquals("INDENIZAÇÃO DANO MORAL C/C REPETIÇÃO INDÉBITO", Utf8MojibakeUtil.corrigir(corrupto));
    }

    @Test
    void indebitoComUltimoByteComoU2591() {
        String corrupto =
                "INDENIZA\u00c7\u00c3O DANO MORAL C/C REPETI\u00c7\u00c3O IND\u251c\u00e2\u00d4\u00c7\u2591BITO";
        assertEquals("INDENIZAÇÃO DANO MORAL C/C REPETIÇÃO INDÉBITO", Utf8MojibakeUtil.corrigir(corrupto));
    }
}
