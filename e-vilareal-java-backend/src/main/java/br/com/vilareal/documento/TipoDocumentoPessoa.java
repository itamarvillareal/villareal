package br.com.vilareal.documento;

/**
 * Subpastas dentro de {@code Pessoas/{id8} - nome/} para documentos da pessoa,
 * independentes de processo/cliente.
 */
public enum TipoDocumentoPessoa {
    DOCUMENTOS("Documentos"),
    PROCURACOES("Procurações"),
    CONTRATOS("Contratos"),
    DECLARACOES("Declarações"),
    ASSINADOS("Assinados");

    private final String pasta;

    TipoDocumentoPessoa(String pasta) {
        this.pasta = pasta;
    }

    public String getPasta() {
        return pasta;
    }

    public static TipoDocumentoPessoa deTipoDocumento(TipoDocumento tipo) {
        if (tipo == null) {
            return DOCUMENTOS;
        }
        return switch (tipo) {
            case PROCURACAO -> PROCURACOES;
            case CONTRATO -> CONTRATOS;
            case DECLARACAO -> DECLARACOES;
            case PETICAO, DOCUMENTO -> DOCUMENTOS;
        };
    }

    public static TipoDocumentoPessoa parse(String valor) {
        if (valor == null || valor.isBlank()) {
            return DOCUMENTOS;
        }
        String normalizado = valor.trim();
        for (TipoDocumentoPessoa tipo : values()) {
            if (tipo.name().equalsIgnoreCase(normalizado) || tipo.pasta.equalsIgnoreCase(normalizado)) {
                return tipo;
            }
        }
        throw new IllegalArgumentException("tipoDocumento inválido: " + valor);
    }
}
