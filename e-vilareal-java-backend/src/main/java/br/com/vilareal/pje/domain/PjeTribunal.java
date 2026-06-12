package br.com.vilareal.pje.domain;

import java.util.Locale;
import java.util.Optional;

/**
 * Tribunal PJe registrado no processo. Automação de cópia integral disponível hoje só em {@link #PJE_TRT18}.
 */
public enum PjeTribunal {
    PJE_TRT1,
    PJE_TRT2,
    PJE_TRT3,
    PJE_TRT4,
    PJE_TRT5,
    PJE_TRT6,
    PJE_TRT7,
    PJE_TRT8,
    PJE_TRT9,
    PJE_TRT10,
    PJE_TRT11,
    PJE_TRT12,
    PJE_TRT13,
    PJE_TRT14,
    PJE_TRT15,
    PJE_TRT16,
    PJE_TRT17,
    PJE_TRT18,
    PJE_TRT19,
    PJE_TRT20,
    PJE_TRT21,
    PJE_TRT22,
    PJE_TRT23,
    PJE_TRT24,
    PJE_TRF1,
    PJE_TRF2,
    PJE_TRF3,
    PJE_TRF4,
    PJE_TRF5,
    PJE_TRF6,
    PJE_TJDFT,
    PJE_TJGO,
    PJE_TJMG,
    PJE_TJRJ,
    PJE_TJSP,
    PJE_TJPR,
    PJE_TJSC,
    PJE_TJRS,
    PJE_TJBA;

    public boolean automacaoCopiaIntegralDisponivel() {
        return this == PJE_TRT18;
    }

    public String rotuloExibicao() {
        return switch (this) {
            case PJE_TRT1 -> "TRT 1ª Região";
            case PJE_TRT2 -> "TRT 2ª Região";
            case PJE_TRT3 -> "TRT 3ª Região";
            case PJE_TRT4 -> "TRT 4ª Região";
            case PJE_TRT5 -> "TRT 5ª Região";
            case PJE_TRT6 -> "TRT 6ª Região";
            case PJE_TRT7 -> "TRT 7ª Região";
            case PJE_TRT8 -> "TRT 8ª Região";
            case PJE_TRT9 -> "TRT 9ª Região";
            case PJE_TRT10 -> "TRT 10ª Região";
            case PJE_TRT11 -> "TRT 11ª Região";
            case PJE_TRT12 -> "TRT 12ª Região";
            case PJE_TRT13 -> "TRT 13ª Região";
            case PJE_TRT14 -> "TRT 14ª Região";
            case PJE_TRT15 -> "TRT 15ª Região";
            case PJE_TRT16 -> "TRT 16ª Região";
            case PJE_TRT17 -> "TRT 17ª Região";
            case PJE_TRT18 -> "TRT 18ª Região";
            case PJE_TRT19 -> "TRT 19ª Região";
            case PJE_TRT20 -> "TRT 20ª Região";
            case PJE_TRT21 -> "TRT 21ª Região";
            case PJE_TRT22 -> "TRT 22ª Região";
            case PJE_TRT23 -> "TRT 23ª Região";
            case PJE_TRT24 -> "TRT 24ª Região";
            case PJE_TRF1 -> "TRF 1ª Região";
            case PJE_TRF2 -> "TRF 2ª Região";
            case PJE_TRF3 -> "TRF 3ª Região";
            case PJE_TRF4 -> "TRF 4ª Região";
            case PJE_TRF5 -> "TRF 5ª Região";
            case PJE_TRF6 -> "TRF 6ª Região";
            case PJE_TJDFT -> "TJDFT";
            case PJE_TJGO -> "TJGO";
            case PJE_TJMG -> "TJMG";
            case PJE_TJRJ -> "TJRJ";
            case PJE_TJSP -> "TJSP";
            case PJE_TJPR -> "TJPR";
            case PJE_TJSC -> "TJSC";
            case PJE_TJRS -> "TJRS";
            case PJE_TJBA -> "TJBA";
        };
    }

    public static Optional<PjeTribunal> fromCodigo(String codigo) {
        if (codigo == null || codigo.isBlank()) {
            return Optional.empty();
        }
        String norm = codigo.trim().toUpperCase(Locale.ROOT);
        for (PjeTribunal t : values()) {
            if (t.name().equals(norm)) {
                return Optional.of(t);
            }
        }
        return Optional.empty();
    }
}
