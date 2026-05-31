package br.com.vilareal.descontocheque.api;

import br.com.vilareal.descontocheque.api.dto.DescontoChequeRequest;
import br.com.vilareal.descontocheque.api.dto.DescontoChequeResponse;
import br.com.vilareal.descontocheque.application.DescontoChequeApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

/**
 * Desconto de cheque — entidade independente (não vincula cliente/processo).
 * Protegido por JWT como os demais controllers (anyRequest().authenticated()).
 */
@RestController
@RequestMapping("/api/descontos-cheque")
@Tag(name = "Desconto de Cheques")
public class DescontoChequeController {

    private final DescontoChequeApplicationService service;

    public DescontoChequeController(DescontoChequeApplicationService service) {
        this.service = service;
    }

    @GetMapping
    @Operation(description = "Lista todos os descontos de cheque salvos (resumo, sem tabela diária).")
    public List<DescontoChequeResponse> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    @Operation(description = "Retorna um desconto de cheque com a tabela diária recalculada.")
    public DescontoChequeResponse obter(@PathVariable Long id) {
        return service.obter(id);
    }

    @PostMapping("/simular")
    @Operation(description = "Calcula e retorna o desconto SEM salvar (preview ao vivo).")
    public DescontoChequeResponse simular(@Valid @RequestBody DescontoChequeRequest request) {
        return service.simular(request);
    }

    @PostMapping
    @Operation(description = "Calcula e salva um novo desconto de cheque.")
    public ResponseEntity<DescontoChequeResponse> criar(@Valid @RequestBody DescontoChequeRequest request) {
        DescontoChequeResponse body = service.criar(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/{id}")
    @Operation(description = "Recalcula e atualiza um desconto de cheque existente.")
    public DescontoChequeResponse atualizar(@PathVariable Long id, @Valid @RequestBody DescontoChequeRequest request) {
        return service.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(description = "Exclui um desconto de cheque.")
    public void excluir(@PathVariable Long id) {
        service.excluir(id);
    }
}
