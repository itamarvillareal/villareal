package br.com.vilareal.whatsapp;

import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.util.Locale;
import java.util.Map;

/** MIME e nome de arquivo para upload outbound WhatsApp. */
public final class WhatsAppMediaMimeUtil {

    private static final Map<String, String> EXTENSAO_PARA_MIME = Map.ofEntries(
            Map.entry("jpg", "image/jpeg"),
            Map.entry("jpeg", "image/jpeg"),
            Map.entry("png", "image/png"),
            Map.entry("pdf", "application/pdf"),
            Map.entry("doc", "application/msword"),
            Map.entry("docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
            Map.entry("xls", "application/vnd.ms-excel"),
            Map.entry("xlsx", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"),
            Map.entry("ppt", "application/vnd.ms-powerpoint"),
            Map.entry("pptx", "application/vnd.openxmlformats-officedocument.presentationml.presentation"),
            Map.entry("txt", "text/plain"),
            Map.entry("csv", "text/csv"),
            Map.entry("zip", "application/zip"),
            Map.entry("aac", "audio/aac"),
            Map.entry("mp3", "audio/mpeg"),
            Map.entry("mpeg", "audio/mpeg"),
            Map.entry("amr", "audio/amr"),
            Map.entry("ogg", "audio/ogg"),
            Map.entry("mp4", "video/mp4"),
            Map.entry("3gp", "video/3gpp"),
            Map.entry("3gpp", "video/3gpp"));

    private WhatsAppMediaMimeUtil() {}

    public static String sanitizarFilename(String original) {
        if (!StringUtils.hasText(original)) {
            return "arquivo";
        }
        String base = original.trim().replaceAll("[\\\\/:*?\"<>|\\r\\n]", "_");
        base = base.replaceAll("\\s+", " ");
        if (base.length() > 200) {
            base = base.substring(0, 200);
        }
        return StringUtils.hasText(base) ? base : "arquivo";
    }

    public static String resolverMime(MultipartFile arquivo, String filename) {
        String fromPart = normalizarMime(arquivo != null ? arquivo.getContentType() : null);
        if (mimeUtilizavel(fromPart)) {
            return fromPart;
        }
        String fromExt = inferirMimeDaExtensao(filename);
        if (fromExt != null) {
            return fromExt;
        }
        return "application/octet-stream";
    }

    private static String normalizarMime(String mime) {
        if (!StringUtils.hasText(mime)) {
            return null;
        }
        return mime.trim().toLowerCase(Locale.ROOT).split(";")[0].trim();
    }

    private static boolean mimeUtilizavel(String mime) {
        if (!StringUtils.hasText(mime)) {
            return false;
        }
        return !"application/octet-stream".equals(mime) && !"application/x-msdownload".equals(mime);
    }

    static String inferirMimeDaExtensao(String filename) {
        if (!StringUtils.hasText(filename)) {
            return null;
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot >= filename.length() - 1) {
            return null;
        }
        String ext = filename.substring(dot + 1).trim().toLowerCase(Locale.ROOT);
        return EXTENSAO_PARA_MIME.get(ext);
    }
}
