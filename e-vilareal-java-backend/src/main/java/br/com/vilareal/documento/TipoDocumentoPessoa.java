package br.com.vilareal.documento;

/**
 * Subpastas dentro de {@code Pessoas/{id8} - nome/}:
 * {@link #DOCUMENTOS} (PDFs e anexos) e {@link #ASSINADOS} (.p7s numerados a partir de 02).
 */
public enum TipoDocumentoPessoa {
    DOCUMENTOS("Documentos"),
    ASSINADOS("Assinados");

    private final String pasta;

    TipoDocumentoPessoa(String pasta) {
        this.pasta = pasta;
    }

    public String getPasta() {
        return pasta;
    }

    public static TipoDocumentoPessoa deTipoDocumento(TipoDocumento tipo) {
        return DOCUMENTOS;
    }

    public static TipoDocumentoPessoa parse(String valor) {
        if (valor == null || valor.isBlank()) {
            return DOCUMENTOS;
        }
        String normalizado = valor.trim();
        if (normalizado.equalsIgnoreCase("ASSINADOS")
                || normalizado.equalsIgnoreCase("Assinados")) {
            return ASSINADOS;
        }
        if (normalizado.equalsIgnoreCase("DOCUMENTOS")
                || normalizado.equalsIgnoreCase("Documentos")) {
            return DOCUMENTOS;
        }
        // Legado (subpastas antigas) → Documentos, exceto .p7s tratados em outro fluxo
        if (normalizado.equalsIgnoreCase("PROCURACOES")
                || normalizado.equalsIgnoreCase("Procurações")
                || normalizado.equalsIgnoreCase("CONTRATOS")
                || normalizado.equalsIgnoreCase("Contratos")
                || normalizado.equalsIgnoreCase("DECLARACOES")
                || normalizado.equalsIgnoreCase("Declarações")) {
            return DOCUMENTOS;
        }
        for (TipoDocumentoPessoa tipo : values()) {
            if (tipo.name().equalsIgnoreCase(normalizado) || tipo.pasta.equalsIgnoreCase(normalizado)) {
                return tipo;
            }
        }
        throw new IllegalArgumentException("tipoDocumento inválido: " + valor);
    }
}
