package br.com.vilareal.documento.api;

import br.com.vilareal.documento.api.dto.DocumentoModeloListItemResponse;
import br.com.vilareal.documento.api.dto.DocumentoModeloPreviewRequest;
import br.com.vilareal.documento.api.dto.DocumentoModeloResponse;
import br.com.vilareal.documento.api.dto.DocumentoModeloWriteRequest;
import br.com.vilareal.documento.application.DocumentoModeloApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/documentos/modelos")
@Tag(name = "Modelos de documento", description = "Timbrado de petições por responsável")
public class DocumentoModeloController {

    private final DocumentoModeloApplicationService documentoModeloApplicationService;

    public DocumentoModeloController(DocumentoModeloApplicationService documentoModeloApplicationService) {
        this.documentoModeloApplicationService = documentoModeloApplicationService;
    }

    @GetMapping
    @Operation(summary = "Listar modelos de petição")
    public List<DocumentoModeloListItemResponse> listar() {
        return documentoModeloApplicationService.listar();
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar modelo por ID")
    public DocumentoModeloResponse buscar(@PathVariable Long id) {
        return documentoModeloApplicationService.buscar(id);
    }

    @GetMapping("/{id}/cabecalho")
    @Operation(summary = "Baixar imagem de cabeçalho do modelo")
    public ResponseEntity<byte[]> cabecalho(@PathVariable Long id) {
        DocumentoModeloApplicationService.CabecalhoImagem img = documentoModeloApplicationService.buscarCabecalho(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"cabecalho-" + id + "\"")
                .contentType(MediaType.parseMediaType(img.contentType()))
                .body(img.bytes());
    }

    @PostMapping(value = "/preview-pdf", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Pré-visualizar PDF de demonstração com dados do formulário (cabecalho opcional)")
    public ResponseEntity<byte[]> previewPdf(
            @Valid @RequestPart("dados") DocumentoModeloPreviewRequest dados,
            @RequestPart(value = "cabecalho", required = false) MultipartFile cabecalho) {
        byte[] pdf = documentoModeloApplicationService.gerarPreviewPdf(dados, cabecalho);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "inline; filename=\"preview-modelo.pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(pdf);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Criar modelo (multipart: dados JSON + cabecalho opcional)")
    public ResponseEntity<DocumentoModeloResponse> criar(
            @Valid @RequestPart("dados") DocumentoModeloWriteRequest dados,
            @RequestPart(value = "cabecalho", required = false) MultipartFile cabecalho) {
        DocumentoModeloResponse body = documentoModeloApplicationService.criar(dados, cabecalho);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.id())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping(path = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Atualizar modelo")
    public DocumentoModeloResponse atualizar(
            @PathVariable Long id,
            @Valid @RequestPart("dados") DocumentoModeloWriteRequest dados,
            @RequestPart(value = "cabecalho", required = false) MultipartFile cabecalho) {
        return documentoModeloApplicationService.atualizar(id, dados, cabecalho);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Desativar modelo (soft delete)")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        documentoModeloApplicationService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
