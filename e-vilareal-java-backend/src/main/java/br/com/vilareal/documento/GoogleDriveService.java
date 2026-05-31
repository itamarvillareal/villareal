package br.com.vilareal.documento;

import com.google.api.client.googleapis.javanet.GoogleNetHttpTransport;
import com.google.api.client.http.ByteArrayContent;
import com.google.api.client.http.HttpRequestInitializer;
import com.google.api.client.json.gson.GsonFactory;
import com.google.api.services.drive.Drive;
import com.google.api.services.drive.model.DriveList;
import com.google.api.services.drive.model.File;
import com.google.api.services.drive.model.FileList;
import com.google.api.services.drive.model.User;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import com.google.auth.http.HttpCredentialsAdapter;
import com.google.auth.oauth2.GoogleCredentials;
import com.google.auth.oauth2.ServiceAccountCredentials;
import jakarta.annotation.PostConstruct;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
public class GoogleDriveService {

    private static final Logger log = LoggerFactory.getLogger(GoogleDriveService.class);

    private static final List<String> DRIVE_SCOPES = List.of("https://www.googleapis.com/auth/drive");

    private final String credentialsFile;
    private final String rootFolderName;
    private final String rootFolderIdConfig;
    private final String clientesPath;
    private final String impersonateUser;

    private Drive driveService;
    private String rootFolderId;
    private String clientesFolderId;

    public GoogleDriveService(
            @Value("${google.drive.credentials-file}") String credentialsFile,
            @Value("${google.drive.root-folder-name}") String rootFolderName,
            @Value("${google.drive.root-folder-id:}") String rootFolderIdConfig,
            @Value("${google.drive.clientes-path:}") String clientesPath,
            @Value("${google.drive.impersonate-user:}") String impersonateUser) {
        this.credentialsFile = credentialsFile;
        this.rootFolderName = rootFolderName;
        this.rootFolderIdConfig = rootFolderIdConfig;
        this.clientesPath = clientesPath;
        this.impersonateUser = impersonateUser;
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
                        .createScoped(DRIVE_SCOPES);
                if (StringUtils.hasText(impersonateUser)) {
                    if (credentials instanceof ServiceAccountCredentials serviceAccount) {
                        credentials = serviceAccount.createDelegated(impersonateUser.trim());
                        log.info("Google Drive: impersonando {}", impersonateUser.trim());
                    } else {
                        log.warn(
                                "Google Drive: google.drive.impersonate-user definido, mas credencial não é "
                                        + "service account — impersonação ignorada.");
                    }
                } else {
                    log.info("Google Drive: sem impersonação (service account direta)");
                }
                HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(credentials);

                driveService = new Drive.Builder(
                                GoogleNetHttpTransport.newTrustedTransport(),
                                GsonFactory.getDefaultInstance(),
                                requestInitializer)
                        .setApplicationName("VilaReal API")
                        .build();
            }

            if (StringUtils.hasText(rootFolderIdConfig)) {
                rootFolderId = rootFolderIdConfig.trim();
                String nomeRaiz = obterNomeArquivo(rootFolderId);
                log.info("Google Drive configurado. Pasta raiz fixada por ID: {} ({})",
                        nomeRaiz != null ? nomeRaiz : rootFolderName, rootFolderId);
            } else {
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
            }

