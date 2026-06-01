package br.com.vilareal.agenda.application;

import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.agenda.infrastructure.persistence.entity.AgendaEventoEntity;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import org.springframework.util.StringUtils;

/**
 * Equivalência fuzzy conservadora — alinhada a {@code scripts/lib/agenda-equivalencia-conservadora.mjs}.
 * Na dúvida, NÃO fundir (processo_ref diferente ou só um lado preenchido).
 */
public final class AgendaEventoEquivalenciaUtil {

    private AgendaEventoEquivalenciaUtil() {}

    public static boolean equivalentes(AgendaEventoEntity existente, AgendaEventoWriteRequest req) {
        if (existente == null || req == null) {
            return false;
        }
        if (req.getDataEvento() != null
                && existente.getDataEvento() != null
                && !req.getDataEvento().equals(existente.getDataEvento())) {
            return false;
        }
        return equivalentesCampos(
                existente.getHoraEvento(),
                existente.getDescricao(),
                existente.getStatusCurto(),
                existente.getProcessoRef(),
                req.getHoraEvento(),
                descricaoFromRequest(req),
                req.getStatusCurto(),
                req.getProcessoRef());
    }

    public static boolean equivalentesCampos(
            String horaA,
            String descA,
            String statusA,
            String processoRefA,
            String horaB,
            String descB,
            String statusB,
            String processoRefB) {
        if (!processoRefCompativel(processoRefA, processoRefB)) {
            return false;
        }

        String descNormA = AgendaEventoConteudoKeyUtil.normalizarDescricaoParaChave(
                Utf8MojibakeUtil.corrigir(descA));
        String descNormB = AgendaEventoConteudoKeyUtil.normalizarDescricaoParaChave(
                Utf8MojibakeUtil.corrigir(descB));

        if (descNormA.isEmpty() && descNormB.isEmpty()) {
            return AgendaEventoConteudoKeyUtil.normalizarStatusParaChave(statusA)
                    .equals(AgendaEventoConteudoKeyUtil.normalizarStatusParaChave(statusB));
        }
        if (descNormA.isEmpty() || descNormB.isEmpty()) {
            return false;
        }

        if (!descNormA.equals(descNormB)) {
            if (descNormA.length() < 8 || descNormB.length() < 8) {
                return false;
            }
            if (!descNormA.contains(descNormB) && !descNormB.contains(descNormA)) {
                return prefixoDescricaoEquivalente(descNormA, descNormB, horaA, horaB);
            }
        }

        String horaNormA = AgendaEventoConteudoKeyUtil.normalizarHoraParaChave(horaA);
        String horaNormB = AgendaEventoConteudoKeyUtil.normalizarHoraParaChave(horaB);
        if (!horaNormA.isEmpty() && !horaNormB.isEmpty() && !horaNormA.equals(horaNormB)) {
            return false;
        }
        return true;
    }

    /**
     * Ambos vazios → ok. Ambos preenchidos → iguais. Só um preenchido → ambíguo (não fundir).
     */
    static boolean processoRefCompativel(String refA, String refB) {
        String a = trimRef(Utf8MojibakeUtil.corrigir(refA));
        String b = trimRef(Utf8MojibakeUtil.corrigir(refB));
        if (StringUtils.hasText(a) && StringUtils.hasText(b)) {
            return a.equals(b);
        }
        if (StringUtils.hasText(a) || StringUtils.hasText(b)) {
            return false;
        }
        return true;
    }

    private static boolean prefixoDescricaoEquivalente(
            String descNormA, String descNormB, String horaA, String horaB) {
        String horaNormA = AgendaEventoConteudoKeyUtil.normalizarHoraParaChave(horaA);
        String horaNormB = AgendaEventoConteudoKeyUtil.normalizarHoraParaChave(horaB);
        if (!horaNormA.isEmpty() && !horaNormB.isEmpty() && !horaNormA.equals(horaNormB)) {
            return false;
        }
        int n = Math.min(100, Math.min(descNormA.length(), descNormB.length()));
        if (n < 40) {
            return false;
        }
        return descNormA.regionMatches(0, descNormB, 0, n);
    }

    private static String trimRef(String s) {
        if (s == null) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static String descricaoFromRequest(AgendaEventoWriteRequest req) {
        String descRaw = StringUtils.hasText(req.getDescricao()) ? req.getDescricao().trim() : "";
        String desc = Utf8MojibakeUtil.corrigir(descRaw);
        return StringUtils.hasText(desc) ? desc : "Compromisso";
    }
}
