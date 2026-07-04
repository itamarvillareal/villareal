package br.com.vilareal.whatsapp;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;

class WhatsAppMediaRangeSupportTest {

    @Test
    void semRangeRetornaCorpoCompleto() {
        assertInstanceOf(
                WhatsAppMediaRangeSupport.Decision.FullBody.class,
                WhatsAppMediaRangeSupport.interpretar(null, 5000));
    }

    @Test
    void multiplosRangesRetornaCorpoCompleto() {
        assertInstanceOf(
                WhatsAppMediaRangeSupport.Decision.FullBody.class,
                WhatsAppMediaRangeSupport.interpretar("bytes=0-10,20-30", 5000));
    }

    @Test
    void rangeParcialValido() {
        var decision = WhatsAppMediaRangeSupport.interpretar("bytes=0-1023", 5000);
        assertInstanceOf(WhatsAppMediaRangeSupport.Decision.Partial.class, decision);
        var partial = (WhatsAppMediaRangeSupport.Decision.Partial) decision;
        assertEquals(0, partial.start());
        assertEquals(1023, partial.end());
    }

    @Test
    void rangeStartSemEnd() {
        var decision = WhatsAppMediaRangeSupport.interpretar("bytes=100-", 500);
        assertInstanceOf(WhatsAppMediaRangeSupport.Decision.Partial.class, decision);
        var partial = (WhatsAppMediaRangeSupport.Decision.Partial) decision;
        assertEquals(100, partial.start());
        assertEquals(499, partial.end());
    }

    @Test
    void rangeForaDoLimiteRetorna416() {
        assertInstanceOf(
                WhatsAppMediaRangeSupport.Decision.Unsatisfiable.class,
                WhatsAppMediaRangeSupport.interpretar("bytes=600-700", 500));
    }
}
