package br.com.vilareal.documento;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.ByteArrayContent;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.DriveList;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.util.List;

@Service
public class GoogleDriveService {

    private static final Logger log = LoggerFactory.getLogger(GoogleDriveService.class);

    private final String credentialsFile;
    private final String rootFolderName;

    private Drive driveService;
    private String rootFolderId;

    public GoogleDriveService(
            @Value("${google.drive.credentials-file}") String credentialsFile,
            @Value("${google.drive.root-folder-name}") String rootFolderName) {
        this.credentialsFile = credentialsFile;
        this.rootFolderName = rootFolderName;
    }

    @PostConstruct
    public void init() {
        try {
            String classpathPath = credentialsFile.replace("classpath:", "");
            Resource resource = new ClassPathResource(classpathPath);
            if (!resource.exists()) {
                log.warn("Google Drive não configurado: arquivo {} não encontrado", classpathPath);
                return;
            }

            try (InputStream inputStream = resource.getInputStream()) {
                GoogleCredentials credentials = GoogleCredentials.fromStream(inputStream)
                        .createScoped(List.of("https://www.googleapis.com/auth/drive"));
                HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(credentials);

                driveService = new Drive.Builder(
                                GoogleNetHttpTransport.newTrustedTransport(),
                                GsonFactory.getDefaultInstance(),
                                requestInitializer)
                        .setApplicationName("VilaReal API")
                        .build();
            }

            DriveList driveList = driveService.drives()
                    .list()
                    .setQ("name = '" + escaparQueryDrive(rootFolderName) + "'")
                    .execute();

            if (driveList.getDrives() != null && !driveList.getDrives().isEmpty()) {
                rootFolderId = driveList.getDrives().get(0).getId();
                log.info("Google Drive configurado. Shared Drive: {} ({})", rootFolderName, rootFolderId);
            } else {
                rootFolderId = encontrarOuCriarPastaPublic(rootFolderName, null);
                log.info("Google Drive configurado. Pasta raiz: {} ({})", rootFolderName, rootFolderId);
            }
        } catch (Exception e) {
            log.warn("Google Drive não configurado: {}", e.getMessage());
        }
    }

    public boolean isConfigurado() {
        return driveService != null && rootFolderId != null;
    }

    public String getRootFolderId() {
        return rootFolderId;
    }

    public String salvarPdfEmPasta(byte[] pdfBytes, String nomeArquivo, String pastaId) {
        if (!isConfigurado() || pastaId == null || pastaId.isBlank()) {
            return null;
        }
        if (pdfBytes == null || pdfBytes.length == 0) {
            return null;
        }

        try {
            File fileMetadata = new File();
            fileMetadata.setName(sanitizarNomeArquivo(nomeArquivo));
            fileMetadata.setParents(List.of(pastaId));
            fileMetadata.setMimeType("application/pdf");

            ByteArrayContent content = new ByteArrayContent("application/pdf", pdfBytes);

            File uploadedFile = driveService.files()
                    .create(fileMetadata, content)
                    .setFields("id, name, webViewLink, webContentLink")
                    .setSupportsAllDrives(true)
                    .execute();

            log.info("PDF salvo no Google Drive: {} → {}", nomeArquivo, uploadedFile.getWebViewLink());
            return uploadedFile.getWebViewLink();
        } catch (Exception e) {
            log.warn("Erro ao salvar no Google Drive: {}", e.getMessage());
            return null;
        }
    }

    public String encontrarPastaExistente(String nomePasta, String parentId) throws Exception {
        if (!isConfigurado()) {
            return null;
        }
        String nomeSanitizado = sanitizarNomePasta(nomePasta);
        String query = "name = '" + escaparQueryDrive(nomeSanitizado) + "' "
                + "and mimeType = 'application/vnd.google-apps.folder' "
                + "and trashed = false";
        if (parentId != null) {
            query += " and '" + parentId + "' in parents";
        }

        FileList result = driveService.files()
                .list()
                .setQ(query)
                .setSpaces("drive")
                .setFields("files(id, name)")
                .setPageSize(1)
                .setSupportsAllDrives(true)
                .setIncludeItemsFromAllDrives(true)
                .execute();

        if (result.getFiles() != null && !result.getFiles().isEmpty()) {
            return result.getFiles().get(0).getId();
        }
        return null;
    }

    public List<File> listarSubpastas(String parentId) throws Exception {
        if (!isConfigurado() || parentId == null || parentId.isBlank()) {
            return List.of();
        }
        String query = "'" + parentId + "' in parents "
                + "and mimeType = 'application/vnd.google-apps.folder' "
                + "and trashed = false";
        FileList result = driveService.files()
                .list()
                .setQ(query)
                .setSpaces("drive")
                .setFields("files(id, name)")
                .setSupportsAllDrives(true)
                .setIncludeItemsFromAllDrives(true)
                .execute();
        return result.getFiles() != null ? result.getFiles() : List.of();
    }

    public void renomearPasta(String fileId, String novoNome) throws Exception {
        if (!isConfigurado() || fileId == null || fileId.isBlank()) {
            return;
        }
        File fileMetadata = new File();
        fileMetadata.setName(sanitizarNomePasta(novoNome));
        driveService.files()
                .update(fileId, fileMetadata)
                .setSupportsAllDrives(true)
                .execute();
    }

