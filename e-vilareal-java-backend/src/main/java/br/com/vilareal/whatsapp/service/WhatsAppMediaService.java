package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.GoogleDriveService;
import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import com.fasterxml.jackson.annotation.JsonProperty;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpHeaders;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestClient;

import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.concurrent.atomic.AtomicReference;

/**
 * Baixa mídia recebida via WhatsApp Cloud API e persiste no Google Drive.
 */
@Service
public class WhatsAppMediaService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaService.class);
    private static final String PASTA_WHATSAPP = "WhatsApp";
    private static final String PASTA_RECEBIDOS = "Recebidos";
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss");

    private final WhatsAppConfig whatsAppConfig;
    private final RestClient restClient;
    private final GoogleDriveService googleDriveService;
    private final AtomicReference<String> pastaRecebidosId = new AtomicReference<>();

    public WhatsAppMediaService(
            WhatsAppConfig whatsAppConfig, RestClient.Builder restClientBuilder, GoogleDriveService googleDriveService) {
        this.whatsAppConfig = whatsAppConfig;
        this.googleDriveService = googleDriveService;

        SimpleClientHttpRequestFactory requestFactory = new SimpleClientHttpRequestFactory();
        requestFactory.setConnectTimeout(Duration.ofSeconds(15));
        requestFactory.setReadTimeout(Duration.ofSeconds(60));

        this.restClient = restClientBuilder
                .baseUrl(whatsAppConfig.getApiUrl())
                .defaultHeader(HttpHeaders.AUTHORIZATION, "Bearer " + whatsAppConfig.getAccessToken())
                .requestFactory(requestFactory)
                .build();
    }

    /**
     * Baixa mídia do WhatsApp e salva no Google Drive.
     *
     * @return link webViewLink do Drive ou null se falhar
     */
    public String downloadAndSaveMedia(
            String mediaId, String filename, String mimeType, String contactName, String phoneNumber) {
        if (!StringUtils.hasText(mediaId)) {
            return null;
        }
        if (!googleDriveService.isConfigurado()) {
            log.warn("Google Drive não configurado — mídia WhatsApp {} não será salva", mediaId);
            return null;
        }

        try {
            WhatsAppMediaInfo info = restClient
                    .get()
                    .uri("/{mediaId}", mediaId)
                    .retrieve()
                    .body(WhatsAppMediaInfo.class);

            if (info == null || !StringUtils.hasText(info.url())) {
                log.warn("URL de download ausente para mídia WhatsApp {}", mediaId);
                return null;
            }

            byte[] fileBytes = restClient
                    .get()
                    .uri(info.url())
                    .header(HttpHeaders.AUTHORIZATION, "Bearer " + whatsAppConfig.getAccessToken())
                    .retrieve()
                    .body(byte[].class);

            if (fileBytes == null || fileBytes.length == 0) {
                log.warn("Download vazio para mídia WhatsApp {}", mediaId);
                return null;
            }

            String effectiveMime = StringUtils.hasText(mimeType) ? mimeType : info.mimeType();
            String nomeArquivo = montarNomeArquivo(filename, effectiveMime);
            String pastaId = resolverPastaRecebidos(phoneNumber, contactName);

            DriveArquivoDto uploaded =
                    googleDriveService.uploadArquivo(fileBytes, nomeArquivo, effectiveMime, pastaId);
            if (uploaded == null || !StringUtils.hasText(uploaded.webViewLink())) {
                log.warn("Falha ao enviar mídia WhatsApp {} para o Drive", mediaId);
                return null;
            }

            log.info("Mídia WhatsApp salva no Drive: {} → {}", nomeArquivo, uploaded.webViewLink());
            return uploaded.webViewLink();
        } catch (Exception e) {
            log.error("Erro ao baixar/salvar mídia WhatsApp {}: {}", mediaId, e.getMessage());
            return null;
        }
    }

    private String resolverPastaRecebidos(String phoneNumber, String contactName) throws Exception {
        String cached = pastaRecebidosId.get();
        if (StringUtils.hasText(cached)) {
            String subpasta = montarNomeSubpasta(phoneNumber, contactName);
            return googleDriveService.encontrarOuCriarPastaPublic(subpasta, cached);
        }

        String rootId = googleDriveService.getRootFolderId();
        String whatsAppFolderId = googleDriveService.encontrarOuCriarPastaPublic(PASTA_WHATSAPP, rootId);
        String recebidosId = googleDriveService.encontrarOuCriarPastaPublic(PASTA_RECEBIDOS, whatsAppFolderId);
        pastaRecebidosId.compareAndSet(null, recebidosId);

        String subpasta = montarNomeSubpasta(phoneNumber, contactName);
        return googleDriveService.encontrarOuCriarPastaPublic(subpasta, recebidosId);
    }

    private static String montarNomeSubpasta(String phoneNumber, String contactName) {
        String digits = phoneNumber != null ? phoneNumber.replaceAll("\\D", "") : "desconhecido";
        if (StringUtils.hasText(contactName)) {
            String nome = contactName.trim().replaceAll("[\\\\/:*?\"<>|]", " ");
            return nome + " (" + digits + ")";
        }
        return digits;
    }

    private static String montarNomeArquivo(String filename, String mimeType) {
        String base = StringUtils.hasText(filename) ? filename : "arquivo." + extensaoFromMime(mimeType);
        String stamp = STAMP.format(Instant.now().atZone(ZONE_BRASILIA));
        return stamp + "_" + base;
    }

    public static String extensaoFromMime(String mimeType) {
        if (mimeType == null) {
            return "bin";
        }
        String lower = mimeType.toLowerCase();
        if (lower.contains("jpeg") || lower.contains("jpg")) {
            return "jpg";
        }
        if (lower.contains("png")) {
            return "png";
        }
        if (lower.contains("webp")) {
            return "webp";
        }
        if (lower.contains("pdf")) {
            return "pdf";
        }
        if (lower.contains("ogg")) {
            return "ogg";
        }
        if (lower.contains("mp4")) {
            return "mp4";
        }
        if (lower.contains("mp3") || lower.contains("mpeg")) {
            return "mp3";
        }
        if (lower.contains("doc")) {
            return "docx";
        }
        return "bin";
    }

    @JsonIgnoreProperties(ignoreUnknown = true)
    private record WhatsAppMediaInfo(
            @JsonProperty("url") String url,
            @JsonProperty("mime_type") String mimeType,
            @JsonProperty("sha256") String sha256,
            @JsonProperty("file_size") Long fileSize) {}
}
