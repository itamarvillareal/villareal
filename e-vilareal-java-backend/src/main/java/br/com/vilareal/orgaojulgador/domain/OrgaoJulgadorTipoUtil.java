package br.com.vilareal.orgaojulgador.domain;

import java.util.Locale;

public final class OrgaoJulgadorTipoUtil {

    private OrgaoJulgadorTipoUtil() {}

    public static OrgaoJulgadorTipo classificar(String nome, String grau) {
        String n = nome == null ? "" : nome.toUpperCase(Locale.ROOT);
        if (n.contains("JUIZADO") || "JE".equalsIgnoreCase(grau)) {
            return OrgaoJulgadorTipo.JUIZADO;
        }
        if (n.contains("TURMA") || "TR".equalsIgnoreCase(grau)) {
            return OrgaoJulgadorTipo.TURMA;
        }
        if (n.contains("CAMARA") || n.contains("CÂMARA") || n.contains("GABINETE")) {
            return OrgaoJulgadorTipo.CAMARA;
        }
        if (n.contains("SECAO") || n.contains("SEÇÃO")) {
            return OrgaoJulgadorTipo.SECAO;
        }
        if (n.contains("VARA")) {
            return OrgaoJulgadorTipo.VARA;
        }
        return OrgaoJulgadorTipo.OUTRO;
    }
}
