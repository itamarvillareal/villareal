package br.com.vilareal.pagamento.api;

import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import br.com.vilareal.pagamento.application.PagamentoConciliacaoApplicationService;
import br.com.vilareal.pagamento.application.PagamentoSpecifications;
import br.com.vilareal.pagamento.api.dto.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/pagamentos")
@Tag(name = "Pagamentos", description = "Operational payables module")
public class PagamentosController {

    private final PagamentoApplicationService pagamentoApplicationService;
    private final PagamentoConciliacaoApplicationService pagamentoConciliacaoApplicationService;

    public PagamentosController(
            PagamentoApplicationService pagamentoApplicationService,
            PagamentoConciliacaoApplicationService pagamentoConciliacaoApplicationService) {
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.pagamentoConciliacaoApplicationService = pagamentoConciliacaoApplicationService;
    }

    @GetMapping
    @Operation(summary = "Listar pagamentos com filtros opcionais")
    public List<PagamentoResponse> listar(
            @RequestParam(required = false) String tipo,
            @RequestParam(required = false) String descricao,
            @RequestParam(required = false) String codigoBarras,
            @RequestParam(required = false) BigDecimal valor,
            @RequestParam(required = false) String status,
            @RequestParam(required = false) String categoria,
            @RequestParam(required = false) Long responsavelUsuarioId,
            @RequestParam(required = false) String formaPagamento,
            @RequestParam(required = false) String prioridade,
            @RequestParam(required = false) String origem,
            @RequestParam(required = false) LocalDate vencimentoDe,
            @RequestParam(required = false) LocalDate vencimentoAte,
            @RequestParam(required = false) LocalDate agendamentoDe,
            @RequestParam(required = false) LocalDate agendamentoAte,
            @RequestParam(required = false) Long clienteId,
            @RequestParam(required = false) Long processoId,
            @RequestParam(required = false) Long imovelId,
            @RequestParam(required = false) String condominio,
            @RequestParam(required = false) Boolean somenteVencidos,
            @RequestParam(required = false) Boolean somenteConferenciaPendente,
            @RequestParam(required = false) Boolean proximos7Dias,
            @RequestParam(required = false) Boolean mesAtual,
            @RequestParam(required = false) Boolean somenteSemComprovante,
            @RequestParam(required = false) Boolean altoValor,
            @RequestParam(required = false) String mesReferencia,
            @RequestParam(required = false) String contaReferencia,
            @RequestParam(required = false) Boolean autoGerado,
            @RequestParam(required = false) Boolean conciliado,
            @RequestParam(required = false) Boolean somenteNaoConciliado) {
        var filtro = new PagamentoSpecifications.FiltroLista(
                tipo,
                descricao,
                codigoBarras,
                valor,
                status,
                categoria,
                responsavelUsuarioId,
                formaPagamento,
                prioridade,
                origem,
                vencimentoDe,
                vencimentoAte,
                agendamentoDe,
                agendamentoAte,
                clienteId,
                processoId,
                imovelId,
                condominio,
                somenteVencidos,
                somenteConferenciaPendente,
                proximos7Dias,
                mesAtual,
                somenteSemComprovante,
                altoValor,
                mesReferencia,
                contaReferencia,
                autoGerado,
                conciliado,
                somenteNaoConciliado);
        return pagamentoApplicationService.listar(filtro);
    }

    @GetMapping("/conciliacao/sugestoes")
    @Operation(summary = "Sugestões de conciliação pagamento × extrato")
    public List<ConciliacaoSugestaoPagamentoResponse> sugestoesConciliacao(
            @RequestParam LocalDate periodoInicio,
            @RequestParam LocalDate periodoFim,
            @RequestParam(required = false) String numeroBanco) {
        return pagamentoConciliacaoApplicationService.sugestoesConciliacao(periodoInicio, periodoFim, numeroBanco);
    }

    @PostMapping("/conciliacao/vincular")
    public PagamentoResponse vincularConciliacao(@Valid @RequestBody PagamentoConciliacaoVincularRequest req) {
        return pagamentoConciliacaoApplicationService.vincularConciliacao(req);
    }

    @PostMapping("/conciliacao/desvincular")
    public PagamentoResponse desvincularConciliacao(@Valid @RequestBody PagamentoConciliacaoDesvincularRequest req) {
        return pagamentoConciliacaoApplicationService.desvincularConciliacao(req);
    }

