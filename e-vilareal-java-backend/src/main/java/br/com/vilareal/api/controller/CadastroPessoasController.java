package br.com.vilareal.api.controller;

import br.com.vilareal.api.dto.CadastroPessoasRequest;
import br.com.vilareal.api.dto.CadastroPessoasResponse;
import br.com.vilareal.api.service.CadastroPessoasService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.responses.ApiResponses;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/cadastro-pessoas")
@Tag(name = "Cadastro de Pessoas", description = "CRUD do cadastro de pessoas (tabela cadastro_pessoas)")
public class CadastroPessoasController {

    private final CadastroPessoasService service;

    public CadastroPessoasController(CadastroPessoasService service) {
        this.service = service;
    }

    @PostMapping
    @Operation(summary = "Criar", description = "Cadastra uma nova pessoa. CPF obrigatório e único; e-mail opcional e único quando informado.")
    @ApiResponses({
            @ApiResponse(responseCode = "201", description = "Cadastro criado com sucesso"),
            @ApiResponse(responseCode = "400", description = "Dados inválidos ou e-mail/CPF já existente")
    })
    public ResponseEntity<CadastroPessoasResponse> criar(@Valid @RequestBody CadastroPessoasRequest request) {
        CadastroPessoasResponse response = service.criar(request);
        URI location = ServletUriComponentsBuilder
                .fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(response.getId())
                .toUri();
        return ResponseEntity.created(location).body(response);
    }

    @PutMapping("/{id}")
    @Operation(summary = "Atualizar", description = "Atualiza um cadastro existente pelo ID.")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cadastro atualizado"),
            @ApiResponse(responseCode = "404", description = "Cadastro não encontrado"),
            @ApiResponse(responseCode = "422", description = "E-mail ou CPF já utilizado")
    })
    public ResponseEntity<CadastroPessoasResponse> atualizar(
            @PathVariable Long id,
            @Valid @RequestBody CadastroPessoasRequest request) {
        CadastroPessoasResponse response = service.atualizar(id, request);
        return ResponseEntity.ok(response);
    }

    @GetMapping("/proximo-id")
    @Operation(summary = "Próximo ID", description = "Próximo valor de id para novo cadastro (MAX(id)+1 ou 1). Somente pré-visualização na tela.")
    public ResponseEntity<Map<String, Long>> proximoId() {
        return ResponseEntity.ok(Map.of("proximoId", service.proximoIdDisponivel()));
    }

    @GetMapping("/{id}")
    @Operation(summary = "Buscar por ID")
    @ApiResponses({
            @ApiResponse(responseCode = "200", description = "Cadastro encontrado"),
            @ApiResponse(responseCode = "404", description = "Cadastro não encontrado")
    })
    public ResponseEntity<CadastroPessoasResponse> buscarPorId(@PathVariable Long id) {
        return service.buscarPorId(id)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @GetMapping
    @Operation(summary = "Listar", description = "Lista todos ou apenas ativos (apenasAtivos=true).")
    public ResponseEntity<List<CadastroPessoasResponse>> listar(
            @RequestParam(required = false, defaultValue = "false") boolean apenasAtivos) {
        List<CadastroPessoasResponse> lista = apenasAtivos
                ? service.listarAtivos()
                : service.listarTodos();
        return ResponseEntity.ok(lista);
    }

    @DeleteMapping("/{id}")
    @Operation(summary = "Excluir")
    @ApiResponses({
            @ApiResponse(responseCode = "204", description = "Cadastro excluído"),
            @ApiResponse(responseCode = "404", description = "Cadastro não encontrado")
    })
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        service.excluir(id);
        return ResponseEntity.noContent().build();
    }
}
