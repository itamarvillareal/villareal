package br.com.vilareal.financeiro.api;

import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.application.FinanceiroApplicationService;
import br.com.vilareal.financeiro.application.FinanceiroCartaoApplicationService;
import br.com.vilareal.financeiro.application.FinanceiroPagamentoFaturaApplicationService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.MediaType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.data.web.PageableDefault;
import org.springframework.format.annotation.DateTimeFormat;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.time.LocalDate;
import java.util.List;

@RestController
@RequestMapping("/api/financeiro")
@Tag(name = "Financeiro")
public class FinanceiroController {

    private final FinanceiroApplicationService financeiroService;
    private final FinanceiroCartaoApplicationService financeiroCartaoService;
    private final FinanceiroPagamentoFaturaApplicationService pagamentoFaturaService;

    public FinanceiroController(
            FinanceiroApplicationService financeiroService,
            FinanceiroCartaoApplicationService financeiroCartaoService,
            FinanceiroPagamentoFaturaApplicationService pagamentoFaturaService) {
        this.financeiroService = financeiroService;
        this.financeiroCartaoService = financeiroCartaoService;
        this.pagamentoFaturaService = pagamentoFaturaService;
    }

    @GetMapping("/contas")
    @Operation(description = "Lista contas contábeis ativas (plano padrão + ordem de exibição).")
    public List<ContaContabilResponse> listarContas() {
        return financeiroService.listarContasAtivas();
    }

