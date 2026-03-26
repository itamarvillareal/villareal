package br.com.vilareal.pessoa.api;

import br.com.vilareal.pessoa.api.dto.ClienteListItemResponse;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Alias usado por {@code processosRepository.buscarClientePorCodigo} — código cliente = id da pessoa com 8 dígitos.
 */
@RestController
@RequestMapping("/api/clientes")
@Tag(name = "Clientes (Processos)", description = "Lista resumida para vínculo cliente×processo")
public class ClientesController {

    private final ProcessoApplicationService processoApplicationService;

    public ClientesController(ProcessoApplicationService processoApplicationService) {
        this.processoApplicationService = processoApplicationService;
    }

    @GetMapping
    @Operation(summary = "Listar clientes com codigoCliente (8 dígitos)")
    public List<ClienteListItemResponse> listar() {
        return processoApplicationService.listarClientesResumo();
    }
}
