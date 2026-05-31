package br.com.vilareal.email;

public enum EmailImportacaoSyncTipo {
    PROJUDI("PROJUDI"),
    TRT("TRT"),
    JUSBRASIL("JUSBRASIL");

    private final String id;

    EmailImportacaoSyncTipo(String id) {
        this.id = id;
    }

    public String getId() {
        return id;
    }
}
