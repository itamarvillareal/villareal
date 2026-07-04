package br.com.vilareal.whatsapp;

import org.springframework.util.StringUtils;

import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Extrai o fileId do Google Drive a partir de webViewLink persistido em {@code media_drive_url}.
 * Usado como fallback quando {@code media_drive_file_id} ainda não foi preenchido (mídias antigas).
 */
public final class WhatsAppDriveFileIdUtil {

    private static final Pattern FILE_D_PATH =
            Pattern.compile("/file/d/([a-zA-Z0-9_-]+)", Pattern.CASE_INSENSITIVE);
    private static final Pattern ID_QUERY_PARAM =
            Pattern.compile("[?&]id=([a-zA-Z0-9_-]+)", Pattern.CASE_INSENSITIVE);

    private WhatsAppDriveFileIdUtil() {}

    /**
     * @return fileId ou null se o link não for reconhecido
     */
    public static String extrairFileIdDeWebViewLink(String webViewLink) {
        if (!StringUtils.hasText(webViewLink)) {
            return null;
        }
        String trimmed = webViewLink.trim();
        Matcher path = FILE_D_PATH.matcher(trimmed);
        if (path.find()) {
            return path.group(1);
        }
        Matcher query = ID_QUERY_PARAM.matcher(trimmed);
        if (query.find()) {
            return query.group(1);
        }
        return null;
    }

    /**
     * Resolve fileId: coluna persistida tem prioridade; senão extrai do webViewLink.
     */
    public static String resolverFileId(String mediaDriveFileId, String mediaDriveUrl) {
        if (StringUtils.hasText(mediaDriveFileId)) {
            return mediaDriveFileId.trim();
        }
        return extrairFileIdDeWebViewLink(mediaDriveUrl);
    }
}
