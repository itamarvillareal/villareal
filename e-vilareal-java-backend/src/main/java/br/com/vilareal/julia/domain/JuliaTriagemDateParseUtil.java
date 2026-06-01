package br.com.vilareal.julia.domain;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;

/** Parse tolerante de datas vindas da resposta JSON da Júlia (ISO ou dd/MM/yyyy). */
public final class JuliaTriagemDateParseUtil {

    private static final DateTimeFormatter FMT_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private JuliaTriagemDateParseUtil() {}

    /**
     * Tenta {@code AAAA-MM-DD} (ISO) e depois {@code dd/MM/yyyy}. Retorna {@code null} se inválido —
     * a triagem segue sem prazo, sem derrubar o processo.
     */
    public static LocalDate parseDataResposta(String raw) {
        if (raw == null) {
            return null;
        }
        String s = raw.trim();
        if (s.isEmpty()) {
            return null;
        }
        try {
            return LocalDate.parse(s);
        } catch (DateTimeParseException ignored) {
            /* tenta BR abaixo */
        }
        try {
            return LocalDate.parse(s, FMT_BR);
        } catch (DateTimeParseException ignored) {
            return null;
        }
    }
}
