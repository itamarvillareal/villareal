package br.com.vilareal.assinador;

public final class AssinadorSecurityConstants {

    public static final String API_PREFIX = "/api/assinador/v1";
    public static final String HEADER_SECRET = "X-Assinador-Secret";
    public static final String HEADER_ASSINADOR_ID = "X-Assinador-Id";
    public static final String ROLE_ASSINADOR = "ROLE_ASSINADOR";

    private AssinadorSecurityConstants() {}
}
