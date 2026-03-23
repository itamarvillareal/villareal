package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.PublicacaoRequest;
import br.com.vilareal.api.dto.PublicacaoResponse;
import br.com.vilareal.api.dto.PublicacaoStatusPatchRequest;
import br.com.vilareal.api.dto.PublicacaoVinculoProcessoPatchRequest;
import br.com.vilareal.api.entity.enums.PublicacaoOrigemImportacao;
import br.com.vilareal.api.entity.enums.PublicacaoStatusTratamento;
import br.com.vilareal.api.service.PublicacaoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/publicacoes")
public class PublicacaoController {
    private final PublicacaoService publicacaoService;

    public PublicacaoController(PublicacaoService publicacaoService) {
        this.publicacaoService = publicacaoService;
    }

    @GetMapping
    public List<PublicacaoResponse> listar(
            @RequestParam(required = false) LocalDate dataInicio,
            @RequestParam(required = false) LocalDate dataFim,
            @RequestParam(required = false) PublicacaoStatusTratamento status,
            @RequestParam(required = false) Long processoId,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) String texto,
            @RequestParam(required = false) PublicacaoOrigemImportacao origemImportacao
    ) {
        return publicacaoService.listar(dataInicio, dataFim, status, processoId, clienteId, texto, origemImportacao);
    }

    @GetMapping("/{id}")
    public PublicacaoResponse buscar(@PathVariable Long id) {
        return publicacaoService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<PublicacaoResponse> criar(@Valid @RequestBody PublicacaoRequest request) {
        PublicacaoResponse r = publicacaoService.criar(request);
        return ResponseEntity.created(URI.create("/api/publicacoes/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public PublicacaoResponse atualizar(@PathVariable Long id, @Valid @RequestBody PublicacaoRequest request) {
        return publicacaoService.atualizar(id, request);
    }

    @PatchMapping("/{id}/status")
    public PublicacaoResponse alterarStatus(@PathVariable Long id, @Valid @RequestBody PublicacaoStatusPatchRequest request) {
        return publicacaoService.alterarStatus(id, request);
    }

    @PatchMapping("/{id}/vinculo-processo")
    public PublicacaoResponse vincularProcesso(@PathVariable Long id, @RequestBody PublicacaoVinculoProcessoPatchRequest request) {
        return publicacaoService.vincularProcesso(id, request);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        publicacaoService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
