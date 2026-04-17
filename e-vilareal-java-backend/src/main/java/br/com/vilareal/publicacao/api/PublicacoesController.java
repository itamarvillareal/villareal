package br.com.vilareal.publicacao.api;

import br.com.vilareal.publicacao.api.dto.*;
import br.com.vilareal.publicacao.application.PublicacaoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/publicacoes")
@Tag(name = "Publicações", description = "Importação PDF/DataJud e triagem — paridade com publicacoesRepository.js")
public class PublicacoesController {

    private final PublicacaoApplicationService publicacaoService;

    public PublicacoesController(PublicacaoApplicationService publicacaoService) {
        this.publicacaoService = publicacaoService;
    }

    @GetMapping
    @Operation(summary = "Listar publicações", description = "Filtros opcionais alinhados ao React.")
    public List<PublicacaoResponse> listar(
            @RequestParam(value = "dataInicio", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE)
                    LocalDate dataInicio,
            @RequestParam(value = "dataFim", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(value = "status", required = false) String statusTratamento,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "clienteId", required = false) Long clienteId,
            @RequestParam(value = "texto", required = false) String texto,
            @RequestParam(value = "origemImportacao", required = false) String origemImportacao) {
        return publicacaoService.listar(
                dataInicio, dataFim, statusTratamento, processoId, clienteId, texto, origemImportacao);
    }

    @GetMapping("/{id}")
    public PublicacaoResponse buscar(@PathVariable Long id) {
        return publicacaoService.buscar(id);
    }

    @PostMapping
    @Operation(summary = "Criar publicação (importação)")
    public ResponseEntity<PublicacaoResponse> criar(@Valid @RequestBody PublicacaoWriteRequest request) {
        PublicacaoResponse body = publicacaoService.criar(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PatchMapping("/{id}/status")
    public PublicacaoResponse patchStatus(@PathVariable Long id, @Valid @RequestBody PublicacaoStatusPatchRequest request) {
        return publicacaoService.patchStatus(id, request);
    }

    @PatchMapping("/{id}/vinculo-processo")
    public PublicacaoResponse patchVinculo(
            @PathVariable Long id, @Valid @RequestBody PublicacaoVinculoPatchRequest request) {
        return publicacaoService.patchVinculoProcesso(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        publicacaoService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
