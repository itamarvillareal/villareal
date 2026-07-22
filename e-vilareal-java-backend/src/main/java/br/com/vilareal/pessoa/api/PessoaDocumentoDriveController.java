package br.com.vilareal.pessoa.api;

import br.com.vilareal.documento.TipoDocumentoPessoa;
import br.com.vilareal.pessoa.api.dto.PessoaDocumentoDriveResponse;
import br.com.vilareal.pessoa.application.PessoaDocumentoDriveService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.util.List;

@RestController
@RequestMapping("/api/cadastro-pessoas/{pessoaId}/documentos-drive")
@Tag(name = "Documentos da Pessoa (Drive)", description = "Arquivos em Pessoas/{id8} - nome/{tipo}/")
public class PessoaDocumentoDriveController {

    private final PessoaDocumentoDriveService documentoDriveService;

    public PessoaDocumentoDriveController(PessoaDocumentoDriveService documentoDriveService) {
        this.documentoDriveService = documentoDriveService;
    }

    @GetMapping
    @Operation(summary = "Lista documentos registrados da pessoa no Drive")
    public ResponseEntity<List<PessoaDocumentoDriveResponse>> listar(
            @PathVariable Long pessoaId,
            @RequestParam(required = false) String tipo) {
        TipoDocumentoPessoa tipoEnum = tipo != null && !tipo.isBlank() ? TipoDocumentoPessoa.parse(tipo) : null;
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(documentoDriveService.listar(pessoaId, tipoEnum));
    }

    @GetMapping("/assinados")
    @Operation(summary = "Lista documentos com .p7s associado (reutilizáveis em protocolo)")
    public ResponseEntity<List<PessoaDocumentoDriveResponse>> listarAssinados(@PathVariable Long pessoaId) {
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(documentoDriveService.listarAssinados(pessoaId));
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Envia arquivo ou .p7s para subpasta da pessoa no Drive")
    public ResponseEntity<PessoaDocumentoDriveResponse> upload(
            @PathVariable Long pessoaId,
            @RequestParam(required = false) String tipo,
            @RequestParam("arquivo") MultipartFile arquivo) throws Exception {
        TipoDocumentoPessoa tipoEnum = tipo != null && !tipo.isBlank()
                ? TipoDocumentoPessoa.parse(tipo)
                : TipoDocumentoPessoa.DOCUMENTOS;
        PessoaDocumentoDriveResponse resp = documentoDriveService.registrarArquivo(pessoaId, tipoEnum, arquivo);
        return ResponseEntity.ok()
                .cacheControl(CacheControl.noStore())
                .body(resp);
    }
}
