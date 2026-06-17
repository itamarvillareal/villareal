package br.com.vilareal.processo.application;

import java.text.Normalizer;
import java.util.Locale;

/** Critérios de fase para relatórios em Diagnósticos (alinhado ao front {@code processosHistoricoData.js}). */
public final class FaseProcessualDiagnosticoUtil {

    private FaseProcessualDiagnosticoUtil() {}

    public static boolean emFaseAguardandoProtocolo(String fase) {
        String s = fase == null ? "" : fase.trim();
        if (s.isEmpty()) {
            return false;
        }
        if ("Protocolo / Movimentação".equals(s)) {
            return true;
        }
        String t = normalizarTexto(s);
        if (t.contains("aguardando") && t.contains("protoc")) {
            return true;
        }
        String c = t.replaceAll("[^a-z0-9]", "");
        return c.contains("protoc") && c.contains("moviment");
    }

    private static String normalizarTexto(String raw) {
        String nfd = Normalizer.normalize(raw, Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{M}+", "").toLowerCase(Locale.ROOT).trim();
    }
}
