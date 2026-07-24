package br.com.vilareal.patrimonio.api;

import br.com.vilareal.patrimonio.api.dto.PassivoRequest;
import br.com.vilareal.patrimonio.api.dto.PassivoResponse;
import br.com.vilareal.patrimonio.application.PassivoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/api/patrimonio/passivos")
@Tag(name = "Patrimônio — Passivos")
public class PassivoController {

    private final PassivoApplicationService service;

    public PassivoController(PassivoApplicationService service) {
        this.service = service;
    }

    @GetMapping
    public List<PassivoResponse> listar() {
        return service.listar();
    }

    @GetMapping("/{id}")
    public PassivoResponse obter(@PathVariable Long id) {
        return service.obter(id);
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    public PassivoResponse criar(@Valid @RequestBody PassivoRequest request) {
        return service.criar(request);
    }

    @PutMapping("/{id}")
    public PassivoResponse atualizar(@PathVariable Long id, @Valid @RequestBody PassivoRequest request) {
        return service.atualizar(id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void desativar(@PathVariable Long id) {
        service.desativar(id);
    }

    @PostMapping("/{id}/cronograma")
    @Operation(description = "Regenera cronograma SAC/Price (não aplica a consórcio).")
    public void regenerarCronograma(@PathVariable Long id) {
        service.regenerarCronograma(id);
    }
}
