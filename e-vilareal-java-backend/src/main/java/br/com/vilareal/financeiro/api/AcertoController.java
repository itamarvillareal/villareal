package br.com.vilareal.financeiro.api;

import br.com.vilareal.financeiro.api.dto.AcertoClienteConfigResponse;
import br.com.vilareal.financeiro.api.dto.AcertoClienteConfigWriteRequest;
import br.com.vilareal.financeiro.api.dto.AcertoConferenciaResponse;
import br.com.vilareal.financeiro.api.dto.AcertoConferirProcessoRequest;
import br.com.vilareal.financeiro.api.dto.AcertoConferirRequest;
import br.com.vilareal.financeiro.api.dto.AcertoFechamentoResponse;
import br.com.vilareal.financeiro.api.dto.AcertoFechamentoWriteRequest;
import br.com.vilareal.financeiro.api.dto.AcertoResumoPeriodosResponse;
import br.com.vilareal.financeiro.api.dto.AcertoResumoProcessosResponse;
import br.com.vilareal.financeiro.application.AcertoFechamentoApplicationService;
import br.com.vilareal.financeiro.application.AcertoTrabalhoApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.FileSystemResource;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;

/**
 * Mesa de trabalho do acerto (Etapas 5/5b da CONTA ZERO): visão por processo, conferência
 * persistente, Ficha do Acerto por cliente e o fechamento como evento (RASCUNHO → FECHADO).
 */
@RestController
@RequestMapping("/api/financeiro/acerto")
@Tag(name = "Financeiro — Acerto do Cliente")
public class AcertoController {

    private final AcertoTrabalhoApplicationService acertoTrabalhoService;
    private final AcertoFechamentoApplicationService acertoFechamentoService;

    public AcertoController(
            AcertoTrabalhoApplicationService acertoTrabalhoService,
            AcertoFechamentoApplicationService acertoFechamentoService) {
        this.acertoTrabalhoService = acertoTrabalhoService;
        this.acertoFechamentoService = acertoFechamentoService;
    }

    @GetMapping("/resumo-periodos")
    @Operation(
            description =
                    "Timeline de períodos do acerto (Etapa 5c): fechados (manual/auto/formal) + período "
                            + "aberto; retorna periodoAbertoIndice e ultimoCorteData.")
    public AcertoResumoPeriodosResponse resumoPeriodos(
            @RequestParam("numeroBanco") Integer numeroBanco, @RequestParam("clienteId") Long clienteId) {
        return acertoTrabalhoService.resumoPeriodos(numeroBanco, clienteId);
    }

    @GetMapping("/resumo-processos")
    @Operation(description = "Visão do acerto agrupada por processo: somas, pendências e progresso de conferência.")
    public AcertoResumoProcessosResponse resumoProcessos(
            @RequestParam("numeroBanco") Integer numeroBanco,
            @RequestParam(value = "clienteId", required = false) Long clienteId,
            @RequestParam(value = "pessoaRefId", required = false) Long pessoaRefId,
            @RequestParam(value = "dataInicio", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(value = "dataFim", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(value = "busca", required = false) String busca,
            @RequestParam(value = "apenasPendentes", required = false) Boolean apenasPendentes,
            @RequestParam(value = "apenasNaoConferidos", required = false) Boolean apenasNaoConferidos) {
        return acertoTrabalhoService.resumoProcessos(
                numeroBanco, clienteId, pessoaRefId, dataInicio, dataFim, busca,
                apenasPendentes, apenasNaoConferidos);
    }

    @PostMapping("/conferir")
    @Operation(description = "Marca/desmarca conferência de lançamentos por id, com usuário e data.")
    public AcertoConferenciaResponse conferir(@Valid @RequestBody AcertoConferirRequest request) {
        return acertoTrabalhoService.conferirLancamentos(request);
    }

    @PostMapping("/conferir-processo")
    @Operation(description = "Conferência em cascata: marca/desmarca todos os lançamentos do processo no recorte.")
    public AcertoConferenciaResponse conferirProcesso(
            @Valid @RequestBody AcertoConferirProcessoRequest request) {
        return acertoTrabalhoService.conferirProcesso(request);
    }

    @GetMapping("/config")
    @Operation(description = "Ficha do Acerto do cliente: regras do acordo, mensalidade (cadastro mensalista) e último fechamento.")
    public AcertoClienteConfigResponse obterConfig(
            @RequestParam("clienteId") Long clienteId,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco) {
        return acertoTrabalhoService.obterConfig(clienteId, numeroBanco);
    }

    @PutMapping("/config")
    @Operation(description = "Cria/atualiza a Ficha do Acerto do cliente (percentual de repasse, observações).")
    public AcertoClienteConfigResponse salvarConfig(
            @Valid @RequestBody AcertoClienteConfigWriteRequest request) {
        return acertoTrabalhoService.salvarConfig(request);
    }

    @GetMapping("/fechamentos")
    @Operation(description = "Acertos (fechamentos) do cliente na conta, mais recentes primeiro.")
    public List<AcertoFechamentoResponse> listarFechamentos(
            @RequestParam("clienteId") Long clienteId,
            @RequestParam("numeroBanco") Integer numeroBanco) {
        return acertoFechamentoService.listar(clienteId, numeroBanco);
    }

    @PostMapping("/fechamentos")
    @ResponseStatus(HttpStatus.CREATED)
    @Operation(description = "Inicia um acerto (RASCUNHO) definindo o corte.")
    public AcertoFechamentoResponse iniciarFechamento(
            @Valid @RequestBody AcertoFechamentoWriteRequest request) {
        return acertoFechamentoService.iniciar(request);
    }

    @PutMapping("/fechamentos/{id}")
    @Operation(description = "Edita um acerto em rascunho (período, observações).")
    public AcertoFechamentoResponse atualizarFechamento(
            @PathVariable Long id, @Valid @RequestBody AcertoFechamentoWriteRequest request) {
        return acertoFechamentoService.atualizar(id, request);
    }

    @DeleteMapping("/fechamentos/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    @Operation(description = "Exclui um acerto em rascunho.")
    public void excluirFechamento(@PathVariable Long id) {
        acertoFechamentoService.excluir(id);
    }

    @PostMapping("/fechamentos/{id}/fechar")
    @Operation(description = "Fecha o acerto: grava saldo final, vincula grupos de compensação e arquiva o PDF.")
    public AcertoFechamentoResponse fechar(@PathVariable Long id) {
        return acertoFechamentoService.fechar(id);
    }

    @GetMapping("/fechamentos/{id}/pdf")
    @Operation(description = "Baixa o PDF arquivado do acerto fechado.")
    public ResponseEntity<FileSystemResource> baixarPdf(@PathVariable Long id) {
        Path p = acertoFechamentoService.resolverPdf(id);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"acerto_" + id + ".pdf\"")
                .contentType(MediaType.APPLICATION_PDF)
                .body(new FileSystemResource(p));
    }
}
