package br.com.vilareal.pje.config;

import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.stereotype.Component;

@Component
@ConfigurationProperties(prefix = "app.pje.trt18")
public class PjeTrt18Properties {

    /**
     * URL do PJe 1º grau TRT18 (confirmar no deploy).
     * Placeholder PDPJ: painel do tribunal.
     */
    private String urlPrimeiroGrau = "https://pje.trt18.jus.br/primeirograu/login.seam";

    /**
     * URL do PJe 2º grau TRT18 (confirmar no deploy).
     */
    private String urlSegundoGrau = "https://pje.trt18.jus.br/segundograu/";

    /** Modo somente leitura — não dispara ações destrutivas após login. */
    private boolean modoLeitura = true;

    /** Limite de erros consecutivos antes do auto-freio. */
    private int autoFreioLimiteErros = 3;

    /** Tempo de pausa do auto-freio; passado ele, o robô volta sozinho (meia-abertura). */
    private int autoFreioCooldownSegundos = 300;

    /**
     * Seletor do botão "Detalhes do Processo" no acervo-geral (abre aba/popup em {@code /pjekz/processo/.../detalhe}).
     * O download vem depois via Menu do processo e "Baixar processo completo".
     */
    private String copiaIntegralButtonSelector = "button[aria-label^=\"Detalhes do Processo\"]";

    private int copiaIntegralMaxTentativas = 3;
    private int copiaIntegralDownloadTimeoutMs = 30_000;
    private int copiaIntegralRetryPauseMs = 2_000;

    public String getUrlPrimeiroGrau() {
        return urlPrimeiroGrau;
    }

    public void setUrlPrimeiroGrau(String urlPrimeiroGrau) {
        this.urlPrimeiroGrau = urlPrimeiroGrau;
    }

    public String getUrlSegundoGrau() {
        return urlSegundoGrau;
    }

    public void setUrlSegundoGrau(String urlSegundoGrau) {
        this.urlSegundoGrau = urlSegundoGrau;
    }

    public boolean isModoLeitura() {
        return modoLeitura;
    }

    public void setModoLeitura(boolean modoLeitura) {
        this.modoLeitura = modoLeitura;
    }

    public int getAutoFreioLimiteErros() {
        return autoFreioLimiteErros;
    }

    public void setAutoFreioLimiteErros(int autoFreioLimiteErros) {
        this.autoFreioLimiteErros = autoFreioLimiteErros;
    }

    public int getAutoFreioCooldownSegundos() {
        return autoFreioCooldownSegundos;
    }

    public void setAutoFreioCooldownSegundos(int autoFreioCooldownSegundos) {
        this.autoFreioCooldownSegundos = autoFreioCooldownSegundos;
    }

    public long getAutoFreioCooldownMs() {
        return autoFreioCooldownSegundos * 1_000L;
    }

    public String urlParaGrau(br.com.vilareal.pje.domain.PjeGrau grau) {
        return grau == br.com.vilareal.pje.domain.PjeGrau.SEGUNDO_GRAU
                ? urlSegundoGrau
                : urlPrimeiroGrau;
    }

    public String getCopiaIntegralButtonSelector() {
        return copiaIntegralButtonSelector;
    }

    public void setCopiaIntegralButtonSelector(String copiaIntegralButtonSelector) {
        this.copiaIntegralButtonSelector = copiaIntegralButtonSelector;
    }

    public int getCopiaIntegralMaxTentativas() {
        return copiaIntegralMaxTentativas;
    }

    public void setCopiaIntegralMaxTentativas(int copiaIntegralMaxTentativas) {
        this.copiaIntegralMaxTentativas = copiaIntegralMaxTentativas;
    }

    public int getCopiaIntegralDownloadTimeoutMs() {
        return copiaIntegralDownloadTimeoutMs;
    }

    public void setCopiaIntegralDownloadTimeoutMs(int copiaIntegralDownloadTimeoutMs) {
        this.copiaIntegralDownloadTimeoutMs = copiaIntegralDownloadTimeoutMs;
    }

    public int getCopiaIntegralRetryPauseMs() {
        return copiaIntegralRetryPauseMs;
    }

    public void setCopiaIntegralRetryPauseMs(int copiaIntegralRetryPauseMs) {
        this.copiaIntegralRetryPauseMs = copiaIntegralRetryPauseMs;
    }

    /**
     * SPA Angular (pjekz) na raiz do host — não usar prefixo /primeirograu/ ou /segundograu/.
     * Usado apenas em {@code tentarRestaurarSessao}; após login completo o redirect já cai aqui.
     */
    public String urlPainelPosLogin(br.com.vilareal.pje.domain.PjeGrau grau) {
        return "https://pje.trt18.jus.br/pjekz/painel/usuario-externo";
    }
}
