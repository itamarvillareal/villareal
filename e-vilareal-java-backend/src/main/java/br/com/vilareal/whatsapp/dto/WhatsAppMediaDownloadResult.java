package br.com.vilareal.whatsapp.dto;

/**
 * Resultado explícito do download/upload de mídia WhatsApp — sucesso ou falha classificada.
 */
public sealed interface WhatsAppMediaDownloadResult
        permits WhatsAppMediaDownloadResult.Sucesso, WhatsAppMediaDownloadResult.Falha {

    record Sucesso(String webViewLink, String fileId) implements WhatsAppMediaDownloadResult {}

    record Falha(String motivo, boolean transitoria, boolean consumirTentativa) implements WhatsAppMediaDownloadResult {

        public Falha {
            motivo = motivo != null && !motivo.isBlank() ? motivo : "desconhecido";
        }

        public static Falha transitoria(String motivo) {
            return new Falha(motivo, true, true);
        }

        public static Falha permanente(String motivo) {
            return new Falha(motivo, false, true);
        }

        /** Drive indisponível — mantém PENDING e não consome tentativa (Passo 3.5). */
        public static Falha driveNaoConfigurado() {
            return new Falha("drive_nao_configurado", true, false);
        }
    }
}
