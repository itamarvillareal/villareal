package br.com.vilareal.pessoa.api;

import br.com.vilareal.pessoa.api.dto.*;
import br.com.vilareal.pessoa.application.PessoaApplicationService;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/pessoas")
@Tag(name = "Pessoa — complementares, endereços, contatos")
public class PessoaRecursosController {

    private final PessoaApplicationService pessoaService;

    public PessoaRecursosController(PessoaApplicationService pessoaService) {
        this.pessoaService = pessoaService;
    }

    @GetMapping("/{id}/complementares")
    public PessoaComplementarPayload obterComplementares(@PathVariable Long id) {
        return pessoaService.obterComplementar(id);
    }

    @PutMapping("/{id}/complementares")
    public PessoaComplementarPayload salvarComplementares(
            @PathVariable Long id,
            @Valid @RequestBody PessoaComplementarPayload body) {
        return pessoaService.salvarComplementar(id, body);
    }

    @GetMapping("/{id}/enderecos")
    public List<PessoaEnderecoItemResponse> listarEnderecos(@PathVariable Long id) {
        return pessoaService.listarEnderecos(id);
    }

    @PutMapping("/{id}/enderecos")
    public List<PessoaEnderecoItemResponse> substituirEnderecos(
            @PathVariable Long id,
            @Valid @RequestBody List<PessoaEnderecoItemRequest> body) {
        return pessoaService.substituirEnderecos(id, body);
    }

    @GetMapping("/{id}/contatos")
    public List<PessoaContatoItemResponse> listarContatos(@PathVariable Long id) {
        return pessoaService.listarContatos(id);
    }

    @PutMapping("/{id}/contatos")
    public List<PessoaContatoItemResponse> substituirContatos(
            @PathVariable Long id,
            @Valid @RequestBody List<PessoaContatoItemRequest> body) {
        return pessoaService.substituirContatos(id, body);
    }
}
