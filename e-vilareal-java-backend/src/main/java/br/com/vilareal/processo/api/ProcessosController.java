package br.com.vilareal.processo.api;

import br.com.vilareal.processo.api.dto.*;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.http.ResponseEntity;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.Arrays;
import java.util.List;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/processos")
@Tag(name = "Processos", description = "Paridade processosRepository.js / Processos.jsx")
public class ProcessosController {

    private final ProcessoApplicationService processoApplicationService;

    public ProcessosController(ProcessoApplicationService processoApplicationService) {
        this.processoApplicationService = processoApplicationService;
    }

    @GetMapping
    @Operation(
            summary = "Listar processos",
            description =
                    "Com `codigoCliente` (8 dígitos): página JSON (`Page` Spring: `content`, `totalElements`, `last`, …; "
                            + "query `page`, `size`, `sort`; padrão `page=0`, `size=100`, `sort=numeroInterno`, `id`). "
                            + "Sem `codigoCliente`: lista paginada de todos (`Page` Spring: `content`, `totalElements`, …; query `page`, `size`, `sort`).")
    public ResponseEntity<?> listar(
            @RequestParam(required = false) String codigoCliente,
            HttpServletRequest request,
            @PageableDefault(size = 20, sort = "id") Pageable pageable) {
        if (StringUtils.hasText(codigoCliente)) {
            return ResponseEntity.ok(processoApplicationService.listarPorCodigoCliente(
                    codigoCliente.trim(), pageableParaCodigoCliente(request)));
        }
        return ResponseEntity.ok(processoApplicationService.listarTodosPaginado(pageable));
    }

    /**
     * Paginação para {@code codigoCliente}: padrão {@code size=100}, {@code sort=numeroInterno asc, id asc}
     * quando {@code sort} não é enviado (evita conflito com {@link PageableDefault}(size=20) do branch sem cliente).
     */
    private static Pageable pageableParaCodigoCliente(HttpServletRequest req) {
        int page = parseNonNegativeInt(req.getParameter("page"), 0);
        int size = parsePositiveIntWithDefault(req.getParameter("size"), 100);
        Sort sort = sortParaCodigoCliente(req);
        return PageRequest.of(page, size, sort);
    }

    private static int parsePositiveIntWithDefault(String raw, int defaultVal) {
        if (raw == null || raw.isBlank()) {
            return defaultVal;
        }
        try {
            int v = Integer.parseInt(raw.trim());
            return v < 1 ? defaultVal : v;
        } catch (NumberFormatException e) {
            return defaultVal;
        }
    }

    private static int parseNonNegativeInt(String raw, int defaultVal) {
        if (raw == null || raw.isBlank()) {
            return defaultVal;
        }
        try {
            int v = Integer.parseInt(raw.trim());
            return Math.max(0, v);
        } catch (NumberFormatException e) {
            return defaultVal;
        }
    }

    private static Sort sortParaCodigoCliente(HttpServletRequest req) {
        String[] sortParams = req.getParameterValues("sort");
        if (sortParams == null || sortParams.length == 0) {
            return Sort.by(Sort.Order.asc("numeroInterno"), Sort.Order.asc("id"));
        }
        return Sort.by(Arrays.stream(sortParams)
                .map(ProcessosController::ordemSort)
                .collect(Collectors.toList()));
    }

    private static Sort.Order ordemSort(String token) {
        if (token == null || token.isBlank()) {
            return Sort.Order.asc("numeroInterno");
        }
        String t = token.trim();
        int comma = t.lastIndexOf(',');
        if (comma < 0) {
            return Sort.Order.asc(t);
        }
        String prop = t.substring(0, comma).trim();
        String dir = t.substring(comma + 1).trim();
        Sort.Direction d = dir.equalsIgnoreCase("desc") ? Sort.Direction.DESC : Sort.Direction.ASC;
        return new Sort.Order(d, prop);
    }

    @GetMapping("/por-numero-interno")
    @Operation(summary = "Listar processos com o mesmo nº interno (vários clientes podem ter proc. 1, 2…)")
    public List<ProcessoResponse> listarPorNumeroInterno(@RequestParam int numeroInterno) {
        return processoApplicationService.listarPorNumeroInterno(numeroInterno);
    }

    @GetMapping("/vinculo-pessoa/{pessoaId}")
    @Operation(summary = "Diagnóstico: processos em que a pessoa figura (cliente, parte ou advogado)")
    public List<ProcessoDiagnosticoPessoaItemResponse> listarVinculosPessoa(@PathVariable Long pessoaId) {
        return processoApplicationService.listarVinculosDiagnosticoPorPessoa(pessoaId);
    }

