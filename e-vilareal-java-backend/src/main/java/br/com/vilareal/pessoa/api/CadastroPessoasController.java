package br.com.vilareal.pessoa.api;

import br.com.vilareal.pessoa.api.dto.PessoaCadastroRequest;
import br.com.vilareal.pessoa.api.dto.PessoaCadastroResponse;
import br.com.vilareal.pessoa.application.PessoaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cadastro-pessoas")
@Tag(name = "Cadastro de Pessoas", description = "Paridade clientesService.js")
public class CadastroPessoasController {

    private final PessoaApplicationService pessoaService;

    public CadastroPessoasController(PessoaApplicationService pessoaService) {
        this.pessoaService = pessoaService;
    }

    @GetMapping
    @Operation(summary = "Listar pessoas", description = "Filtros opcionais: nome (contém), cpf (dígitos), codigo (id exato), apenasAtivos")
    public List<PessoaCadastroResponse> listar(
            @RequestParam(required = false, defaultValue = "false") boolean apenasAtivos,
            @RequestParam(required = false) String nome,
            @RequestParam(required = false) String cpf,
            @RequestParam(required = false) Long codigo,
            @RequestParam(required = false) String cpfAdicional) {
        return pessoaService.listar(apenasAtivos, nome, cpf, codigo, cpfAdicional);
    }

    @GetMapping("/paginada")
    @Operation(summary = "Listar com paginação Spring Data")
    public Page<PessoaCadastroResponse> listarPaginada(
            @RequestParam(required = false, defaultValue = "false") boolean apenasAtivos,
            @RequestParam(required = false) String nome,
            @RequestParam(required = false) String cpf,
            @RequestParam(required = false) Long codigo,
            @RequestParam(required = false) String cpfAdicional,
            @PageableDefault(size = 20, sort = "id", direction = Sort.Direction.ASC) Pageable pageable) {
        return pessoaService.listarPaginado(apenasAtivos, nome, cpf, codigo, cpfAdicional, pageable);
    }

    @GetMapping("/proximo-id")
    public Map<String, Long> proximoId() {
        return Map.of("proximoId", pessoaService.proximoId());
    }

    @GetMapping("/{id}")
    public ResponseEntity<PessoaCadastroResponse> buscar(@PathVariable Long id) {
        return ResponseEntity.ok(pessoaService.buscar(id));
    }

    @PostMapping
    public ResponseEntity<PessoaCadastroResponse> criar(@Valid @RequestBody PessoaCadastroRequest request) {
        PessoaCadastroResponse body = pessoaService.criar(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}")
    public PessoaCadastroResponse atualizar(@PathVariable Long id, @Valid @RequestBody PessoaCadastroRequest request) {
        return pessoaService.atualizar(id, request);
    }

    @PatchMapping("/{id}/ativo")
    @Operation(summary = "Ativar/inativar", description = "Query ?value=true|false")
    public ResponseEntity<Void> patchAtivo(@PathVariable Long id, @RequestParam boolean value) {
        pessoaService.patchAtivo(id, value);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        pessoaService.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
