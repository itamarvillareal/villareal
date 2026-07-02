package br.com.vilareal.condominio.application;

import br.com.vilareal.condominio.api.dto.PlanilhaPessoaDto;
import org.springframework.util.StringUtils;

/**
 * Resolve proprietário efetivo para cobrança: planilha (fonte atual) tem prioridade sobre cadastro legado.
 */
public final class CobrancaProprietarioEfetivoUtil {

    public enum FonteProprietario {
        PLANILHA,
        LEGADO,
        NENHUMA
    }

    public record ProprietarioEfetivo(String nome, String docDigitos, FonteProprietario fonte) {
        public boolean valido() {
            return docValido(docDigitos);
        }
    }

    private CobrancaProprietarioEfetivoUtil() {}

    public static ProprietarioEfetivo resolver(
            String planilhaNome,
            String planilhaDoc,
            String legadoNome,
            String legadoDoc) {
        if (docValido(planilhaDoc)) {
            return new ProprietarioEfetivo(
                    trim(planilhaNome),
                    somenteDigitos(planilhaDoc),
                    FonteProprietario.PLANILHA);
        }
        if (docValido(legadoDoc)) {
            return new ProprietarioEfetivo(
                    trim(legadoNome),
                    somenteDigitos(legadoDoc),
                    FonteProprietario.LEGADO);
        }
        return new ProprietarioEfetivo("", "", FonteProprietario.NENHUMA);
    }

    public static ProprietarioEfetivo fromPlanilhaPessoa(PlanilhaPessoaDto p) {
        if (p == null) {
            return new ProprietarioEfetivo("", "", FonteProprietario.NENHUMA);
        }
        String doc = StringUtils.hasText(p.cpfCnpjNormalizado())
                ? p.cpfCnpjNormalizado()
                : p.cpfCnpjBruto();
        return resolver(p.nome(), doc, null, null);
    }

    public static boolean docValido(String doc) {
        String d = somenteDigitos(doc);
        return d.length() == 11 || d.length() == 14;
    }

    public static String somenteDigitos(String raw) {
        return raw == null ? "" : raw.replaceAll("\\D", "");
    }

    /** CPFs equivalentes com zeros à esquerda ausentes no legado. */
    public static boolean cpfEquivalente(String a, String b) {
        String da = somenteDigitos(a);
        String db = somenteDigitos(b);
        if (da.isEmpty() || db.isEmpty()) {
            return false;
        }
        if (da.equals(db)) {
            return true;
        }
        if (da.length() == 11 && db.length() == 11) {
            return da.equals(db);
        }
        if (da.length() <= 11 && db.length() <= 11) {
            String pa = String.format("%11s", da).replace(' ', '0');
            String pb = String.format("%11s", db).replace(' ', '0');
            return pa.equals(pb);
        }
        return false;
    }

    private static String trim(String s) {
        return s != null ? s.trim() : "";
    }
}