    @GetMapping("/diagnostico/busca-numero")
    @Operation(
            summary = "Diagnóstico: busca por número de processo (CNJ)",
            description = "Normaliza o parâmetro `numero` (remove `.`, `-`, espaços; compara pelos dígitos do CNJ gravado).")
    public List<ProcessoDiagnosticoPessoaItemResponse> buscarDiagnosticoPorNumero(
            @RequestParam("numero") String numero) {
        return processoApplicationService.buscarDiagnosticoPorNumeroProcesso(numero);
    }

    @GetMapping("/diagnostico/prazo-fatal")
    @Operation(
            summary = "Diagnóstico: processos com prazo fatal na data",
            description = "Aceita `data` em dd/mm/aaaa ou yyyy-mm-dd; alinha com o cadastro na API (coluna prazo_fatal e prazos marcados como fatal).")
    public List<ProcessoDiagnosticoPessoaItemResponse> buscarDiagnosticoPorPrazoFatal(
            @RequestParam("data") String data) {
        return processoApplicationService.buscarDiagnosticoPorPrazoFatal(data);
    }

    @GetMapping("/{id}")
    public ProcessoResponse buscar(@PathVariable Long id) {
        return processoApplicationService.buscar(id);
    }

    @PostMapping
    public ResponseEntity<ProcessoResponse> criar(@Valid @RequestBody ProcessoWriteRequest request) {
        ProcessoResponse body = processoApplicationService.criar(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}")
    public ProcessoResponse atualizar(@PathVariable Long id, @Valid @RequestBody ProcessoWriteRequest request) {
        return processoApplicationService.atualizar(id, request);
    }

    @PatchMapping("/{id}/ativo")
    @Operation(summary = "Ativar/inativar", description = "Query ?value=true|false")
    public ResponseEntity<Void> patchAtivo(@PathVariable Long id, @RequestParam boolean value) {
        processoApplicationService.patchAtivo(id, value);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/partes")
    public List<ProcessoParteResponse> listarPartes(@PathVariable Long id) {
        return processoApplicationService.listarPartes(id);
    }

    @PostMapping("/{id}/partes")
    public ResponseEntity<ProcessoParteResponse> criarParte(
            @PathVariable Long id, @Valid @RequestBody ProcessoParteWriteRequest request) {
        ProcessoParteResponse body = processoApplicationService.criarParte(id, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{parteId}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}/partes/{parteId}")
    public ProcessoParteResponse atualizarParte(
            @PathVariable Long id,
            @PathVariable Long parteId,
            @Valid @RequestBody ProcessoParteWriteRequest request) {
        return processoApplicationService.atualizarParte(id, parteId, request);
    }

    @DeleteMapping("/{id}/partes/{parteId}")
    public ResponseEntity<Void> excluirParte(@PathVariable Long id, @PathVariable Long parteId) {
        processoApplicationService.excluirParte(id, parteId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/andamentos")
    public List<ProcessoAndamentoResponse> listarAndamentos(@PathVariable Long id) {
        return processoApplicationService.listarAndamentos(id);
    }

    @PostMapping("/{id}/andamentos")
    public ResponseEntity<ProcessoAndamentoResponse> criarAndamento(
            @PathVariable Long id, @Valid @RequestBody ProcessoAndamentoWriteRequest request) {
        ProcessoAndamentoResponse body = processoApplicationService.criarAndamento(id, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{andamentoId}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}/andamentos/{andamentoId}")
    public ProcessoAndamentoResponse atualizarAndamento(
            @PathVariable Long id,
            @PathVariable Long andamentoId,
            @Valid @RequestBody ProcessoAndamentoWriteRequest request) {
        return processoApplicationService.atualizarAndamento(id, andamentoId, request);
    }

    @DeleteMapping("/{id}/andamentos/{andamentoId}")
    public ResponseEntity<Void> excluirAndamento(@PathVariable Long id, @PathVariable Long andamentoId) {
        processoApplicationService.excluirAndamento(id, andamentoId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{id}/prazos")
    public List<ProcessoPrazoResponse> listarPrazos(@PathVariable Long id) {
        return processoApplicationService.listarPrazos(id);
    }

    @PostMapping("/{id}/prazos")
    public ResponseEntity<ProcessoPrazoResponse> criarPrazo(
            @PathVariable Long id, @Valid @RequestBody ProcessoPrazoWriteRequest request) {
        ProcessoPrazoResponse body = processoApplicationService.criarPrazo(id, request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{prazoId}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/{id}/prazos/{prazoId}")
    public ProcessoPrazoResponse atualizarPrazo(
            @PathVariable Long id,
            @PathVariable Long prazoId,
            @Valid @RequestBody ProcessoPrazoWriteRequest request) {
        return processoApplicationService.atualizarPrazo(id, prazoId, request);
    }
}
