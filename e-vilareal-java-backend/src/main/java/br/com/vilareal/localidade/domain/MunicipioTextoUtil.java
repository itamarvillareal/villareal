package br.com.vilareal.localidade.domain;

import java.text.Normalizer;
import java.util.Locale;

public final class MunicipioTextoUtil {

    private MunicipioTextoUtil() {}

    public static String normalizarNome(String texto) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        String n = Normalizer.normalize(texto.trim().toUpperCase(Locale.ROOT), Normalizer.Form.NFD);
        return n.replaceAll("\\p{M}+", "").replaceAll("\\s+", " ").trim();
    }

    public static String normalizarUf(String uf) {
        if (uf == null || uf.isBlank()) {
            return null;
        }
        String u = uf.trim().toUpperCase(Locale.ROOT);
        return u.length() > 2 ? u.substring(0, 2) : u;
    }
}