    public List<DriveArquivoDto> listarConteudo(String pastaId) {
        if (!isConfigurado() || pastaId == null || pastaId.isBlank()) {
            return List.of();
        }
        try {
            String query = "'" + pastaId + "' in parents and trashed = false";
            FileList result = driveService.files()
                    .list()
                    .setQ(query)
                    .setSpaces("drive")
                    .setFields(
                            "files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink)")
                    .setOrderBy("folder,name")
                    .setSupportsAllDrives(true)
                    .setIncludeItemsFromAllDrives(true)
                    .setPageSize(100)
                    .execute();

            if (result.getFiles() == null || result.getFiles().isEmpty()) {
                return List.of();
            }
            return result.getFiles().stream().map(this::toDriveArquivoDto).toList();
        } catch (Exception e) {
            log.warn("Erro ao listar conteúdo no Drive: {}", e.getMessage());
            return List.of();
        }
    }

    public DriveArquivoDto uploadArquivo(
            byte[] bytes, String nomeOriginal, String contentType, String pastaId) {
        if (!isConfigurado() || pastaId == null || pastaId.isBlank()) {
            return null;
        }
        if (bytes == null || bytes.length == 0) {
            return null;
        }

        try {
            String nome = sanitizarNomeArquivoGenerico(nomeOriginal);
            String mimeType = StringUtils.hasText(contentType) ? contentType : "application/octet-stream";

            File fileMetadata = new File();
            fileMetadata.setName(nome);
            fileMetadata.setParents(List.of(pastaId));
            if (!"application/vnd.google-apps.folder".equals(mimeType)) {
                fileMetadata.setMimeType(mimeType);
            }

            ByteArrayContent content = new ByteArrayContent(mimeType, bytes);

            File uploadedFile = driveService.files()
                    .create(fileMetadata, content)
                    .setFields("id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink")
                    .setSupportsAllDrives(true)
                    .execute();

            log.info("Arquivo salvo no Google Drive: {} → {}", nome, uploadedFile.getWebViewLink());
            return toDriveArquivoDto(uploadedFile);
        } catch (Exception e) {
            log.warn("Erro ao enviar arquivo ao Google Drive: {}", e.getMessage());
            return null;
        }
    }

    public String obterWebViewLink(String fileId) {
        if (!isConfigurado() || fileId == null || fileId.isBlank()) {
            return null;
        }
        try {
            File file = driveService.files()
                    .get(fileId)
                    .setFields("webViewLink")
                    .setSupportsAllDrives(true)
                    .execute();
            return file.getWebViewLink();
        } catch (Exception e) {
            log.warn("Erro ao obter link do Drive: {}", e.getMessage());
            return null;
        }
    }

    public String obterNomeArquivo(String fileId) {
        if (!isConfigurado() || fileId == null || fileId.isBlank()) {
            return null;
        }
        try {
            File file = driveService.files()
                    .get(fileId)
                    .setFields("name")
                    .setSupportsAllDrives(true)
                    .execute();
            return file.getName();
        } catch (Exception e) {
            log.warn("Erro ao obter nome no Drive: {}", e.getMessage());
            return null;
        }
    }

    public String encontrarOuCriarPastaPublic(String nomePasta, String parentId) throws Exception {
        String existente = encontrarPastaExistente(nomePasta, parentId);
        if (existente != null) {
            return existente;
        }

        String nomeSanitizado = sanitizarNomePasta(nomePasta);
        File folderMetadata = new File();
        folderMetadata.setName(nomeSanitizado);
        folderMetadata.setMimeType("application/vnd.google-apps.folder");
        if (parentId != null) {
            folderMetadata.setParents(List.of(parentId));
        }

        File folder = driveService.files()
                .create(folderMetadata)
                .setFields("id")
                .setSupportsAllDrives(true)
                .execute();

        return folder.getId();
    }

    private static String escaparQueryDrive(String valor) {
        return valor.replace("'", "\\'");
    }

    static String sanitizarNomePasta(String nome) {
        if (nome == null || nome.isBlank()) {
            return "Sem Cliente";
        }
        return nome.trim().replaceAll("[\\\\/:*?\"<>|]", " ").replaceAll("\\s+", " ");
    }

    static String sanitizarNomeArquivo(String nome) {
        if (nome == null || nome.isBlank()) {
            return "documento.pdf";
        }
        String sanitizado = nome.trim().replaceAll("[\\\\/:*?\"<>|]", " ").replaceAll("\\s+", " ");
        return sanitizado.endsWith(".pdf") ? sanitizado : sanitizado + ".pdf";
    }

    static String sanitizarNomeArquivoGenerico(String nome) {
        if (nome == null || nome.isBlank()) {
            return "arquivo";
        }
        return nome.trim().replaceAll("[\\\\/:*?\"<>|]", " ").replaceAll("\\s+", " ");
    }

    private DriveArquivoDto toDriveArquivoDto(File f) {
        boolean pasta = "application/vnd.google-apps.folder".equals(f.getMimeType());
        return new DriveArquivoDto(
                f.getId(),
                f.getName(),
                pasta ? "pasta" : "arquivo",
                f.getMimeType(),
                f.getSize(),
                f.getModifiedTime() != null ? f.getModifiedTime().toString() : null,
                f.getWebViewLink(),
                f.getWebContentLink(),
                f.getIconLink());
    }
}
