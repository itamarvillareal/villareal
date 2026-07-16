package br.com.vilareal.projudi;

import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;

/**
 * Tipos de arquivo aceitos pelo assinador automático (pasta «Assinar» do Drive).
 * A assinatura CMS attached (.p7s) embute os bytes originais, portanto funciona
 * para qualquer conteúdo — hoje aceitamos PDF, JPEG/JPG e MP4.
 */
public final class ProjudiArquivoAssinavelUtil {

    /** Extensões (com ponto, minúsculas) aceitas para assinatura. */
    public static final List<String> EXTENSOES_ASSINAVEIS = List.of(".pdf", ".jpg", ".jpeg", ".mp4");

    private ProjudiArquivoAssinavelUtil() {}

    /** {@code true} se o nome tem extensão assinável (.pdf, .jpg, .jpeg ou .mp4). */
    public static boolean isNomeAssinavel(String nomeArquivo) {
        return extensaoAssinavel(nomeArquivo) != null;
    }

    /** Extensão assinável do nome (com ponto, minúscula) ou {@code null} se não aceita. */
    public static String extensaoAssinavel(String nomeArquivo) {
        if (!StringUtils.hasText(nomeArquivo)) {
            return null;
        }
        String lower = nomeArquivo.trim().toLowerCase(Locale.ROOT);
        for (String ext : EXTENSOES_ASSINAVEIS) {
            if (lower.endsWith(ext)) {
                return ext;
            }
        }
        return null;
    }

    /** Extensão para o nome canônico no store-dir; PDF quando o original não tem extensão aceita. */
    public static String extensaoStore(String nomeOriginal) {
        String ext = extensaoAssinavel(nomeOriginal);
        return ext != null ? ext : ".pdf";
    }

    /** MIME type do conteúdo original pelo nome do arquivo. */
    public static String mimeTypePorNome(String nomeArquivo) {
        String ext = extensaoAssinavel(nomeArquivo);
        if (ext == null) {
            return "application/pdf";
        }
        return switch (ext) {
            case ".jpg", ".jpeg" -> "image/jpeg";
            case ".mp4" -> "video/mp4";
            default -> "application/pdf";
        };
    }
}
