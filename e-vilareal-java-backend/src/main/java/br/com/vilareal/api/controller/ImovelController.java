package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.ImovelRequest;
import br.com.vilareal.api.dto.ImovelResponse;
import br.com.vilareal.api.service.ImovelService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/imoveis")
public class ImovelController {
    private final ImovelService imovelService;

    public ImovelController(ImovelService imovelService) {
        this.imovelService = imovelService;
    }

    @GetMapping
    public List<ImovelResponse> listar(@RequestParam(required = false) Long clienteId) {
        return imovelService.listar(clienteId);
    }

    @GetMapping("/{id}")
    public ImovelResponse buscar(@PathVariable Long id) {
        return imovelService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<ImovelResponse> criar(@Valid @RequestBody ImovelRequest request) {
        ImovelResponse r = imovelService.criar(request);
        return ResponseEntity.created(URI.create("/api/imoveis/" + r.getId())).body(r);
    }

    @PutMapping("/{id}")
    public ImovelResponse atualizar(@PathVariable Long id, @Valid @RequestBody ImovelRequest request) {
        return imovelService.atualizar(id, request);
    }
}
