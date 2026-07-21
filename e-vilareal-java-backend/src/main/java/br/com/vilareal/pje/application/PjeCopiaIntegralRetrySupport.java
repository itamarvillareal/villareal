package br.com.vilareal.pje.application;

import br.com.vilareal.pje.config.PjeBrowserProperties;
import br.com.vilareal.pje.config.PjeTrt18Properties;
import br.com.vilareal.pje.infrastructure.browser.PjeCopiaIntegralMessages;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.regex.Pattern;

/**
 * Classifica falhas transitórias do robô PJe (timeout, proxy, rede) para retentativa
 * e calcula pausa entre tentativas.
 */
public final class PjeCopiaIntegralRetrySupport {

    private static final Pattern RETENTAVEL = Pattern.compile(
            "timeout|timeouterror|exceeded|navigating to|net::|econnrefused|etimedout|"
                    + "connection reset|connection refused|socket|proxy|socks|network|"
                    + "rob[oô] global ocupado|storagestate expirado|playwright|"
                    + "n[aã]o respondeu a tempo|n[aã]o foi poss[ií]vel abrir|"
                    + "http status 401|jbweb|requires http authentication|"
                    + "login pje n[aã]o concluiu|tel[aá]_login|sso rejeitou autentica",
            Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private PjeCopiaIntegralRetrySupport() {}

    public static boolean ehRetentavel(String mensagem) {
        if (!StringUtils.hasText(mensagem)) {
            return false;
        }
        String m = mensagem.trim();
        if (m.contains("auto-freio") || m.contains("Playwright desabilitado")) {
            return false;
        }
        if (m.contains("login PJe TRT18 não configurado") || m.contains("sem credencial TOTP")) {
            return false;
        }
        if (m.contains("login e CNJ são obrigatórios") || m.contains("lote já reservado")) {
            return false;
        }
        if (ehSemAcessoAcervo(m)) {
            return false;
        }
        return RETENTAVEL.matcher(m).find();
    }

    public static boolean ehSemAcessoAcervo(String mensagem) {
        if (!StringUtils.hasText(mensagem)) {
            return false;
        }
        String m = mensagem.trim();
        return m.contains(PjeCopiaIntegralMessages.SEM_ACESSO_ACERVO)
                || m.contains("descadastro")
                || m.contains("falta de habilitação")
                || m.contains("não localizado no acervo");
    }

    public static long pausaEntreTentativasMs(
            PjeTrt18Properties trt18Properties, PjeBrowserProperties browserProperties) {
        boolean proxy = browserProperties != null && StringUtils.hasText(browserProperties.getProxy());
        if (proxy) {
            return Math.max(1_000L, trt18Properties.getExecucaoRetryPauseComProxyMs());
        }
        return Math.max(1_000L, trt18Properties.getExecucaoRetryPauseMs());
    }

    public static String resumirParaEmail(String mensagem) {
        if (!StringUtils.hasText(mensagem)) {
            return "Falha na cópia integral PJe TRT18.";
        }
        String m = mensagem.trim().replaceAll("\\s+", " ");
        if (m.length() > 500) {
            return m.substring(0, 497) + "…";
        }
        return m;
    }

    public static String rotuloProxy(PjeBrowserProperties browserProperties) {
        if (browserProperties == null || !StringUtils.hasText(browserProperties.getProxy())) {
            return "desativado (tráfego direto do container)";
        }
        String proxy = browserProperties.getProxy().trim();
        int scheme = proxy.indexOf("://");
        String hostPort = scheme >= 0 ? proxy.substring(scheme + 3) : proxy;
        int at = hostPort.lastIndexOf('@');
        if (at >= 0) {
            hostPort = hostPort.substring(at + 1);
        }
        return "ativo (" + hostPort.toLowerCase(Locale.ROOT) + ")";
    }
}
