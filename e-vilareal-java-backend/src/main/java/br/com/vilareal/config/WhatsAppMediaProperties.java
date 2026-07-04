package br.com.vilareal.config;

import br.com.vilareal.whatsapp.WhatsAppMediaCategory;
import org.springframework.boot.context.properties.ConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/**
 * Propriedades de mídia WhatsApp (download inbound, reprocessamento e limites outbound Meta).
 * {@code maxTentativas} é compartilhado pelo fluxo async e pelo job de reprocessamento (Passo 4).
 *
 * <p>Limites outbound ({@link #maxImageBytes}, etc.) refletem valores publicados pela Meta
 * (Cloud API) e podem mudar — ajuste via {@code application.properties} se necessário.
 */
@Configuration
@ConfigurationProperties(prefix = "whatsapp.media")
public class WhatsAppMediaProperties {

    /** Tentativas que consomem contador antes de marcar FAILED definitivo. */
    private int maxTentativas = 5;

    /** Intervalo entre ticks do job de reprocessamento (fixedDelay). */
    private long reprocessIntervaloMs = 120_000;

    /** Máximo de mensagens por rodada do job. */
    private int reprocessLote = 20;

    /** Espaçamento mínimo entre tentativas da mesma mídia (anti-starvation). */
    private long reprocessMinIntervaloMs = 300_000;

    /**
     * Imagem JPEG/PNG — limite Meta ~5 MB.
     * @see <a href="https://developers.facebook.com/docs/whatsapp/cloud-api/reference/media">Meta Media</a>
     */
    private long maxImageBytes = 5L * 1024 * 1024;

    /** Documento — limite Meta ~100 MB. */
    private long maxDocumentBytes = 100L * 1024 * 1024;

    /** Áudio — limite Meta ~16 MB. */
    private long maxAudioBytes = 16L * 1024 * 1024;

    /** Vídeo MP4/3GPP — limite Meta ~16 MB. */
    private long maxVideoBytes = 16L * 1024 * 1024;

    /** TTL de arquivos órfãos no staging outbound (horas). */
    private int stagingTtlHoras = 24;

    public long getMaxBytes(WhatsAppMediaCategory category) {
        return switch (category) {
            case IMAGE -> maxImageBytes;
            case DOCUMENT -> maxDocumentBytes;
            case AUDIO -> maxAudioBytes;
            case VIDEO -> maxVideoBytes;
        };
    }

    public int getMaxTentativas() {
        return maxTentativas;
    }

    public void setMaxTentativas(int maxTentativas) {
        this.maxTentativas = maxTentativas;
    }

    public long getReprocessIntervaloMs() {
        return reprocessIntervaloMs;
    }

    public void setReprocessIntervaloMs(long reprocessIntervaloMs) {
        this.reprocessIntervaloMs = reprocessIntervaloMs;
    }

    public int getReprocessLote() {
        return reprocessLote;
    }

    public void setReprocessLote(int reprocessLote) {
        this.reprocessLote = reprocessLote;
    }

    public long getReprocessMinIntervaloMs() {
        return reprocessMinIntervaloMs;
    }

    public void setReprocessMinIntervaloMs(long reprocessMinIntervaloMs) {
        this.reprocessMinIntervaloMs = reprocessMinIntervaloMs;
    }

    public long getMaxImageBytes() {
        return maxImageBytes;
    }

    public void setMaxImageBytes(long maxImageBytes) {
        this.maxImageBytes = maxImageBytes;
    }

    public long getMaxDocumentBytes() {
        return maxDocumentBytes;
    }

    public void setMaxDocumentBytes(long maxDocumentBytes) {
        this.maxDocumentBytes = maxDocumentBytes;
    }

    public long getMaxAudioBytes() {
        return maxAudioBytes;
    }

    public void setMaxAudioBytes(long maxAudioBytes) {
        this.maxAudioBytes = maxAudioBytes;
    }

    public long getMaxVideoBytes() {
        return maxVideoBytes;
    }

    public void setMaxVideoBytes(long maxVideoBytes) {
        this.maxVideoBytes = maxVideoBytes;
    }

    public int getStagingTtlHoras() {
        return stagingTtlHoras;
    }

    public void setStagingTtlHoras(int stagingTtlHoras) {
        this.stagingTtlHoras = stagingTtlHoras;
    }
}
