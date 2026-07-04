package br.com.vilareal.whatsapp.service;

import br.com.vilareal.config.WhatsAppConfig;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.whatsapp.dto.WhatsAppMediaSaveResult;
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
import java.util.concurrent.atomic.AtomicReference;

/**
 * Baixa mídia recebida via WhatsApp Cloud API e persiste no Google Drive.
 */
@Service
public class WhatsAppMediaService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppMediaService.class);
    private static final String PASTA_WHATSAPP = "WhatsApp";
    private static final String PASTA_RECEBIDOS = "Recebidos";
    /** Limite conservador — upload sanitiza de novo; Drive aceita até 255. */
    private static final int MAX_NOME_ARQUIVO = 240;

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
     * Baixa mídia do WhatsApp e salva no Google Drive (idempotente por {@code mediaId} na pasta do contato).
     *
     * @return webViewLink e fileId do Drive, ou null se falhar
     */
    public WhatsAppMediaSaveResult downloadAndSaveMedia(
            String mediaId, String filename, String mimeType, String contactName, String phoneNumber) {
        if (!StringUtils.hasText(mediaId)) {
            return null;
        }
        if (!googleDriveService.isConfigurado()) {
            log.warn("Google Drive não configurado — mídia WhatsApp {} não será salva", mediaId);
            return null;
        }

        try {
            String mimeParaNome = StringUtils.hasText(mimeType) ? mimeType : "application/octet-stream";
            String nomeArquivo = montarNomeArquivoDeterministico(mediaId, filename, mimeParaNome);
            String pastaId = resolverPastaRecebidos(phoneNumber, contactName);

            // Dedupe por media_id: mesma pasta + mesmo nome determinístico → reutilizar sem baixar da Meta.
            // Risco de corrida: dois workers simultâneos podem ambos não encontrar o arquivo e subir
            // duplicata — mitigação completa nos Passos 3/4 (status de processamento + ShedLock no job).
            DriveArquivoDto existente = googleDriveService.buscarArquivoPorNomeNaPasta(pastaId, nomeArquivo);
            if (existente != null
                    && StringUtils.hasText(existente.webViewLink())
                    && StringUtils.hasText(existente.id())) {
                log.info(
                        "Mídia WhatsApp {} já existe no Drive, reutilizando: {} (fileId={})",
                        mediaId,
                        existente.webViewLink(),
                        existente.id());
                return new WhatsAppMediaSaveResult(existente.webViewLink(), existente.id());
            }

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

            DriveArquivoDto uploaded =
                    googleDriveService.uploadArquivo(fileBytes, nomeArquivo, effectiveMime, pastaId);
            if (uploaded == null
                    || !StringUtils.hasText(uploaded.webViewLink())
                    || !StringUtils.hasText(uploaded.id())) {
                log.warn("Falha ao enviar mídia WhatsApp {} para o Drive", mediaId);
                return null;
            }

            log.info(
                    "Mídia WhatsApp salva no Drive: {} → {} (fileId={})",
                    nomeArquivo,
                    uploaded.webViewLink(),
                    uploaded.id());
            return new WhatsAppMediaSaveResult(uploaded.webViewLink(), uploaded.id());
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

    /**
     * Nome estável por {@code mediaId} — sem timestamp — para idempotência no Drive.
     * Formato: {@code {mediaId}_{base}} com base = filename sanitizado ou {@code arquivo.{ext}}.
     */
    static String montarNomeArquivoDeterministico(String mediaId, String filename, String mimeType) {
        String prefixo = sanitizarSegmentoMediaId(mediaId) + "_";
        String base = montarBaseArquivo(filename, mimeType);
        String nome = prefixo + base;
        if (nome.length() <= MAX_NOME_ARQUIVO) {
            return nome;
        }
        int maxBase = Math.max(1, MAX_NOME_ARQUIVO - prefixo.length());
        return prefixo + truncarBasePreservandoExtensao(base, maxBase);
    }

    private static String montarBaseArquivo(String filename, String mimeType) {
        String ext = extensaoFromMime(mimeType);
        if (StringUtils.hasText(filename)) {
            String base = sanitizarComponenteNome(filename.trim());
            if (!base.contains(".")) {
                base = base + "." + ext;
            }
            return base;
        }
        return "arquivo." + ext;
    }

    private static String sanitizarSegmentoMediaId(String mediaId) {
        return mediaId.trim().replaceAll("[\\\\/:*?\"<>|\\r\\n\\s]", "_");
    }

    private static String sanitizarComponenteNome(String nome) {
        return nome.replaceAll("[\\\\/:*?\"<>|\\r\\n]", " ").replaceAll("\\s+", " ").trim();
    }

    private static String truncarBasePreservandoExtensao(String base, int maxLen) {
        if (base.length() <= maxLen) {
            return base;
        }
        int dot = base.lastIndexOf('.');
        if (dot > 0 && dot < base.length() - 1) {
            String ext = base.substring(dot);
            int maxStem = maxLen - ext.length();
            if (maxStem > 0) {
                return base.substring(0, maxStem) + ext;
            }
        }
        return base.substring(0, maxLen);
    }

    public static String extensaoFromMime(String mimeType) {
        if (mimeType == null) {
            return "bin";
        }
        String lower = mimeType.toLowerCase().split(";")[0].trim();
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
