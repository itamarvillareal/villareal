package br.com.vilareal.assinador.local.api;

public class AssinadorApiException extends Exception {

    private final boolean rede;

    public AssinadorApiException(String mensagem, Throwable causa, boolean rede) {
        super(mensagem, causa);
        this.rede = rede;
    }

    public AssinadorApiException(String mensagem, boolean rede) {
        super(mensagem);
        this.rede = rede;
    }

    public boolean rede() {
        return rede;
    }
}