            // Resolver subpasta base de clientes (ex.: clientes / 01 - Ativos) dentro da raiz.
            if (StringUtils.hasText(clientesPath)) {
                String pastaAtual = rootFolderId;
                for (String parte : clientesPath.split("/")) {
                    if (StringUtils.hasText(parte)) {
                        pastaAtual = encontrarOuCriarPastaPublic(parte.trim(), pastaAtual);
                    }
                }
                clientesFolderId = pastaAtual;
                log.info("Google Drive pasta de clientes: {} ({})", clientesPath, clientesFolderId);
            } else {
                clientesFolderId = rootFolderId;
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

    public String getClientesFolderId() {
        return clientesFolderId != null ? clientesFolderId : rootFolderId;
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

        // Fallback: a busca exata do Drive (name =) só casa maiúsc./minúsc. para ASCII e falha
        // com acentos (ex.: "CONDOMÍNIO" x "Condomínio"). As pastas migradas usam MAIÚSCULAS,
        // enquanto o app normaliza para Title Case. Para reaproveitar a pasta existente (e não
        // criar duplicatas vazias), comparamos os filhos do parent de forma insensível a
        // caixa e acentos.
        if (parentId != null) {
            return encontrarPastaPorNomeNormalizado(nomeSanitizado, parentId);
        }
        return null;
    }

    private String encontrarPastaPorNomeNormalizado(String nomeSanitizado, String parentId)
            throws Exception {
        String alvo = normalizarChaveNome(nomeSanitizado);
        String pageToken = null;
        do {
            FileList result = driveService.files()
                    .list()
                    .setQ("'" + parentId + "' in parents "
                            + "and mimeType = 'application/vnd.google-apps.folder' "
                            + "and trashed = false")
                    .setSpaces("drive")
                    .setFields("nextPageToken, files(id, name)")
                    .setPageSize(1000)
                    .setSupportsAllDrives(true)
                    .setIncludeItemsFromAllDrives(true)
                    .setPageToken(pageToken)
                    .execute();
            if (result.getFiles() != null) {
                for (File f : result.getFiles()) {
                    if (alvo.equals(normalizarChaveNome(f.getName()))) {
                        return f.getId();
                    }
                }
            }
            pageToken = result.getNextPageToken();
        } while (pageToken != null);
        return null;
    }

    static String normalizarChaveNome(String nome) {
        if (nome == null) {
            return "";
        }
        String nfd = java.text.Normalizer.normalize(nome.trim(), java.text.Normalizer.Form.NFD);
        return nfd.replaceAll("\\p{M}+", "")
                .replaceAll("\\s+", " ")
                .toUpperCase(java.util.Locale.ROOT);
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

    /** Lista todos os filhos (pastas e arquivos) de uma pasta, com paginação. */
    public List<File> listarFilhos(String parentId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(parentId)) {
            return List.of();
        }
        List<File> todos = new java.util.ArrayList<>();
        String pageToken = null;
        do {
            FileList result = driveService.files()
                    .list()
                    .setQ("'" + parentId + "' in parents and trashed = false")
                    .setSpaces("drive")
                    .setFields("nextPageToken, files(id, name, mimeType, parents)")
                    .setPageSize(1000)
                    .setSupportsAllDrives(true)
                    .setIncludeItemsFromAllDrives(true)
                    .setPageToken(pageToken)
                    .execute();
            if (result.getFiles() != null) {
                todos.addAll(result.getFiles());
            }
            pageToken = result.getNextPageToken();
        } while (pageToken != null);
        return todos;
    }

    public boolean isPasta(File f) {
        return f != null && "application/vnd.google-apps.folder".equals(f.getMimeType());
    }

    public int contarFilhos(String parentId) throws Exception {
        return listarFilhos(parentId).size();
    }

    /** Envia a pasta/arquivo para a lixeira (reversível). */
    public void enviarParaLixeira(String fileId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(fileId)) {
            return;
        }
        File metadata = new File();
        metadata.setTrashed(true);
        driveService.files()
                .update(fileId, metadata)
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

    /** Verifica se já existe arquivo (não pasta) com o mesmo nome na pasta de destino. */
    public boolean existeArquivoComNomeNaPasta(String pastaId, String nomeArquivo) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(pastaId) || !StringUtils.hasText(nomeArquivo)) {
            return false;
        }
        String nome = sanitizarNomeArquivoGenerico(nomeArquivo);
        String query = "'" + pastaId + "' in parents "
                + "and name = '" + escaparQueryDrive(nome) + "' "
                + "and mimeType != 'application/vnd.google-apps.folder' "
                + "and trashed = false";
        FileList result = driveService.files()
                .list()
                .setQ(query)
                .setSpaces("drive")
                .setFields("files(id)")
                .setPageSize(1)
                .setSupportsAllDrives(true)
                .setIncludeItemsFromAllDrives(true)
                .execute();
        return result.getFiles() != null && !result.getFiles().isEmpty();
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

    /**
     * Retorna a pasta e seu pai imediato para navegação no painel. O pai é nulo quando a pasta
     * é a raiz de clientes ou a raiz do sistema (fronteira de navegação) — evita subir para fora
     * da árvore do escritório.
     */
    public DrivePastaInfoDto obterInfoPasta(String pastaId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(pastaId)) {
            return null;
        }
        File f = driveService.files()
                .get(pastaId)
                .setFields("id, name, parents")
                .setSupportsAllDrives(true)
                .execute();
        String paiId = null;
        String paiNome = null;
        boolean naFronteira = pastaId.equals(getClientesFolderId()) || pastaId.equals(rootFolderId);
        if (!naFronteira && f.getParents() != null && !f.getParents().isEmpty()) {
            try {
                File pai = driveService.files()
                        .get(f.getParents().get(0))
                        .setFields("id, name")
                        .setSupportsAllDrives(true)
                        .execute();
                paiId = pai.getId();
                paiNome = pai.getName();
            } catch (Exception ignore) {
                // pai inacessível: trata como fronteira
            }
        }
        return new DrivePastaInfoDto(f.getId(), f.getName(), paiId, paiNome);
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

