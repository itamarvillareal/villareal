package br.com.vilareal.integracao.cora.sandbox;

import br.com.vilareal.integracao.cora.CoraSslCredentials;
import br.com.vilareal.integracao.cora.CoraTokenSettings;
import org.springframework.boot.context.properties.ConfigurationProperties;

/**
 * Configuração do laboratório Cora (Integração Direta / stage).
 * Credenciais sempre via variáveis de ambiente — nunca hardcoded.
 */
@ConfigurationProperties(prefix = "cora.sandbox")
public class CoraSandboxProperties implements CoraSslCredentials, CoraTokenSettings {

    /** Master switch — false em produção. */
    private boolean enabled = false;

    /** Base API (pagamentos, extrato): default stage. */
    private String baseUrl = "https://api.stage.cora.com.br";

    /**
     * Base mTLS (token, boletos v2). Cora usa host distinto em stage.
     * Env: CORA_MTLS_BASE_URL. Default: matls-clients.api.stage.cora.com.br
     */
    private String mtlsBaseUrl = "https://matls-clients.api.stage.cora.com.br";

    private String clientId = "";

    private String certPath = "";

    private String keyPath = "";

    /** Opcional: PKCS#12 pré-gerado (openssl). Se informado, ignora cert/key PEM. */
    private String keystorePath = "";

    private String keystorePassword = "";

    /** Renovar token quando faltar menos que N segundos para expirar. */
    private int tokenRefreshSkewSeconds = 300;

    /** Arquivo de log dedicado (opcional). Vazio = só console. */
    private String logFile = "";

    public boolean isEnabled() {
        return enabled;
    }

    public void setEnabled(boolean enabled) {
        this.enabled = enabled;
    }

    public String getBaseUrl() {
        return baseUrl;
    }

    public void setBaseUrl(String baseUrl) {
        this.baseUrl = baseUrl;
    }

    public String getMtlsBaseUrl() {
        return mtlsBaseUrl;
    }

    public void setMtlsBaseUrl(String mtlsBaseUrl) {
        this.mtlsBaseUrl = mtlsBaseUrl;
    }

    @Override
    public String getTokenBaseUrl() {
        return mtlsBaseUrl;
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

    public String getLogFile() {
        return logFile;
    }

    public void setLogFile(String logFile) {
        this.logFile = logFile;
    }
}
