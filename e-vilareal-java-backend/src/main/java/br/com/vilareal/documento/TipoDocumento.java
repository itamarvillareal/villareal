package br.com.vilareal.documento;

public enum TipoDocumento {
    PETICAO("Petições"),
    PROCURACAO("Procurações"),
    CONTRATO("Contratos"),
    DECLARACAO("Declarações"),
    DOCUMENTO("Documentos");

    private final String pasta;

    TipoDocumento(String pasta) {
        this.pasta = pasta;
    }

    public String getPasta() {
        return pasta;
    }
}
