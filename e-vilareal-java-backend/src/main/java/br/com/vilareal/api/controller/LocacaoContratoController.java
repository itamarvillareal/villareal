package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.ContratoLocacaoRequest;
import br.com.vilareal.api.dto.ContratoLocacaoResponse;
import br.com.vilareal.api.service.ContratoLocacaoService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/locacoes/contratos")
public class LocacaoContratoController {
    private final ContratoLocacaoService contratoLocacaoService;

    public LocacaoContratoController(ContratoLocacaoService contratoLocacaoService) {
        this.contratoLocacaoService = contratoLocacaoService;
    }

    @GetMapping
    public List<ContratoLocacaoResponse> listar(
            @RequestParam(required = false) Long imovelId,
            @RequestParam(required = false) Long clienteId
    ) {
        return contratoLocacaoService.listar(imovelId, clienteId);
    }

    @GetMapping("/{id}")
    public ContratoLocacaoResponse buscar(@PathVariable Long id) {
        return contratoLocacaoService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<ContratoLocacaoResponse> criar(@Valid @RequestBody ContratoLocacaoRequest request) {
        ContratoLocacaoResponse r = contratoLocacaoService.criar(request);
        return ResponseEntity.created(URI.create("/api/locacoes/contratos/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public ContratoLocacaoResponse atualizar(@PathVariable Long id, @Valid @RequestBody ContratoLocacaoRequest request) {
        return contratoLocacaoService.atualizar(id, request);
    }
}
