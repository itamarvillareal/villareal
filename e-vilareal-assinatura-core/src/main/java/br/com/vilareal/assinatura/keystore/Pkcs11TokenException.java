package br.com.vilareal.assinatura.keystore;

/**
 * Falha ao abrir ou usar o token PKCS#11. Códigos estáveis para a API/assinador local
 * (ex.: {@link Codigo#TOKEN_OCUPADO} quando o sai.jar mantém a sessão).
 */
public final class Pkcs11TokenException extends Exception {

    public static final String MENSAGEM_TOKEN_OCUPADO =
            "Token em uso por outro programa. Feche o sai.jar e tente novamente.";

    public enum Codigo {
        TOKEN_OCUPADO,
        TOKEN_NAO_PRESENTE,
        PIN_INCORRETO,
        PROVIDER_INDISPONIVEL,
        OUTRO
    }

    private final Codigo codigo;

    public Pkcs11TokenException(Codigo codigo, String mensagem) {
        super(mensagem);
        this.codigo = codigo;
    }

    public Pkcs11TokenException(Codigo codigo, String mensagem, Throwable causa) {
        super(mensagem, causa);
        this.codigo = codigo;
    }

    public Codigo codigo() {
        return codigo;
    }

    public boolean tokenOcupado() {
        return codigo == Codigo.TOKEN_OCUPADO;
    }
}
