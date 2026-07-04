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
import org.springframework.core.env.Environment;
import org.springframework.core.io.ClassPathResource;
import org.springframework.core.io.Resource;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.Comparator;
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
    private final String sharedDriveIdConfig;
    private final String clientesPath;
    private final String pessoasFolderName;
    private final String imoveisFolderName;
    private final String impersonateUser;
    private final Environment environment;

    private Drive driveService;
    private String sharedDriveId;
    private String rootFolderId;
    private String clientesFolderId;
    private String pessoasFolderId;
    private String imoveisFolderId;

    public GoogleDriveService(
            @Value("${google.drive.credentials-file}") String credentialsFile,
            @Value("${google.drive.root-folder-name}") String rootFolderName,
            @Value("${google.drive.root-folder-id:}") String rootFolderIdConfig,
            @Value("${google.drive.shared-drive-id:}") String sharedDriveIdConfig,
            @Value("${google.drive.clientes-path:}") String clientesPath,
            @Value("${google.drive.pessoas-folder-name:Pessoas}") String pessoasFolderName,
            @Value("${google.drive.imoveis-folder-name:Imóveis}") String imoveisFolderName,
            @Value("${google.drive.impersonate-user:}") String impersonateUser,
            Environment environment) {
        this.credentialsFile = credentialsFile;
        this.rootFolderName = rootFolderName;
        this.rootFolderIdConfig = rootFolderIdConfig;
        this.sharedDriveIdConfig = sharedDriveIdConfig;
        this.clientesPath = clientesPath;
        this.pessoasFolderName = pessoasFolderName;
        this.imoveisFolderName = imoveisFolderName;
        this.impersonateUser = impersonateUser;
        this.environment = environment;
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
                sharedDriveId = StringUtils.hasText(sharedDriveIdConfig) ? sharedDriveIdConfig.trim() : null;
                boolean modoSharedDrive = StringUtils.hasText(sharedDriveId);

                if (modoSharedDrive) {
                    log.info("Google Drive: SHARED DRIVE {}", sharedDriveId);
                } else if (StringUtils.hasText(impersonateUser)) {
                    if (credentials instanceof ServiceAccountCredentials serviceAccount) {
                        credentials = serviceAccount.createDelegated(impersonateUser.trim());
                        log.info("Google Drive: impersonando {}", impersonateUser.trim());
                    } else {
                        log.warn(
                                "Google Drive: google.drive.impersonate-user definido, mas credencial não é "
                                        + "service account — impersonação ignorada.");
                    }
                } else {
                    log.warn(
                            "Google Drive: SA direta (SEM cota — uploads vão falhar). "
                                    + "Configure GOOGLE_DRIVE_SHARED_DRIVE_ID ou GOOGLE_DRIVE_IMPERSONATE_USER.");
                }
                validarConfiguracaoDriveProducao(modoSharedDrive);
                HttpRequestInitializer requestInitializer = new HttpCredentialsAdapter(credentials);

                driveService = new Drive.Builder(
                                GoogleNetHttpTransport.newTrustedTransport(),
                                GsonFactory.getDefaultInstance(),
                                requestInitializer)
                        .setApplicationName("VilaReal API")
                        .build();
            }

            if (StringUtils.hasText(sharedDriveId)) {
                rootFolderId = resolverPastaRaizNoSharedDrive();
            } else if (StringUtils.hasText(rootFolderIdConfig)) {
                rootFolderId = rootFolderIdConfig.trim();
                String nomeRaiz = obterNomeArquivo(rootFolderId);
                log.info("Google Drive: raiz fixada em {} ({})",
                        rootFolderId, nomeRaiz != null ? nomeRaiz : rootFolderName);
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

            // Pasta «Pessoas» na raiz (irmã de «clientes»), para documentos pessoais.
            String nomePessoas = StringUtils.hasText(pessoasFolderName) ? pessoasFolderName.trim() : "Pessoas";
            pessoasFolderId = encontrarOuCriarPastaPublic(nomePessoas, rootFolderId);
            log.info("Google Drive pasta de pessoas: {} ({})", nomePessoas, pessoasFolderId);

            // Pasta «Imóveis» na raiz (irmã de «clientes»), para documentos de imóveis.
            String nomeImoveis = StringUtils.hasText(imoveisFolderName) ? imoveisFolderName.trim() : "Imóveis";
            imoveisFolderId = encontrarOuCriarPastaPublic(nomeImoveis, rootFolderId);
            log.info("Google Drive pasta de imóveis: {} ({})", nomeImoveis, imoveisFolderId);
        } catch (IllegalStateException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Google Drive não configurado: {}", e.getMessage());
        }
    }

    /**
     * Em produção falha somente se shared-drive-id VAZIO <b>e</b> impersonate-user VAZIO.
     * Com o default 0ANU_… em application.properties / compose, prod sobe em modo Shared Drive.
     */
    private void validarConfiguracaoDriveProducao(boolean modoSharedDrive) {
        if (!isPerfilProducao()) {
            return;
        }
        if (modoSharedDrive || StringUtils.hasText(impersonateUser)) {
            return;
        }
        throw new IllegalStateException(
                "Google Drive mal configurado em produção: defina GOOGLE_DRIVE_SHARED_DRIVE_ID "
                        + "(recomendado: 0ANU_zUd2tFQ7Uk9PVA) ou GOOGLE_DRIVE_IMPERSONATE_USER no .env.docker da VPS. "
                        + "Service account sem Shared Drive nem impersonação não tem quota de armazenamento.");
    }

    private boolean usaSharedDrive() {
        return StringUtils.hasText(sharedDriveId);
    }

    /** Aplica flags obrigatórias para Shared Drives em listagens (evita pastas duplicadas). */
    private Drive.Files.List prepararListagem(Drive.Files.List request, String parentIdEscopo) {
        request.setSupportsAllDrives(true).setIncludeItemsFromAllDrives(true);
        if (usaSharedDrive()) {
            request.setCorpora("drive").setDriveId(sharedDriveId);
        }
        return request;
    }

    private Drive.Files.Get prepararGet(Drive.Files.Get request) {
        return request.setSupportsAllDrives(true);
    }

    private Drive.Files.Create prepararCreate(Drive.Files.Create request) {
        return request.setSupportsAllDrives(true);
    }

    private Drive.Files.Update prepararUpdate(Drive.Files.Update request) {
        return request.setSupportsAllDrives(true);
    }

    private boolean isPerfilProducao() {
        if (environment == null) {
            return false;
        }
        for (String perfil : environment.getActiveProfiles()) {
            if ("prod".equalsIgnoreCase(perfil)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Shared Drive: usa {@code google.drive.root-folder-id} quando definido (sem buscar/criar por nome).
     * Caso contrário, busca escopada no driveId antes de criar.
     */
    private String resolverPastaRaizNoSharedDrive() throws Exception {
        if (StringUtils.hasText(rootFolderIdConfig)) {
            String id = rootFolderIdConfig.trim();
            log.info("Google Drive: raiz fixada em {}", id);
            return id;
        }
        String existente = encontrarPastaRaizPorNomeNoSharedDrive(rootFolderName, sharedDriveId);
        if (StringUtils.hasText(existente)) {
            log.info(
                    "Google Drive: pasta raiz reutilizada no Shared Drive: {} ({})",
                    rootFolderName,
                    existente);
            return existente;
        }
        String criada = criarPasta(rootFolderName, sharedDriveId);
        log.warn(
                "Google Drive: pasta raiz criada no Shared Drive (não havia match por nome): {} ({})",
                rootFolderName,
                criada);
        return criada;
    }

    /**
     * Busca a pasta raiz por nome dentro do Shared Drive (corpora=drive, driveId escopado).
     * Evita recriar "Sistema VilaReal" a cada boot quando o ID fixo não está configurado.
     */
    private String encontrarPastaRaizPorNomeNoSharedDrive(String nomePasta, String driveId) throws Exception {
        if (!StringUtils.hasText(driveId)) {
            return null;
        }
        String nomeSanitizado = sanitizarNomePasta(nomePasta);
        String query = "'" + escaparQueryDrive(driveId) + "' in parents "
                + "and name = '" + escaparQueryDrive(nomeSanitizado) + "' "
                + "and mimeType = 'application/vnd.google-apps.folder' "
                + "and trashed = false";

        FileList result = driveService.files()
                .list()
                .setQ(query)
                .setSpaces("drive")
                .setCorpora("drive")
                .setDriveId(driveId)
                .setIncludeItemsFromAllDrives(true)
                .setSupportsAllDrives(true)
                .setFields("files(id, name)")
                .setPageSize(10)
                .execute();

        if (result.getFiles() != null && !result.getFiles().isEmpty()) {
            return result.getFiles().get(0).getId();
        }
        return encontrarPastaPorNomeNormalizado(nomeSanitizado, driveId);
    }

    private String criarPasta(String nomePasta, String parentId) throws Exception {
        String nomeSanitizado = sanitizarNomePasta(nomePasta);
        File folderMetadata = new File();
        folderMetadata.setName(nomeSanitizado);
        folderMetadata.setMimeType("application/vnd.google-apps.folder");
        if (parentId != null) {
            folderMetadata.setParents(List.of(parentId));
        }
        File folder = prepararCreate(driveService.files().create(folderMetadata).setFields("id")).execute();
        return folder.getId();
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

    /** Pasta raiz de documentos pessoais (irmã de «clientes»). */
    public String getPessoasFolderId() {
        return pessoasFolderId != null ? pessoasFolderId : rootFolderId;
    }

    /** Pasta raiz de documentos de imóveis (irmã de «clientes»). */
    public String getImoveisFolderId() {
        return imoveisFolderId != null ? imoveisFolderId : rootFolderId;
    }

    public String getSharedDriveId() {
        return sharedDriveId;
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

            File uploadedFile = prepararCreate(driveService.files()
                    .create(fileMetadata, content)
                    .setFields("id, name, webViewLink, webContentLink"))
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

        FileList result = prepararListagem(
                        driveService.files()
                                .list()
                                .setQ(query)
                                .setSpaces("drive")
                                .setFields("files(id, name)")
                                .setPageSize(1),
                        parentId)
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
            FileList result = prepararListagem(
                            driveService.files()
                                    .list()
                                    .setQ("'" + parentId + "' in parents "
                                            + "and mimeType = 'application/vnd.google-apps.folder' "
                                            + "and trashed = false")
                                    .setSpaces("drive")
                                    .setFields("nextPageToken, files(id, name)")
                                    .setPageSize(1000)
                                    .setPageToken(pageToken),
                            parentId)
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
        FileList result = prepararListagem(
                        driveService.files()
                                .list()
                                .setQ(query)
                                .setSpaces("drive")
                                .setFields("files(id, name)"),
                        parentId)
                .execute();
        return result.getFiles() != null ? result.getFiles() : List.of();
    }

    public void renomearPasta(String fileId, String novoNome) throws Exception {
        if (!isConfigurado() || fileId == null || fileId.isBlank()) {
            return;
        }
        File fileMetadata = new File();
        fileMetadata.setName(sanitizarNomePasta(novoNome));
        prepararUpdate(driveService.files().update(fileId, fileMetadata)).execute();
    }

    /** Lista todos os filhos (pastas e arquivos) de uma pasta, com paginação. */
    public List<File> listarFilhos(String parentId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(parentId)) {
            return List.of();
        }
        List<File> todos = new java.util.ArrayList<>();
        String pageToken = null;
        do {
            FileList result = prepararListagem(
                            driveService.files()
                                    .list()
                                    .setQ("'" + parentId + "' in parents and trashed = false")
                                    .setSpaces("drive")
                                    .setFields("nextPageToken, files(id, name, mimeType, parents)")
                                    .setPageSize(1000)
                                    .setPageToken(pageToken),
                            parentId)
                    .execute();
            if (result.getFiles() != null) {
                todos.addAll(result.getFiles());
            }
            pageToken = result.getNextPageToken();
        } while (pageToken != null);
        return todos;
    }

    /**
     * Lista PDFs diretos de uma pasta (não recursivo), ordenados por nome crescente, com paginação.
     */
    public List<File> listarPdfsNaPastaOrdenadosPorNome(String pastaId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(pastaId)) {
            return List.of();
        }
        List<File> todos = new ArrayList<>();
        String pageToken = null;
        String query = "'" + pastaId + "' in parents and mimeType='application/pdf' and trashed=false";
        do {
            FileList result = prepararListagem(
                            driveService.files()
                                    .list()
                                    .setQ(query)
                                    .setSpaces("drive")
                                    .setFields("nextPageToken, files(id, name, mimeType, size, modifiedTime)")
                                    .setOrderBy("name")
                                    .setPageSize(1000)
                                    .setPageToken(pageToken),
                            pastaId)
                    .execute();
            if (result.getFiles() != null) {
                todos.addAll(result.getFiles());
            }
            pageToken = result.getNextPageToken();
        } while (pageToken != null);
        todos.sort(Comparator.comparing(f -> f.getName() == null ? "" : f.getName(), String.CASE_INSENSITIVE_ORDER));
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
        prepararUpdate(driveService.files().update(fileId, metadata)).execute();
    }

    /** Remove todos os filhos imediatos da pasta (arquivos e subpastas) enviando-os à lixeira. */
    public void esvaziarPasta(String pastaId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(pastaId)) {
            return;
        }
        for (File filho : listarFilhos(pastaId)) {
            if (filho.getId() != null) {
                enviarParaLixeira(filho.getId());
            }
        }
    }

    public List<DriveArquivoDto> listarConteudo(String pastaId) {
        if (!isConfigurado() || pastaId == null || pastaId.isBlank()) {
            return List.of();
        }
        try {
            String query = "'" + pastaId + "' in parents and trashed = false";
            FileList result = prepararListagem(
                            driveService.files()
                                    .list()
                                    .setQ(query)
                                    .setSpaces("drive")
                                    .setFields(
                                            "files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink)")
                                    .setOrderBy("folder,name")
                                    .setPageSize(100),
                            pastaId)
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
        FileList result = prepararListagem(
                        driveService.files()
                                .list()
                                .setQ(query)
                                .setSpaces("drive")
                                .setFields("files(id)")
                                .setPageSize(1),
                        pastaId)
                .execute();
        return result.getFiles() != null && !result.getFiles().isEmpty();
    }

    /**
     * IDs de arquivos (não pastas) com nome exato na pasta — usado para deduplicar cópia integral PJe.
     */
    public List<String> buscarFileIdsPorNomeNaPasta(String pastaId, String nomeArquivo) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(pastaId) || !StringUtils.hasText(nomeArquivo)) {
            return List.of();
        }
        String nome = sanitizarNomeArquivoGenerico(nomeArquivo);
        String query = "'" + pastaId + "' in parents "
                + "and name = '" + escaparQueryDrive(nome) + "' "
                + "and mimeType != 'application/vnd.google-apps.folder' "
                + "and trashed = false";
        List<String> ids = new ArrayList<>();
        String pageToken = null;
        do {
            FileList result = prepararListagem(
                            driveService.files()
                                    .list()
                                    .setQ(query)
                                    .setSpaces("drive")
                                    .setFields("nextPageToken, files(id)")
                                    .setPageSize(100)
                                    .setPageToken(pageToken),
                            pastaId)
                    .execute();
            if (result.getFiles() != null) {
                for (File f : result.getFiles()) {
                    if (f.getId() != null) {
                        ids.add(f.getId());
                    }
                }
            }
            pageToken = result.getNextPageToken();
        } while (pageToken != null);
        return ids;
    }

    /**
     * Primeiro arquivo (não pasta) com nome exato na pasta — usado para deduplicar upload WhatsApp.
     */
    public DriveArquivoDto buscarArquivoPorNomeNaPasta(String pastaId, String nomeArquivo) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(pastaId) || !StringUtils.hasText(nomeArquivo)) {
            return null;
        }
        String nome = sanitizarNomeArquivoGenerico(nomeArquivo);
        String query = "'" + pastaId + "' in parents "
                + "and name = '" + escaparQueryDrive(nome) + "' "
                + "and mimeType != 'application/vnd.google-apps.folder' "
                + "and trashed = false";
        FileList result = prepararListagem(
                        driveService.files()
                                .list()
                                .setQ(query)
                                .setSpaces("drive")
                                .setFields(
                                        "files(id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink)")
                                .setPageSize(1),
                        pastaId)
                .execute();
        if (result.getFiles() == null || result.getFiles().isEmpty()) {
            return null;
        }
        return toDriveArquivoDto(result.getFiles().getFirst());
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

            File uploadedFile = prepararCreate(driveService.files()
                    .create(fileMetadata, content)
                    .setFields("id, name, mimeType, size, modifiedTime, webViewLink, webContentLink, iconLink"))
                    .execute();

            log.info("Arquivo salvo no Google Drive: {} → {}", nome, uploadedFile.getWebViewLink());
            return toDriveArquivoDto(uploadedFile);
        } catch (Exception e) {
            String msg = e.getMessage() != null ? e.getMessage() : e.getClass().getSimpleName();
            if (msg.toLowerCase().contains("storagequotaexceeded")
                    || msg.toLowerCase().contains("storage quota")) {
                log.error(
                        "Google Drive sem quota para upload (arquivo={}, pasta={}): {}",
                        nomeOriginal,
                        pastaId,
                        msg);
            } else {
                log.warn("Erro ao enviar arquivo ao Google Drive ({}): {}", nomeOriginal, msg);
            }
            return null;
        }
    }

    public String obterWebViewLink(String fileId) {
        if (!isConfigurado() || fileId == null || fileId.isBlank()) {
            return null;
        }
        try {
            File file = prepararGet(driveService.files().get(fileId).setFields("webViewLink")).execute();
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
        File f = prepararGet(driveService.files().get(pastaId).setFields("id, name, parents")).execute();
        String paiId = null;
        String paiNome = null;
        boolean naFronteira = pastaId.equals(getClientesFolderId()) || pastaId.equals(rootFolderId);
        if (!naFronteira && f.getParents() != null && !f.getParents().isEmpty()) {
            try {
                File pai = prepararGet(driveService.files()
                                .get(f.getParents().get(0))
                                .setFields("id, name"))
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
            File file = prepararGet(driveService.files().get(fileId).setFields("name")).execute();
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
        prepararUpdate(driveService.files().update(fileId, new File(), content)).execute();
        log.info("Conteúdo atualizado no Google Drive: fileId={} ({} bytes)", fileId, bytes.length);
    }

    /** Baixa o conteúdo binário de um arquivo (não pasta) do Drive. */
    public byte[] baixarBytesArquivo(String fileId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(fileId)) {
            throw new IllegalStateException("Google Drive não configurado ou fileId vazio");
        }
        try (java.io.ByteArrayOutputStream out = new java.io.ByteArrayOutputStream()) {
            prepararGet(driveService.files().get(fileId)).executeMediaAndDownloadTo(out);
            return out.toByteArray();
        }
    }

    private static final String DRIVE_CHILDREN_FIELDS =
            "nextPageToken, files(id, name, mimeType, size, modifiedTime, md5Checksum, parents)";

    /** Metadados de um arquivo (não pasta) — endpoints TEMP de extração de texto. */
    public DriveArquivoMetadados obterMetadadosArquivo(String fileId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(fileId)) {
            throw new IllegalStateException("Google Drive não configurado ou fileId vazio");
        }
        File f = prepararGet(driveService.files()
                        .get(fileId)
                        .setFields("id, name, mimeType, size, modifiedTime, md5Checksum"))
                .execute();
        if (isPasta(f)) {
            throw new IllegalArgumentException("fileId aponta para pasta, não arquivo");
        }
        return new DriveArquivoMetadados(
                f.getId(),
                f.getName(),
                f.getMimeType(),
                f.getSize(),
                f.getModifiedTime() != null ? f.getModifiedTime().toString() : null,
                f.getMd5Checksum());
    }

    /** Filhos com metadados completos (incl. md5Checksum) — listagem recursiva TEMP. */
    public List<File> listarFilhosComMetadados(String parentId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(parentId)) {
            return List.of();
        }
        List<File> todos = new ArrayList<>();
        String pageToken = null;
        do {
            FileList result = prepararListagem(
                            driveService.files()
                                    .list()
                                    .setQ("'" + parentId + "' in parents and trashed = false")
                                    .setSpaces("drive")
                                    .setFields(DRIVE_CHILDREN_FIELDS)
                                    .setPageSize(1000)
                                    .setPageToken(pageToken),
                            parentId)
                    .execute();
            if (result.getFiles() != null) {
                todos.addAll(result.getFiles());
            }
            pageToken = result.getNextPageToken();
        } while (pageToken != null);
        return todos;
    }

    public record DriveArquivoMetadados(
            String fileId, String nome, String mimeType, Long tamanho, String modifiedTime, String md5Checksum) {}

    /**
     * Envia para a lixeira todas as subpastas com o nome informado (conteúdo incluído).
     * Não cria pasta substituta.
     */
    public int excluirSubpastasComNome(String nomePasta, String parentId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(parentId)) {
            return 0;
        }
        String alvo = normalizarChaveNome(sanitizarNomePasta(nomePasta));
        int removidas = 0;
        for (File f : listarSubpastas(parentId)) {
            if (f.getId() != null && normalizarChaveNome(f.getName()).equals(alvo)) {
                enviarParaLixeira(f.getId());
                removidas++;
            }
        }
        return removidas;
    }

    /** Remove subpastas com o nome informado e cria uma pasta nova vazia com esse nome. */
    public String recriarSubpasta(String nomePasta, String parentId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(parentId)) {
            return null;
        }
        excluirSubpastasComNome(nomePasta, parentId);

        // Após enviar à lixeira, o índice do Drive pode demorar a refletir a exclusão.
        // Tentamos criar uma pasta nova com backoff; se ainda existir cópia antiga, removemos de novo.
        Exception ultimoErro = null;
        for (int tentativa = 1; tentativa <= 4; tentativa++) {
            try {
                String existente = encontrarPastaExistente(nomePasta, parentId);
                if (existente != null) {
                    enviarParaLixeira(existente);
                    aguardarPropagacaoDrive(tentativa);
                    continue;
                }
                return criarPasta(nomePasta, parentId);
            } catch (Exception e) {
                ultimoErro = e;
                log.warn(
                        "Falha ao recriar subpasta «{}» (tentativa {}/4): {}",
                        nomePasta,
                        tentativa,
                        e.getMessage());
                aguardarPropagacaoDrive(tentativa);
            }
        }
        if (ultimoErro != null) {
            throw ultimoErro;
        }
        throw new IllegalStateException("Falha ao recriar subpasta «" + nomePasta + "» no Drive.");
    }

    private static void aguardarPropagacaoDrive(int tentativa) {
        try {
            Thread.sleep(400L * tentativa);
        } catch (InterruptedException ie) {
            Thread.currentThread().interrupt();
        }
    }

    /**
     * Garante subpasta filha direta do {@code parentId}, com retry para atraso de indexação do Drive.
     * Usado quando «Petições» e «Assinar» devem coexistir no mesmo nível (mesma pasta raiz do processo).
     */
    public String garantirSubpastaComRetry(String nomePasta, String parentId) throws Exception {
        if (!isConfigurado() || !StringUtils.hasText(parentId)) {
            return null;
        }
        Exception ultimoErro = null;
        for (int tentativa = 1; tentativa <= 4; tentativa++) {
            try {
                String id = encontrarOuCriarPastaPublic(nomePasta, parentId);
                if (StringUtils.hasText(id) && validarSubpastaFilha(id, parentId)) {
                    return id;
                }
                ultimoErro = new IllegalStateException(
                        "Subpasta «" + nomePasta + "» não validada como filha imediata do destino");
            } catch (Exception e) {
                ultimoErro = e;
                log.warn(
                        "Falha ao garantir subpasta «{}» (tentativa {}/4): {}",
                        nomePasta,
                        tentativa,
                        e.getMessage());
            }
            aguardarPropagacaoDrive(tentativa);
        }
        if (ultimoErro != null) {
            throw ultimoErro;
        }
        throw new IllegalStateException("Falha ao garantir subpasta «" + nomePasta + "» no Drive.");
    }

    private boolean validarSubpastaFilha(String pastaId, String parentIdEsperado) throws Exception {
        File f = prepararGet(driveService.files().get(pastaId).setFields("id, mimeType, parents, trashed"))
                .execute();
        if (Boolean.TRUE.equals(f.getTrashed())) {
            return false;
        }
        if (!"application/vnd.google-apps.folder".equals(f.getMimeType())) {
            return false;
        }
        return f.getParents() != null && f.getParents().contains(parentIdEsperado);
    }

    public String encontrarOuCriarPastaPublic(String nomePasta, String parentId) throws Exception {
        String existente = encontrarPastaExistente(nomePasta, parentId);
        if (existente != null) {
            return existente;
        }
        return criarPasta(nomePasta, parentId);
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
        out.put("modoDrive", resolverModoDrive());
        out.put("sharedDriveId", sharedDriveId);
        out.put("rootFolderId", rootFolderId);
        out.putAll(montarDiagnosticoPermissaoSharedDriveRaiz());

        if (!isConfigurado()) {
            out.put("erro", "Google Drive não configurado (driveService ou rootFolderId ausente).");
            out.put("interpretacao", "Drive indisponível — não foi possível consultar a API.");
            return out;
        }

        Map<String, Object> pastas = new LinkedHashMap<>();
        pastas.put("raizSistemaVilaReal", obterMetadadosArquivoDiagnostico(DIAG_RAIZ_SISTEMA_VILAREAL_ID));
        pastas.put("pastaFolhaProcessoTeste", obterMetadadosArquivoDiagnostico(DIAG_PASTA_FOLHA_PROCESSO_TESTE_ID));
        if (usaSharedDrive() && StringUtils.hasText(rootFolderId)) {
            pastas.put("raizSistemaNoSharedDrive", obterMetadadosArquivoDiagnostico(rootFolderId));
        }
        out.put("pastas", pastas);
        out.put("sharedDrives", listarSharedDrivesDiagnostico());
        out.put("interpretacao", interpretarDiagnosticoDrive(pastas, auth));
        return out;
    }

    /** Modo resolvido para logs e diagnóstico. */
    public String resolverModoDrive() {
        if (usaSharedDrive()) {
            return "SHARED_DRIVE";
        }
        if (StringUtils.hasText(impersonateUser)) {
            return "IMPERSONATION";
        }
        return "SERVICE_ACCOUNT_DIRECT";
    }

    /**
     * Consulta permissões da SA no Shared Drive raiz (validação humana sem abrir o Drive UI).
     */
    private Map<String, Object> montarDiagnosticoPermissaoSharedDriveRaiz() {
        Map<String, Object> perm = new LinkedHashMap<>();
        perm.put("canAddChildren", null);
        perm.put("canEdit", null);
        if (!usaSharedDrive()) {
            perm.put("permissaoSharedDriveErro", "Modo atual não usa Shared Drive como destino primário.");
            return perm;
        }
        if (!isConfigurado()) {
            perm.put("permissaoSharedDriveErro", "Drive não configurado.");
            return perm;
        }
        try {
            File driveRaiz = prepararGet(driveService.files()
                            .get(sharedDriveId)
                            .setFields("id,name,capabilities/canAddChildren,capabilities/canEdit"))
                    .execute();
            perm.put("sharedDriveRaizNome", driveRaiz.getName());
            if (driveRaiz.getCapabilities() != null) {
                perm.put("canAddChildren", driveRaiz.getCapabilities().getCanAddChildren());
                perm.put("canEdit", driveRaiz.getCapabilities().getCanEdit());
            }
        } catch (Exception e) {
            perm.put("permissaoSharedDriveErro", e.getClass().getSimpleName() + ": " + e.getMessage());
        }
        return perm;
    }

    private Map<String, Object> montarAutenticacaoDrive() {
        Map<String, Object> auth = new LinkedHashMap<>();
        auth.put("tipoCredencial", "service_account");
        auth.put("credentialsFileConfig", credentialsFile);
        auth.put("escoposDrive", DRIVE_SCOPES);
        auth.put("domainWideDelegation", StringUtils.hasText(impersonateUser));
        auth.put("subjectImpersonacao", StringUtils.hasText(impersonateUser) ? impersonateUser.trim() : null);
        auth.put("sharedDriveId", sharedDriveId);
        auth.put("modoSharedDrive", usaSharedDrive());

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
            File f = prepararGet(driveService.files()
                            .get(fileId)
                            .setFields(DRIVE_FILE_DIAG_FIELDS))
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
