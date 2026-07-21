package br.com.vilareal.whatsapp;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Monta texto legível para encaminhar tipos não reenviáveis como mídia nativa. */
public final class WhatsAppForwardTextUtil {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private WhatsAppForwardTextUtil() {}

    public static String montarTextoEncaminhamento(WhatsAppMessageType messageType, String content) {
        if (messageType == null) {
            return textoOuPadrao(content, "Mensagem");
        }
        return switch (messageType) {
            case TEXT, TEMPLATE -> textoOuPadrao(content, "Mensagem");
            case INTERACTIVE, BUTTON -> textoOuPadrao(
                    WhatsAppInteractiveReplySupport.resumoLegivel(content), "↩️ Resposta");
            case CONTACT -> montarTextoContato(content);
            case LOCATION -> montarTextoLocalizacao(content);
            case REACTION -> textoOuPadrao(WhatsAppReactionSupport.resumoLegivel(content), "Reação");
            case UNSUPPORTED -> "🚫 Conteúdo não suportado — não foi possível encaminhar.";
            default -> textoOuPadrao(content, "Mensagem");
        };
    }

    public static boolean isTipoMidia(WhatsAppMessageType messageType) {
        return messageType == WhatsAppMessageType.IMAGE
                || messageType == WhatsAppMessageType.DOCUMENT
                || messageType == WhatsAppMessageType.AUDIO
                || messageType == WhatsAppMessageType.VIDEO;
    }

    public static String extrairLegendaMidia(String content, String captionOverride) {
        if (StringUtils.hasText(captionOverride)) {
            return captionOverride.trim();
        }
        if (!StringUtils.hasText(content) || isPlaceholderMidia(content)) {
            return null;
        }
        return content.trim();
    }

    static boolean isPlaceholderMidia(String content) {
        String c = content.trim();
        return c.startsWith("📷")
                || c.startsWith("📎")
                || c.startsWith("🎤")
                || c.startsWith("🎬")
                || c.startsWith("📄")
                || c.startsWith("🎵")
                || c.startsWith("🎥")
                || c.equals("📩 Mídia recebida")
                || c.startsWith("📷 Imagem recebida")
                || c.startsWith("📎 Documento recebido")
                || c.startsWith("🎤 Áudio recebido")
                || c.startsWith("🎬 Vídeo recebido");
    }

    private static String textoOuPadrao(String content, String padrao) {
        if (StringUtils.hasText(content)) {
            return content.trim();
        }
        return padrao;
    }

    private static String montarTextoContato(String contentJson) {
        if (!StringUtils.hasText(contentJson)) {
            return "👤 Cartão de contato";
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> root = MAPPER.readValue(contentJson, Map.class);
            Object raw = root.get("contatos");
            if (!(raw instanceof List<?> list) || list.isEmpty()) {
                return WhatsAppContactCardSupport.resumoLegivel(contentJson);
            }
            List<String> linhas = new ArrayList<>();
            linhas.add("👤 Cartão de contato encaminhado");
            for (Object o : list) {
                if (!(o instanceof Map<?, ?> contato)) {
                    continue;
                }
                Object nome = contato.get("nome");
                if (nome != null && StringUtils.hasText(String.valueOf(nome))) {
                    linhas.add("• " + String.valueOf(nome).trim());
                }
                Object phones = contato.get("telefones");
                if (phones instanceof List<?> phoneList) {
                    for (Object ph : phoneList) {
                        if (ph instanceof Map<?, ?> phoneMap) {
                            Object numero = phoneMap.get("numero");
                            if (numero != null && StringUtils.hasText(String.valueOf(numero))) {
                                linhas.add("  Tel: " + String.valueOf(numero).trim());
                            }
                        }
                    }
                }
                Object emails = contato.get("emails");
                if (emails instanceof List<?> emailList) {
                    for (Object em : emailList) {
                        if (em != null && StringUtils.hasText(String.valueOf(em))) {
                            linhas.add("  E-mail: " + String.valueOf(em).trim());
                        }
                    }
                }
            }
            return String.join("\n", linhas);
        } catch (Exception e) {
            return WhatsAppContactCardSupport.resumoLegivel(contentJson);
        }
    }

    private static String montarTextoLocalizacao(String contentJson) {
        if (!StringUtils.hasText(contentJson)) {
            return "📍 Localização";
        }
        try {
            @SuppressWarnings("unchecked")
            Map<String, Object> root = MAPPER.readValue(contentJson, Map.class);
            Object raw = root.get("localizacao");
            if (!(raw instanceof Map<?, ?> loc)) {
                return WhatsAppLocationSupport.resumoLegivel(contentJson);
            }
            Object lat = loc.get("latitude");
            Object lng = loc.get("longitude");
            if (lat == null || lng == null) {
                return WhatsAppLocationSupport.resumoLegivel(contentJson);
            }
            String titulo = WhatsAppLocationSupport.resumoLegivel(contentJson);
            String url = "https://www.google.com/maps/search/?api=1&query=" + lat + "," + lng;
            Object address = loc.get("address");
            if (address != null && StringUtils.hasText(String.valueOf(address))) {
                return titulo + "\n" + String.valueOf(address).trim() + "\n" + url;
            }
            return titulo + "\n" + url;
        } catch (Exception e) {
            return WhatsAppLocationSupport.resumoLegivel(contentJson);
        }
    }
}
