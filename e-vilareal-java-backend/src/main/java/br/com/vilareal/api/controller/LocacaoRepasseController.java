package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.RepasseLocadorRequest;
import br.com.vilareal.api.dto.RepasseLocadorResponse;
import br.com.vilareal.api.service.RepasseLocadorService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/locacoes/repasses")
public class LocacaoRepasseController {
    private final RepasseLocadorService repasseLocadorService;

    public LocacaoRepasseController(RepasseLocadorService repasseLocadorService) {
        this.repasseLocadorService = repasseLocadorService;
    }

    @GetMapping
    public List<RepasseLocadorResponse> listar(@RequestParam(required = false) Long contratoId) {
        return repasseLocadorService.listar(contratoId);
    }

    @PostMapping
    public ResponseEntity<RepasseLocadorResponse> criar(@Valid @RequestBody RepasseLocadorRequest request) {
        RepasseLocadorResponse r = repasseLocadorService.criar(request);
        return ResponseEntity.created(URI.create("/api/locacoes/repasses/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public RepasseLocadorResponse atualizar(@PathVariable Long id, @Valid @RequestBody RepasseLocadorRequest request) {
        return repasseLocadorService.atualizar(id, request);
    }
}
