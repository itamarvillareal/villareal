package br.com.vilareal.condominio.api;

import br.com.vilareal.condominio.api.dto.InadimplenciaExtracaoResponse;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportRequest;
import br.com.vilareal.condominio.api.dto.InadimplenciaImportResponse;
import br.com.vilareal.condominio.application.CondominioInadimplenciaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/condominio/inadimplencia")
@Tag(name = "Condomínio — Inadimplência", description = "Importação de relatório PDF de inadimplência por unidade")
public class CondominioInadimplenciaController {

    private final CondominioInadimplenciaApplicationService service;

    public CondominioInadimplenciaController(CondominioInadimplenciaApplicationService service) {
        this.service = service;
    }

    @PostMapping(value = "/extrair", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Extrair cobranças do PDF (sem gravar)")
    public ResponseEntity<InadimplenciaExtracaoResponse> extrair(
            @RequestParam("clienteCodigo") String clienteCodigo,
            @RequestParam("arquivo") MultipartFile arquivo) {
        InadimplenciaExtracaoResponse body = service.extrair(clienteCodigo, arquivo);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(body);
    }

    @PostMapping(value = "/importar", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(summary = "Importar cobranças confirmadas (processo + cálculo)")
    public ResponseEntity<InadimplenciaImportResponse> importar(@Valid @RequestBody InadimplenciaImportRequest body) {
        InadimplenciaImportResponse res = service.importar(body);
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_JSON)
                .cacheControl(CacheControl.noStore())
                .body(res);
    }
}
