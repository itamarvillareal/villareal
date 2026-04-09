package br.com.vilareal.processo.api;

import br.com.vilareal.processo.api.dto.*;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/processos")
@Tag(name = "Processos", description = "Paridade processosRepository.js / Processos.jsx")
public class ProcessosController {

    private final ProcessoApplicationService processoApplicationService;

    public ProcessosController(ProcessoApplicationService processoApplicationService) {
        this.processoApplicationService = processoApplicationService;
    }

    @GetMapping
    @Operation(summary = "Listar por código do cliente (8 dígitos)")
    public List<ProcessoResponse> listar(@RequestParam String codigoCliente) {
        return processoApplicationService.listarPorCodigoCliente(codigoCliente);
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