    @GetMapping("/dashboard")
    public PagamentoDashboardResponse dashboard(
            @RequestParam(required = false) Integer ano, @RequestParam(required = false) Integer mes) {
        return pagamentoApplicationService.dashboard(ano, mes);
    }

    @GetMapping("/alertas")
    public PagamentoAlertasResponse alertas() {
        return pagamentoApplicationService.contagemAlertas();
    }

    @GetMapping("/{id}")
    public PagamentoResponse buscar(@PathVariable Long id) {
        return pagamentoApplicationService.buscar(id);
    }

    @PostMapping
    public PagamentoResponse criar(@Valid @RequestBody PagamentoWriteRequest req) {
        return pagamentoApplicationService.criar(req);
    }

    @PutMapping("/{id}")
    public PagamentoResponse atualizar(@PathVariable Long id, @Valid @RequestBody PagamentoWriteRequest req) {
        return pagamentoApplicationService.atualizar(id, req);
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> excluir(@PathVariable Long id) {
        pagamentoApplicationService.excluir(id);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{id}/cancelar")
    public PagamentoResponse cancelar(@PathVariable Long id, @RequestBody(required = false) PagamentoCancelarRequest req) {
        return pagamentoApplicationService.cancelar(id, req);
    }

    @PostMapping("/{id}/marcar-agendado")
    public PagamentoResponse marcarAgendado(@PathVariable Long id) {
        return pagamentoApplicationService.marcarAgendado(id);
    }

    @PostMapping("/{id}/marcar-pago")
    public PagamentoResponse marcarPago(@PathVariable Long id, @Valid @RequestBody PagamentoMarcarPagoRequest req) {
        return pagamentoApplicationService.marcarPago(id, req);
    }

    @PostMapping("/{id}/marcar-recebido")
    public PagamentoResponse marcarRecebido(
            @PathVariable Long id, @Valid @RequestBody PagamentoMarcarRecebidoRequest req) {
        return pagamentoApplicationService.marcarRecebido(id, req);
    }

    @PostMapping("/{id}/substituir")
    public PagamentoResponse substituir(@PathVariable Long id, @RequestParam Long novoPagamentoId) {
        return pagamentoApplicationService.substituir(id, novoPagamentoId);
    }

    @PostMapping("/{id}/conferir")
    public PagamentoResponse conferir(@PathVariable Long id, @Valid @RequestBody PagamentoConferirRequest req) {
        return pagamentoConciliacaoApplicationService.conferir(id, req);
    }

    @PostMapping("/{id}/acertar")
    public PagamentoResponse acertar(@PathVariable Long id, @RequestBody(required = false) PagamentoAcertarRequest req) {
        return pagamentoConciliacaoApplicationService.acertar(id, req);
    }

    @PostMapping("/{id}/reabrir")
    public PagamentoResponse reabrir(@PathVariable Long id, @Valid @RequestBody PagamentoReabrirRequest req) {
        return pagamentoConciliacaoApplicationService.reabrir(id, req);
    }

    @GetMapping("/{id}/historico")
    public List<PagamentoHistoricoResponse> historico(@PathVariable Long id) {
        return pagamentoApplicationService.listarHistorico(id);
    }

    @PostMapping(value = "/{id}/anexo-boleto", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PagamentoResponse anexoBoleto(@PathVariable Long id, @RequestPart("file") MultipartFile file)
            throws Exception {
        return pagamentoApplicationService.anexarBoleto(id, file);
    }

    @PostMapping(value = "/{id}/anexo-comprovante", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PagamentoResponse anexoComprovante(@PathVariable Long id, @RequestPart("file") MultipartFile file)
            throws Exception {
        return pagamentoApplicationService.anexarComprovante(id, file);
    }

    @GetMapping("/{id}/download/boleto")
    public ResponseEntity<Resource> downloadBoleto(@PathVariable Long id) throws Exception {
        Resource r = pagamentoApplicationService.recursoAnexo(id, true);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"boleto\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(r);
    }

    @GetMapping("/{id}/download/comprovante")
    public ResponseEntity<Resource> downloadComprovante(@PathVariable Long id) throws Exception {
        Resource r = pagamentoApplicationService.recursoAnexo(id, false);
        return ResponseEntity.ok()
                .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=\"comprovante\"")
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(r);
    }
}