    /** Substitui o conteúdo binário de um arquivo existente (mantém fileId e nome). */
    public void atualizarConteudoArquivo(String fileId, byte[] bytes, String contentType) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(fileId)) {
            throw new IllegalStateException("Google Drive não configurado ou fileId vazio");
        }
        if (bytes == null || bytes.length == 0) {
            throw new IllegalArgumentException("conteúdo vazio");
        }
        String mimeType = StringUtils.hasText(contentType) ? contentType : "application/octet-stream";
        ByteArrayContent content = new ByteArrayContent(mimeType, bytes);
        driveService.files()
                .update(fileId, new File(), content)
                .setSupportsAllDrives(true)
                .execute();
        log.info("Conteúdo atualizado no Google Drive: fileId={} ({} bytes)", fileId, bytes.length);
    }

    /** Baixa o conteúdo binário de um arquivo (não pasta) do Drive. */
    public byte[] baixarBytesArquivo(String fileId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(fileId)) {
            throw new IllegalStateException("Google Drive não configurado ou fileId vazio");
        }
        try (java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            driveService.files()
                    .get(fileId)
                    .setSupportsAllDrives(true)
                    .executeMediaAndDownloadTo(out);
            return out.toByteArray();
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

    private static final String DRIVE_FILE_DIAG_FIELDS =
            "id,name,driveId,teamDriveId,ownedByMe,owners(emailAddress,displayName),parents,"
                    + "capabilities(canAddChildren,canDelete,canEdit)";

    /** IDs fixos para diagnóstico TEMP (endpoint /api/projudi/admin/drive-diag). */
    private static final String DIAG_RAIZ_SISTEMA_VILAREAL_ID = "1TE5a0t0ur5EWRszj_IBjS0eXSNPHF_F-";
    private static final String DIAG_PASTA_FOLHA_PROCESSO_TESTE_ID = "1CxHD2MwxdT3i7zPWA65dRI4EOf6Nm144";

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

    /**
     * TEMP — diagnóstico Drive API com a mesma credencial/cliente HTTP deste serviço.
     * Não altera fluxo de produção.
     */
    public Map<String, Object> executarDiagnosticoDriveApi() {
        Map<String, Object> out = new LinkedHashMap<>();
        Map<String, Object> auth = montarAutenticacaoDrive();
        out.put("autenticacaoDrive", auth);
        out.put("configurado", isConfigurado());

        if (!isConfigurado()) {
            out.put("erro", "Google Drive não configurado (driveService ou rootFolderId ausente).");
            out.put("interpretacao", "Drive indisponível — não foi possível consultar a API.");
            return out;
        }

        Map<String, Object> pastas = new LinkedHashMap<>();
        pastas.put("raizSistemaVilaReal", obterMetadadosArquivoDiagnostico(DIAG_RAIZ_SISTEMA_VILAREAL_ID));
        pastas.put("pastaFolhaProcessoTeste", obterMetadadosArquivoDiagnostico(DIAG_PASTA_FOLHA_PROCESSO_TESTE_ID));
        out.put("pastas", pastas);
        out.put("sharedDrives", listarSharedDrivesDiagnostico());
        out.put("interpretacao", interpretarDiagnosticoDrive(pastas, auth));
        return out;
    }

    private Map<String, Object> montarAutenticacaoDrive() {
        Map<String, Object> auth = new LinkedHashMap<>();
        auth.put("tipoCredencial", "service_account");
        auth.put("credentialsFileConfig", credentialsFile);
        auth.put("escoposDrive", DRIVE_SCOPES);
        auth.put("domainWideDelegation", StringUtils.hasText(impersonateUser));
        auth.put("subjectImpersonacao", StringUtils.hasText(impersonateUser) ? impersonateUser.trim() : null);

        try {
            String classpathPath = credentialsFile.replace("classpath:", "");
            Resource resource = new ClassPathResource(classpathPath);
            auth.put("credentialsFileResolvido", resource.getURI().toString());
            if (!resource.exists()) {
                auth.put("erroLeitura", "Arquivo de credenciais não encontrado: " + classpathPath);
                return auth;
            }
            try (InputStream inputStream = resource.getInputStream();
                 InputStreamReader reader = new InputStreamReader(inputStream, StandardCharsets.UTF_8)) {
                JsonObject json = JsonParser.parseReader(reader).getAsJsonObject();
                auth.put("clientEmail", json.has("client_email") ? json.get("client_email").getAsString() : null);
                auth.put("clientId", json.has("client_id") ? json.get("client_id").getAsString() : null);
                auth.put("projectId", json.has("project_id") ? json.get("project_id").getAsString() : null);
            }
        } catch (Exception e) {
            auth.put("erroLeitura", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        return auth;
    }

    private Map<String, Object> obterMetadadosArquivoDiagnostico(String fileId) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("idConsultado", fileId);
        try {
            File f = driveService.files()
                    .get(fileId)
                    .setSupportsAllDrives(true)
                    .setFields(DRIVE_FILE_DIAG_FIELDS)
                    .execute();
            item.putAll(mapearFileDiagnostico(f));
        } catch (Exception e) {
            item.put("erro", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        return item;
    }

    private static Map<String, Object> mapearFileDiagnostico(File f) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", f.getId());
        m.put("name", f.getName());
        m.put("driveId", f.getDriveId());
        m.put("teamDriveId", f.getTeamDriveId());
        m.put("ownedByMe", f.getOwnedByMe());
        m.put("owners", mapearOwners(f.getOwners()));
        m.put("parents", f.getParents());
        m.put("capabilities", mapearCapabilities(f.getCapabilities()));
        return m;
    }

    private static List<Map<String, String>> mapearOwners(List<User> owners) {
        if (owners == null || owners.isEmpty()) {
            return List.of();
        }
        List<Map<String, String>> out = new ArrayList<>();
        for (User owner : owners) {
            Map<String, String> o = new LinkedHashMap<>();
            o.put("email", owner.getEmailAddress());
            o.put("displayName", owner.getDisplayName());
            out.add(o);
        }
        return out;
    }

    private static Map<String, Boolean> mapearCapabilities(File.Capabilities capabilities) {
        if (capabilities == null) {
            return Map.of();
        }
        Map<String, Boolean> caps = new LinkedHashMap<>();
        caps.put("canAddChildren", capabilities.getCanAddChildren());
        caps.put("canDelete", capabilities.getCanDelete());
        caps.put("canEdit", capabilities.getCanEdit());
        return caps;
    }

    private List<Map<String, String>> listarSharedDrivesDiagnostico() {
        try {
            DriveList driveList = driveService.drives()
                    .list()
                    .setPageSize(100)
                    .setFields("drives(id,name)")
                    .execute();
            if (driveList.getDrives() == null || driveList.getDrives().isEmpty()) {
                return List.of();
            }
            List<Map<String, String>> drives = new ArrayList<>();
            for (com.google.api.services.drive.model.Drive shared : driveList.getDrives()) {
                Map<String, String> d = new LinkedHashMap<>();
                d.put("id", shared.getId());
                d.put("name", shared.getName());
                drives.add(d);
            }
            return drives;
        } catch (Exception e) {
            Map<String, String> err = new LinkedHashMap<>();
            err.put("erro", e.getClass().getSimpleName() + ": " + e.getMessage());
            return List.of(err);
        }
    }

    @SuppressWarnings("unchecked")
    private static String interpretarDiagnosticoDrive(Map<String, Object> pastas, Map<String, Object> auth) {
        Map<String, Object> raiz = (Map<String, Object>) pastas.get("raizSistemaVilaReal");
        if (raiz == null || raiz.containsKey("erro")) {
            return "Não foi possível ler a raiz — ver campo pastas.raizSistemaVilaReal.erro.";
        }

        String clientEmail = auth.get("clientEmail") != null ? String.valueOf(auth.get("clientEmail")) : "(desconhecido)";
        String driveId = raiz.get("driveId") != null ? String.valueOf(raiz.get("driveId")) : null;
        List<Map<String, String>> owners = (List<Map<String, String>>) raiz.get("owners");
        String ownerEmails = owners == null || owners.isEmpty()
                ? "(sem owners na resposta)"
                : owners.stream()
                        .map(o -> o.getOrDefault("email", "?"))
                        .reduce((a, b) -> a + ", " + b)
                        .orElse("(vazio)");

        if (StringUtils.hasText(driveId)) {
            return "Raiz em Drive compartilhado (Shared Drive): driveId="
                    + driveId
                    + ". A credencial ("
                    + clientEmail
                    + ") opera com permissões nesse Shared Drive; owners="
                    + ownerEmails
                    + ".";
        }
        return "Raiz no Meu Drive de usuário (sem driveId): dono(s)="
                + ownerEmails
                + ". Upload via service account ("
                + clientEmail
                + ") consome cota do dono da pasta — storageQuotaExceeded indica limite desse usuário, "
                + "não da service account.";
    }
}
