package br.com.vilareal.projudi;

import org.springframework.util.StringUtils;

import java.util.Locale;

/** Detecta erros graves / bloqueio do tribunal no fluxo PROJUDI. */
final class ProjudiOrquestradorErroUtil {

    private ProjudiOrquestradorErroUtil() {}

    static boolean indicaBloqueioHttp(int statusCode) {
        return statusCode == 403 || statusCode == 429;
    }

    static boolean indicaBloqueioOuErroGrave(Throwable ex) {
        if (ex == null) {
            return false;
        }
        Throwable atual = ex;
        while (atual != null) {
            if (indicaBloqueioHttpExtraido(atual)) {
                return true;
            }
            String msg = atual.getMessage();
            if (StringUtils.hasText(msg)) {
                String lower = msg.toLowerCase(Locale.ROOT);
                if (lower.contains("captcha")
                        || lower.contains("bloqueio")
                        || lower.contains("bloqueado")
                        || lower.contains("too many")
                        || lower.contains("rate limit")
                        || lower.contains("tela de login")
                        || lower.contains("continuou na tela de login")
                        || lower.contains("acesso negado")
                        || lower.contains("forbidden")
                        || lower.contains(" 403")
                        || lower.contains(" 429")) {
                    return true;
                }
            }
            Throwable causa = atual.getCause();
            if (causa == atual) {
                break;
            }
            atual = causa;
        }
        return false;
    }

    private static boolean indicaBloqueioHttpExtraido(Throwable ex) {
        String msg = ex.getMessage();
        if (!StringUtils.hasText(msg)) {
            return false;
        }
        String lower = msg.toLowerCase(Locale.ROOT);
        return lower.contains("status=403")
                || lower.contains("status=429")
                || lower.contains("status code: 403")
                || lower.contains("status code: 429")
                || lower.contains("http 403")
                || lower.contains("http 429");
    }

    static String mensagemResumida(Throwable ex) {
        if (ex == null) {
            return null;
        }
        Throwable atual = ex;
        String last = ex.getClass().getSimpleName();
        while (atual != null) {
            if (StringUtils.hasText(atual.getMessage())) {
                last = atual.getMessage().trim();
            }
            Throwable causa = atual.getCause();
            if (causa == atual) {
                break;
            }
            atual = causa;
        }
        return last.length() > 500 ? last.substring(0, 500) + "…" : last;
    }
}
