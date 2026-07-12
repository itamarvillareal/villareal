package br.com.vilareal.pessoa.api;

import br.com.vilareal.pessoa.api.dto.ClienteContextoResponse;
import br.com.vilareal.pessoa.api.dto.ClienteCreateRequest;
import br.com.vilareal.pessoa.api.dto.ClienteCreateResult;
import br.com.vilareal.pessoa.api.dto.ClienteListItemResponse;
import br.com.vilareal.pessoa.api.dto.ClienteProprioPatchRequest;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

/**
 * Lista de clientes para Processos / Cadastro de Clientes. O vínculo código → pessoa vem da tabela
 * {@code cliente}; entradas só na {@code planilha_pasta1_cliente} completam códigos sem linha em {@code cliente}.
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

    @GetMapping("/indice")
    @Operation(
            summary = "Índice leve de clientes (código + nome)",
            description =
                    "Apenas registos em `cliente` (sem merge planilha Pasta1). Suporta ETag/`If-None-Match`. "
                            + "Use `/resolucao` ou `/contexto` para códigos só na planilha.")
    public ResponseEntity<List<ClienteListItemResponse>> listarIndice(
            @RequestHeader(value = "If-None-Match", required = false) String ifNoneMatch) {
        String etag = processoApplicationService.calcularEtagIndiceClientes();
        if (etag != null && etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }
        return ResponseEntity.ok().eTag(etag).body(processoApplicationService.listarClientesIndice());
    }

    @GetMapping("/busca")
    @Operation(
            summary = "Buscar clientes por nome ou código (server-side)",
            description = "Autocomplete na tela Clientes — até `limit` resultados (padrão 80, máx. 200).")
    public List<ClienteListItemResponse> buscar(
            @RequestParam("q") String q, @RequestParam(value = "limit", defaultValue = "80") int limit) {
        return processoApplicationService.buscarClientesIndicePorTermo(q, limit);
    }

    @GetMapping("/contexto")
    @Operation(
            summary = "Contexto do cliente para abertura rápida do formulário",
            description = "Cabeçalho (`ClienteListItemResponse`) + contagem de processos num único GET.")
    public ResponseEntity<ClienteContextoResponse> contexto(@RequestParam("codigoCliente") String codigoCliente) {
        return processoApplicationService
                .resolverContextoCliente(codigoCliente)
                .map(ResponseEntity::ok)
                .orElse(ResponseEntity.notFound().build());
    }

    @PostMapping
    @Operation(
            summary = "Criar ou atualizar cliente (código → pessoa)",
            description =
                    "Upsert por codigoCliente: cria linha nova ou atualiza pessoa, nome, documento, observação e inativo.")
    public ResponseEntity<ClienteListItemResponse> criar(@Valid @RequestBody ClienteCreateRequest request) {
        ClienteCreateResult r = processoApplicationService.criarClienteMinimo(request);
        return r.criadoNovo()
                ? ResponseEntity.status(HttpStatus.CREATED).body(r.cliente())
                : ResponseEntity.ok(r.cliente());
    }

    @PatchMapping("/{id}/proprio")
    @Operation(
            summary = "Atualizar flag imóvel próprio (cliente.proprio)",
            description =
                    "Define se o cliente é proprietário de imóveis próprios (repasse interno I/A na CONTA ZERO). "
                            + "Altera o fluxo de repasse de todos os imóveis vinculados ao código.")
    public ClienteListItemResponse atualizarProprio(
            @PathVariable Long id, @Valid @RequestBody ClienteProprioPatchRequest request) {
        return processoApplicationService.atualizarProprio(id, Boolean.TRUE.equals(request.getProprio()));
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
