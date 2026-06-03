package br.com.vilareal.integracao.cora;

/**
 * Parâmetros do endpoint OAuth (client_credentials + mTLS).
 */
public interface CoraTokenSettings {

    String getClientId();

    /** Base URL onde reside {@code POST /token} (host matls-clients). */
    String getTokenBaseUrl();

    int getTokenRefreshSkewSeconds();
}
