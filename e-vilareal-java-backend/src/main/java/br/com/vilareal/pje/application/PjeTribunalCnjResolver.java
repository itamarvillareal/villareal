package br.com.vilareal.pje.application;

import br.com.vilareal.pje.domain.PjeTribunal;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolve {@link PjeTribunal} a partir do CNJ ({@code NNNNNNN-DD.AAAA.J.TR.OOOO}).
 */
public final class PjeTribunalCnjResolver {

    private static final Pattern CNJ_FORMATADO =
            Pattern.compile("^\\d{7}-\\d{2}\\.\\d{4}\\.(\\d)\\.(\\d{2})\\.\\d{4}$");

    private PjeTribunalCnjResolver() {}

    public static Optional<PjeTribunal> resolverPorCnj(String cnj) {
        SegmentosCnj seg = extrairSegmentos(cnj);
        if (seg == null) {
            return Optional.empty();
        }
        return resolverPorSegmentos(seg.segmentoJ(), seg.tribunalTr());
    }

    public static Optional<PjeTribunal> resolverPorSegmentos(String segmentoJ, String tribunalTr) {
        if (!StringUtils.hasText(segmentoJ) || !StringUtils.hasText(tribunalTr)) {
            return Optional.empty();
        }
        String j = segmentoJ.trim();
        String tr = tribunalTr.trim();
        if (j.length() != 1 || tr.length() != 2) {
            return Optional.empty();
        }
        String chave = j + "." + tr;
        return switch (chave) {
            case "5.01" -> Optional.of(PjeTribunal.PJE_TRT1);
            case "5.02" -> Optional.of(PjeTribunal.PJE_TRT2);
            case "5.03" -> Optional.of(PjeTribunal.PJE_TRT3);
            case "5.04" -> Optional.of(PjeTribunal.PJE_TRT4);
            case "5.05" -> Optional.of(PjeTribunal.PJE_TRT5);
            case "5.06" -> Optional.of(PjeTribunal.PJE_TRT6);
            case "5.07" -> Optional.of(PjeTribunal.PJE_TRT7);
            case "5.08" -> Optional.of(PjeTribunal.PJE_TRT8);
            case "5.09" -> Optional.of(PjeTribunal.PJE_TRT9);
            case "5.10" -> Optional.of(PjeTribunal.PJE_TRT10);
            case "5.11" -> Optional.of(PjeTribunal.PJE_TRT11);
            case "5.12" -> Optional.of(PjeTribunal.PJE_TRT12);
            case "5.13" -> Optional.of(PjeTribunal.PJE_TRT13);
            case "5.14" -> Optional.of(PjeTribunal.PJE_TRT14);
            case "5.15" -> Optional.of(PjeTribunal.PJE_TRT15);
            case "5.16" -> Optional.of(PjeTribunal.PJE_TRT16);
            case "5.17" -> Optional.of(PjeTribunal.PJE_TRT17);
            case "5.18" -> Optional.of(PjeTribunal.PJE_TRT18);
            case "5.19" -> Optional.of(PjeTribunal.PJE_TRT19);
            case "5.20" -> Optional.of(PjeTribunal.PJE_TRT20);
            case "5.21" -> Optional.of(PjeTribunal.PJE_TRT21);
            case "5.22" -> Optional.of(PjeTribunal.PJE_TRT22);
            case "5.23" -> Optional.of(PjeTribunal.PJE_TRT23);
            case "5.24" -> Optional.of(PjeTribunal.PJE_TRT24);
            case "4.01" -> Optional.of(PjeTribunal.PJE_TRF1);
            case "4.02" -> Optional.of(PjeTribunal.PJE_TRF2);
            case "4.03" -> Optional.of(PjeTribunal.PJE_TRF3);
            case "4.04" -> Optional.of(PjeTribunal.PJE_TRF4);
            case "4.05" -> Optional.of(PjeTribunal.PJE_TRF5);
            case "4.06" -> Optional.of(PjeTribunal.PJE_TRF6);
            case "8.07" -> Optional.of(PjeTribunal.PJE_TJDFT);
            case "8.09" -> Optional.of(PjeTribunal.PJE_TJGO);
            case "8.13" -> Optional.of(PjeTribunal.PJE_TJMG);
            case "8.19" -> Optional.of(PjeTribunal.PJE_TJRJ);
            case "8.26" -> Optional.of(PjeTribunal.PJE_TJSP);
            case "8.16" -> Optional.of(PjeTribunal.PJE_TJPR);
            case "8.24" -> Optional.of(PjeTribunal.PJE_TJSC);
            case "8.21" -> Optional.of(PjeTribunal.PJE_TJRS);
            case "8.05" -> Optional.of(PjeTribunal.PJE_TJBA);
            default -> Optional.empty();
        };
    }

    public static boolean cnjEhTrt18(String cnj) {
        return resolverPorCnj(cnj).filter(t -> t == PjeTribunal.PJE_TRT18).isPresent();
    }

    static SegmentosCnj extrairSegmentos(String cnj) {
        if (!StringUtils.hasText(cnj)) {
            return null;
        }
        String norm = cnj.trim().toUpperCase(Locale.ROOT);
        Matcher m = CNJ_FORMATADO.matcher(norm);
        if (m.matches()) {
            return new SegmentosCnj(m.group(1), m.group(2));
        }
        int dot = norm.indexOf('.');
        if (dot < 0) {
            return null;
        }
        String rest = norm.substring(dot + 1);
        String[] partes = rest.split("\\.");
        if (partes.length < 4) {
            return null;
        }
        String j = partes[1];
        String tr = partes[2];
        if (j.length() == 1 && tr.length() == 2) {
            return new SegmentosCnj(j, tr);
        }
        return null;
    }

    record SegmentosCnj(String segmentoJ, String tribunalTr) {}
}
