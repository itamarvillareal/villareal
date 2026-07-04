package br.com.vilareal.whatsapp;

import org.springframework.util.StringUtils;

/** URLs do proxy autenticado de foto de contato WhatsApp. */
public final class WhatsAppContactPhotoSupport {

    private WhatsAppContactPhotoSupport() {}

    public static String proxyUrl(String canonicalPhone) {
        if (!StringUtils.hasText(canonicalPhone)) {
            return null;
        }
        return "/api/whatsapp/conversations/" + canonicalPhone.trim() + "/photo";
    }
}
