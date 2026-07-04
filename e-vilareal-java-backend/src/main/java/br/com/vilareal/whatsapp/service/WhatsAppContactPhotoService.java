package br.com.vilareal.whatsapp.service;

import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.whatsapp.WhatsAppContactPhotoSupport;
import br.com.vilareal.whatsapp.WhatsAppDriveFileIdUtil;
import br.com.vilareal.whatsapp.WhatsAppMediaCategory;
import br.com.vilareal.whatsapp.WhatsAppMediaMimeUtil;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppContactPhotoEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppContactPhotoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

@Service
public class WhatsAppContactPhotoService {

    private static final String PASTA_WHATSAPP = "WhatsApp";
    private static final String PASTA_FOTOS = "Fotos";

    private final WhatsAppContactPhotoRepository contactPhotoRepository;
    private final WhatsAppMediaValidation mediaValidation;
    private final GoogleDriveService googleDriveService;

    public WhatsAppContactPhotoService(
            WhatsAppContactPhotoRepository contactPhotoRepository,
            WhatsAppMediaValidation mediaValidation,
            GoogleDriveService googleDriveService) {
        this.contactPhotoRepository = contactPhotoRepository;
        this.mediaValidation = mediaValidation;
        this.googleDriveService = googleDriveService;
    }

    @Transactional
    public String definirFoto(String phoneRaw, MultipartFile arquivo) {
        String phone = WhatsAppService.formatPhoneNumber(phoneRaw);
        if (arquivo == null || arquivo.isEmpty()) {
            throw new IllegalArgumentException("Selecione uma imagem.");
        }
        if (!googleDriveService.isConfigurado()) {
            throw new IllegalStateException("Google Drive não configurado.");
        }

        String filename = WhatsAppMediaMimeUtil.sanitizarFilename(arquivo.getOriginalFilename());
        String mime = WhatsAppMediaMimeUtil.resolverMime(arquivo, filename);
        WhatsAppMediaValidation.ValidationResult validation = mediaValidation.validar(mime, arquivo.getSize());
        if (validation.category() != WhatsAppMediaCategory.IMAGE) {
            throw new IllegalArgumentException("Apenas imagens JPEG ou PNG são permitidas.");
        }

        byte[] bytes;
        try {
            bytes = arquivo.getBytes();
        } catch (Exception e) {
            throw new IllegalArgumentException("Não foi possível ler o arquivo.");
        }
        if (bytes.length == 0) {
            throw new IllegalArgumentException("Arquivo vazio.");
        }

        String nomeDrive = montarNomeArquivoDrive(phone, validation.normalizedMime());
        String pastaId;
        try {
            pastaId = resolverPastaFotos();
        } catch (Exception e) {
            throw new IllegalStateException("Falha ao resolver pasta de fotos no Drive.");
        }

        DriveArquivoDto uploaded =
                googleDriveService.uploadArquivo(bytes, nomeDrive, validation.normalizedMime(), pastaId);
        if (uploaded == null || !StringUtils.hasText(uploaded.id())) {
            throw new IllegalStateException("Falha ao enviar foto para o Drive.");
        }

        contactPhotoRepository.upsert(
                phone,
                uploaded.id(),
                StringUtils.hasText(uploaded.webViewLink()) ? uploaded.webViewLink() : null,
                Instant.now());
        return WhatsAppContactPhotoSupport.proxyUrl(phone);
    }

    @Transactional
    public void removerFoto(String phoneRaw) {
        String phone = WhatsAppService.formatPhoneNumber(phoneRaw);
        contactPhotoRepository.deleteByPhoneNumber(phone);
    }

    @Transactional(readOnly = true)
    public Optional<WhatsAppContactPhotoEntity> buscarPorTelefone(String phoneRaw) {
        String phone = WhatsAppService.formatPhoneNumber(phoneRaw);
        return contactPhotoRepository.findById(phone);
    }

    /**
     * URLs de proxy por telefone canônico — apenas telefones com foto entram no mapa (batch, uma query).
     */
    @Transactional(readOnly = true)
    public Map<String, String> resolverUrlsPorTelefone(List<String> telefones) {
        Map<String, String> out = new LinkedHashMap<>();
        if (telefones == null || telefones.isEmpty()) {
            return out;
        }

        Set<String> canonicals = new LinkedHashSet<>();
        for (String raw : telefones) {
            if (!StringUtils.hasText(raw)) {
                continue;
            }
            try {
                canonicals.add(WhatsAppService.formatPhoneNumber(raw));
            } catch (IllegalArgumentException ignored) {
                // telefone inválido na listagem — ignora
            }
        }
        if (canonicals.isEmpty()) {
            return out;
        }

        List<WhatsAppContactPhotoEntity> rows =
                contactPhotoRepository.findByPhoneNumberIn(new ArrayList<>(canonicals));
        for (WhatsAppContactPhotoEntity row : rows) {
            if (StringUtils.hasText(row.getDriveFileId())) {
                out.put(row.getPhoneNumber(), WhatsAppContactPhotoSupport.proxyUrl(row.getPhoneNumber()));
            }
        }
        return out;
    }

    public static String resolverDriveFileId(WhatsAppContactPhotoEntity entity) {
        if (entity == null) {
            return null;
        }
        return WhatsAppDriveFileIdUtil.resolverFileId(entity.getDriveFileId(), entity.getDriveUrl());
    }

    private String resolverPastaFotos() throws Exception {
        String rootId = googleDriveService.getRootFolderId();
        String whatsAppFolderId = googleDriveService.encontrarOuCriarPastaPublic(PASTA_WHATSAPP, rootId);
        return googleDriveService.encontrarOuCriarPastaPublic(PASTA_FOTOS, whatsAppFolderId);
    }

    static String montarNomeArquivoDrive(String phone, String mime) {
        String ext = "image/png".equals(mime) ? "png" : "jpg";
        return "foto_" + phone + "." + ext;
    }
}
