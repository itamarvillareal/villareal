package br.com.vilareal.projudi;

import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

/** Detecta erros graves / bloqueio do tribunal no fluxo PROJUDI. */
public final class ProjudiOrquestradorErroUtil {

    private ProjudiOrquestradorErroUtil() {}

    public static boolean indicaBloqueioHttp(int statusCode) {
        return statusCode == 403 || statusCode == 429;
    }

    public static boolean indicaBloqueioOuErroGrave(Throwable ex) {
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

    public static boolean detalhesIndicamFalhaUploadDrive(List<String> detalhes) {
        if (detalhes == null || detalhes.isEmpty()) {
            return false;
        }
        for (String linha : detalhes) {
            if (!StringUtils.hasText(linha)) {
                continue;
            }
            String lower = linha.toLowerCase(Locale.ROOT);
            if (lower.contains("erro drive")
                    || lower.contains("falha ao enviar")
                    || lower.contains("storagequotaexceeded")
                    || lower.contains("storage quota")
                    || lower.contains("service accounts do not have storage quota")) {
                return true;
            }
        }
        return false;
    }

    public static String resumirFalhaUploadDrive(List<String> detalhes) {
        if (detalhes != null) {
            for (int i = detalhes.size() - 1; i >= 0; i--) {
                String linha = detalhes.get(i);
                if (!StringUtils.hasText(linha)) {
                    continue;
                }
                String lower = linha.toLowerCase(Locale.ROOT);
                if (lower.contains("storagequotaexceeded")
                        || lower.contains("service accounts do not have storage quota")) {
                    return "Falha ao enviar arquivos ao Google Drive: a conta de serviço não tem quota "
                            + "própria. Configure google.drive.impersonate-user (delegação de domínio) "
                            + "ou garanta que a service account tenha permissão de escrita no Shared Drive.";
                }
                if (lower.contains("erro drive") || lower.contains("falha ao enviar")) {
                    int sep = linha.indexOf("ERRO Drive:");
                    if (sep >= 0) {
                        String msg = linha.substring(sep + "ERRO Drive:".length()).trim();
                        if (msg.length() > 400) {
                            msg = msg.substring(0, 400) + "…";
                        }
                        return "Falha ao enviar arquivos ao Google Drive: " + msg;
                    }
                }
            }
        }
        return "Arquivos obtidos do PROJUDI, mas nenhum foi enviado ao Google Drive. "
                + "Verifique permissões da pasta Movimentações e a configuração do Drive.";
    }

    public static String mensagemResumida(Throwable ex) {
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
