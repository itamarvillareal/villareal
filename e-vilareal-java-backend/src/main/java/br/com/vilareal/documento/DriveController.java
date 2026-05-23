package br.com.vilareal.documento;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/drive")
@Tag(name = "Google Drive", description = "Navegação e upload de arquivos nas pastas do processo")
public class DriveController {

    private static final Logger log = LoggerFactory.getLogger(DriveController.class);

    private final GoogleDriveService googleDriveService;
    private final DocumentoDrivePastaService documentoDrivePastaService;

    public DriveController(
            GoogleDriveService googleDriveService,
            DocumentoDrivePastaService documentoDrivePastaService) {
        this.googleDriveService = googleDriveService;
        this.documentoDrivePastaService = documentoDrivePastaService;
    }

    @GetMapping("/status")
    @Operation(summary = "Indica se a integração com o Google Drive está ativa")
    public ResponseEntity<Map<String, Boolean>> status() {
        return ResponseEntity.ok(Map.of("configurado", googleDriveService.isConfigurado()));
    }

    @GetMapping("/arquivos")
    @Operation(summary = "Lista arquivos e subpastas da pasta do processo (ou subpasta informada)")
    public ResponseEntity<List<DriveArquivoDto>> listarArquivos(
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno,
            @RequestParam(required = false) String pastaId) {
        if (!googleDriveService.isConfigurado()) {
            return ResponseEntity.ok(List.of());
        }
        try {
            String pastaDestino = resolverPastaId(codigoCliente, numeroInterno, pastaId);
            if (!StringUtils.hasText(pastaDestino)) {
                return ResponseEntity.ok(List.of());
            }
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore())
                    .body(googleDriveService.listarConteudo(pastaDestino));
        } catch (Exception e) {
            log.warn("Erro ao listar arquivos no Drive: {}", e.getMessage());
            return ResponseEntity.ok(List.of());
        }
    }

    @PostMapping(value = "/upload", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Envia arquivo para a pasta do processo no Drive")
    public ResponseEntity<DriveArquivoDto> uploadArquivo(
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno,
            @RequestParam(required = false) String pastaId,
            @RequestParam("arquivo") MultipartFile arquivo) throws Exception {
        if (!googleDriveService.isConfigurado()) {
            return ResponseEntity.status(503).build();
        }
        if (arquivo == null || arquivo.isEmpty()) {
            return ResponseEntity.badRequest().build();
        }
        String pastaDestino = resolverPastaId(codigoCliente, numeroInterno, pastaId);
        if (!StringUtils.hasText(pastaDestino)) {
            return ResponseEntity.notFound().build();
        }
        DriveArquivoDto enviado = googleDriveService.uploadArquivo(
                arquivo.getBytes(),
                arquivo.getOriginalFilename(),
                arquivo.getContentType(),
                pastaDestino);
        if (enviado == null) {
            return ResponseEntity.internalServerError().build();
        }
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(enviado);
    }

    @GetMapping("/pasta-processo")
    @Operation(summary = "Retorna link e ID da pasta raiz do processo no Drive (cria se necessário)")
    public ResponseEntity<DrivePastaProcessoDto> obterPastaProcesso(
            @RequestParam String codigoCliente,
            @RequestParam Integer numeroInterno) {
        if (!googleDriveService.isConfigurado()) {
            return ResponseEntity.status(503).build();
        }
        try {
            DrivePastaProcessoDto pasta = documentoDrivePastaService.resolverPastaRaizProcesso(
                    googleDriveService, codigoCliente, numeroInterno);
            if (pasta == null || !StringUtils.hasText(pasta.pastaId())) {
                return ResponseEntity.notFound().build();
            }
            return ResponseEntity.ok()
                    .cacheControl(CacheControl.noStore())
                    .body(pasta);
        } catch (Exception e) {
            log.warn("Erro ao obter pasta do processo no Drive: {}", e.getMessage());
            return ResponseEntity.internalServerError().build();
        }
    }

    private String resolverPastaId(String codigoCliente, Integer numeroInterno, String pastaId)
            throws Exception {
        if (StringUtils.hasText(pastaId)) {
            return pastaId.trim();
        }
        DrivePastaProcessoDto pasta = documentoDrivePastaService.resolverPastaRaizProcesso(
                googleDriveService, codigoCliente, numeroInterno);
        return pasta != null ? pasta.pastaId() : null;
    }
}
