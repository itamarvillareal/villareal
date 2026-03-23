package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.PessoaDadosComplementaresRequest;
import br.com.vilareal.api.dto.PessoaDadosComplementaresResponse;
import br.com.vilareal.api.service.PessoaDadosComplementaresService;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

@RestController
@RequestMapping("/api/pessoas")
public class PessoaDadosComplementaresController {
    private final PessoaDadosComplementaresService service;

    public PessoaDadosComplementaresController(PessoaDadosComplementaresService service) {
        this.service = service;
    }

    @GetMapping("/{id}/complementares")
    public PessoaDadosComplementaresResponse obter(@PathVariable("id") Long pessoaId) {
        return service.obter(pessoaId);
    }

    @PutMapping("/{id}/complementares")
    public PessoaDadosComplementaresResponse salvar(
            @PathVariable("id") Long pessoaId,
            @Valid @RequestBody PessoaDadosComplementaresRequest request) {
        return service.salvar(pessoaId, request);
    }
}
