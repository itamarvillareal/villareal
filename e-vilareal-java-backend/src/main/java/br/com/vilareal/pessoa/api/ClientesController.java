package br.com.vilareal.pessoa.api;

import br.com.vilareal.pessoa.api.dto.ClienteListItemResponse;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Lista de clientes para Processos / Cadastro de Clientes. Com import Pasta1 gravado em {@code
 * planilha_pasta1_cliente}, cada item reflete coluna A → coluna B; sem planilha, código = id da pessoa
 * em 8 dígitos (legado).
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

    @GetMapping("/resolucao")
    @Operation(
            summary = "Resolver código de cliente → pessoa",
            description =
                    "Com import Pasta1, só responde se existir mapeamento; não usa código numérico como id de pessoa.")
    public ResponseEntity<ClienteListItemResponse> resolucao(@RequestParam("codigoCliente") String codigoCliente) {
        return processoApplicationService
                .resolverClientePorCodigo(codigoCliente)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }
}