    @PostMapping("/contas")
    public ResponseEntity<ContaContabilResponse> criarConta(@Valid @RequestBody ContaContabilWriteRequest request) {
        ContaContabilResponse body = financeiroService.criarConta(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/contas/{id}")
    public ContaContabilResponse atualizarConta(@PathVariable Long id, @Valid @RequestBody ContaContabilWriteRequest request) {
        return financeiroService.atualizarConta(id, request);
    }

    @GetMapping("/lancamentos/resumo-processo/{processoId}")
    @Operation(description = "Saldo (crédito − débito) e total de lançamentos vinculados ao processo.")
    public ResumoProcessoFinanceiroResponse resumoProcesso(@PathVariable Long processoId) {
        return financeiroService.resumoPorProcesso(processoId);
    }

    @GetMapping("/lancamentos")
    @Operation(description = "Lista lançamentos com filtros opcionais (paridade com `financeiroRepository.js`).")
    public List<LancamentoFinanceiroResponse> listarLancamentos(
            @RequestParam(value = "clienteId", required = false) Long clienteId,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "contaContabilId", required = false) Long contaContabilId,
            @RequestParam(value = "dataInicio", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(value = "dataFim", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim) {
        return financeiroService.listarLancamentos(clienteId, processoId, contaContabilId, dataInicio, dataFim);
    }

    @GetMapping("/lancamentos/paginada")
    @Operation(description = "Mesmos filtros de GET /lancamentos, com paginação.")
    public Page<LancamentoFinanceiroResponse> listarLancamentosPaginada(
            @RequestParam(value = "clienteId", required = false) Long clienteId,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "contaContabilId", required = false) Long contaContabilId,
            @RequestParam(value = "dataInicio", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(value = "dataFim", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @PageableDefault(size = 20, sort = "dataLancamento", direction = Sort.Direction.ASC) Pageable pageable) {
        return financeiroService.listarLancamentosPaginado(
                clienteId, processoId, contaContabilId, dataInicio, dataFim, pageable);
    }

    @GetMapping("/lancamentos/{id}")
    public LancamentoFinanceiroResponse buscarLancamento(@PathVariable Long id) {
        return financeiroService.buscarLancamento(id);
    }

    @PostMapping("/lancamentos")
    public ResponseEntity<LancamentoFinanceiroResponse> criarLancamento(@Valid @RequestBody LancamentoFinanceiroWriteRequest request) {
        LancamentoFinanceiroResponse body = financeiroService.criarLancamento(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/lancamentos/{id}")
    public LancamentoFinanceiroResponse atualizarLancamento(
            @PathVariable Long id,
            @Valid @RequestBody LancamentoFinanceiroWriteRequest request) {
        return financeiroService.atualizarLancamento(id, request);
    }

    @DeleteMapping("/lancamentos/{id}")
    public ResponseEntity<Void> removerLancamento(@PathVariable Long id) {
        financeiroService.removerLancamento(id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PostMapping("/lancamentos/grupos-compensacao/lote")
    @Operation(description = "Backfill: atualiza grupo_compensacao (planilha col. M) por numeroLancamento.")
    public GrupoCompensacaoLoteResult sincronizarGruposCompensacaoLote(
            @Valid @RequestBody List<GrupoCompensacaoLoteItemRequest> itens) {
        return financeiroService.sincronizarGruposCompensacaoLote(itens);
    }

    @PostMapping(value = "/lancamentos/limpar-extrato", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(description = "Remove todos os lançamentos do extrato (por nome normalizado e/ou numeroBanco). Elos entre bancos foram removidos do modelo (V34).")
    public LimparExtratoResult limparExtratoBanco(@Valid @RequestBody LimparExtratoRequest request) {
        return financeiroService.limparExtratoBancoEElosRelacionados(
                request.getBanco(), request.getNumeroBanco());
    }

    /** Legado: clientes que ainda enviam query string (sem corpo JSON). */
    @PostMapping(value = "/lancamentos/limpar-extrato", consumes = MediaType.APPLICATION_FORM_URLENCODED_VALUE)
    @Operation(hidden = true)
    public LimparExtratoResult limparExtratoBancoForm(
            @RequestParam("banco") String banco,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco) {
        return financeiroService.limparExtratoBancoEElosRelacionados(banco, numeroBanco);
    }

    @PostMapping("/lancamentos/limpar-extrato-cora")
    @Operation(description = "Legado: equivalente a limpar-extrato?banco=CORA.")
    public LimparExtratoResult limparExtratoCoraEElosRelacionados() {
        return financeiroService.limparExtratoCoraEElosRelacionados();
    }

    // --- Cartões (extrato fatura; sinal da fatura, sem inversão) ---

    @GetMapping("/cartoes")
    @Operation(description = "Lista cartões de crédito ativos (extrato separado de contas bancárias).")
    public List<CartaoResponse> listarCartoes() {
        return financeiroCartaoService.listarCartoesAtivos();
    }

    @GetMapping("/cartoes/lancamentos")
    @Operation(description = "Lista lançamentos de extrato de cartão (valor com sinal da fatura).")
    public List<LancamentoCartaoResponse> listarLancamentosCartao(
            @RequestParam(value = "clienteId", required = false) Long clienteId,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "contaContabilId", required = false) Long contaContabilId,
            @RequestParam(value = "cartaoId", required = false) Long cartaoId,
            @RequestParam(value = "dataInicio", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(value = "dataFim", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim) {
        return financeiroCartaoService.listarLancamentos(
                clienteId, processoId, contaContabilId, cartaoId, dataInicio, dataFim);
    }

    @GetMapping("/cartoes/lancamentos/{id}")
    public LancamentoCartaoResponse buscarLancamentoCartao(@PathVariable Long id) {
        return financeiroCartaoService.buscarLancamento(id);
    }

    @PostMapping("/cartoes/lancamentos")
    public ResponseEntity<LancamentoCartaoResponse> criarLancamentoCartao(
            @Valid @RequestBody LancamentoCartaoWriteRequest request) {
        LancamentoCartaoResponse body = financeiroCartaoService.criarLancamento(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/cartoes/lancamentos/{id}")
    public LancamentoCartaoResponse atualizarLancamentoCartao(
            @PathVariable Long id,
            @Valid @RequestBody LancamentoCartaoWriteRequest request) {
        return financeiroCartaoService.atualizarLancamento(id, request);
    }

    @DeleteMapping("/cartoes/lancamentos/{id}")
    public ResponseEntity<Void> removerLancamentoCartao(@PathVariable Long id) {
        financeiroCartaoService.removerLancamento(id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }

    @PostMapping(value = "/cartoes/limpar-extrato", consumes = MediaType.APPLICATION_JSON_VALUE)
    @Operation(description = "Remove todos os lançamentos do extrato do cartão indicado.")
    public LimparExtratoResult limparExtratoCartao(@Valid @RequestBody LimparExtratoCartaoRequest request) {
        return financeiroCartaoService.limparExtratoCartao(request.getCartao(), request.getNumeroCartao());
    }

    // --- Pagamento de fatura (vínculo explícito banco ↔ cartão) ---

    @GetMapping("/pagamentos-fatura/vinculos")
    @Operation(description = "Lista vínculos explícitos entre débito no banco e pagamento na fatura do cartão.")
    public List<PagamentoFaturaVinculoResponse> listarVinculosPagamentoFatura() {
        return pagamentoFaturaService.listarVinculos();
    }

    @PostMapping("/pagamentos-fatura/vinculos")
    public ResponseEntity<PagamentoFaturaVinculoResponse> criarVinculoPagamentoFatura(
            @Valid @RequestBody PagamentoFaturaVinculoWriteRequest request) {
        PagamentoFaturaVinculoResponse body = pagamentoFaturaService.criarVinculo(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @DeleteMapping("/pagamentos-fatura/vinculos/{id}")
    public ResponseEntity<Void> removerVinculoPagamentoFatura(@PathVariable Long id) {
        pagamentoFaturaService.removerVinculo(id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
