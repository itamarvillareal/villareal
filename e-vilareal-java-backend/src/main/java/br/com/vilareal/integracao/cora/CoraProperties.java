package br.com.vilareal.integracao.cora;

import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Integração Cora (Integração Direta / mTLS). Desligada por padrão ({@code cora.enabled=false}).
 */
@ConfigurationProperties(prefix = "cora")
public class CoraProperties implements CoraSslCredentials, CoraTokenSettings {

    /** Master switch — false mantém o sistema idêntico ao atual. */
    private boolean enabled = false;

    private String clientId = "";

    private String certPath = "";

    private String keyPath = "";

    /** Host matls-clients em todas as rotas (stage default). */
    private String baseUrl = "https://matls-clients.api.stage.cora.com.br";

    private String keystorePath = "";

    private String keystorePassword = "";

    /** Renovar token quando faltar menos que N segundos para expirar. */
    private int tokenRefreshSkewSeconds = 300;

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    @Override
    public String getClientId() {
        return clientId;
    }

    public void setClientId(String clientId) {
        this.clientId = clientId;
    }

    @Override
    public String getCertPath() {
        return certPath;
    }

    public void setCertPath(String certPath) {
        this.certPath = certPath;
    }

    @Override
    public String getKeyPath() {
        return keyPath;
    }

    public void setKeyPath(String keyPath) {
        this.keyPath = keyPath;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    @Override
    public String getTokenBaseUrl() {
        return baseUrl;
    }

    @Override
    public String getKeystorePath() {
        return keystorePath;
    }

    public void setKeystorePath(String keystorePath) {
        this.keystorePath = keystorePath;
    }

    @Override
    public String getKeystorePassword() {
        return keystorePassword;
    }

    public void setKeystorePassword(String keystorePassword) {
        this.keystorePassword = keystorePassword;
    }

    @Override
    public int getTokenRefreshSkewSeconds() {
        return tokenRefreshSkewSeconds;
    }

    public void setTokenRefreshSkewSeconds(int tokenRefreshSkewSeconds) {
        this.tokenRefreshSkewSeconds = tokenRefreshSkewSeconds;
    }
}
