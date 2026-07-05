package br.com.vilareal.assinador.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "assinador.api")
public class AssinadorApiProperties {

    /** Segredo compartilhado (env ASSINADOR_API_SECRET). Nunca logar. */
    private String secret = "";

    /** Rejeita HTTP puro em produção — segredo trafega no header. */
    private boolean requireHttps = true;

    /** Intervalo entre tentativas no long-poll (ms). */
    private int longPollIntervalMs = 2000;

    /** Máximo de requisições por IP por minuto nos endpoints /assinador/v1. */
    private int rateLimitPerMinute = 120;

    public String secret() {
        return secret;
    }

    public void setSecret(String secret) {
        this.secret = secret != null ? secret : "";
    }

    public boolean requireHttps() {
        return requireHttps;
    }

    public void setRequireHttps(boolean requireHttps) {
        this.requireHttps = requireHttps;
    }

    public int longPollIntervalMs() {
        return longPollIntervalMs;
    }

    public void setLongPollIntervalMs(int longPollIntervalMs) {
        this.longPollIntervalMs = longPollIntervalMs;
    }

    public int rateLimitPerMinute() {
        return rateLimitPerMinute;
    }

    public void setRateLimitPerMinute(int rateLimitPerMinute) {
        this.rateLimitPerMinute = rateLimitPerMinute;
    }
}
