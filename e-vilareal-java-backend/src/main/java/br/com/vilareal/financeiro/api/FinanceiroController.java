package br.com.vilareal.financeiro.api;

import br.com.vilareal.financeiro.api.dto.*;
import br.com.vilareal.financeiro.application.CartaoBancoMapeamentoApplicationService;
import br.com.vilareal.financeiro.application.FinanceiroApplicationService;
import br.com.vilareal.financeiro.application.FinanceiroCompensacaoService;
import br.com.vilareal.financeiro.application.FinanceiroFaturaSugestaoService;
import br.com.vilareal.financeiro.application.FinanceiroMesApplicationService;
import br.com.vilareal.financeiro.application.FinanceiroSaudeService;
import br.com.vilareal.financeiro.application.FinanceiroSugestaoService;
import br.com.vilareal.financeiro.application.RegraClassificacaoApplicationService;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
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
import java.util.Map;

@RestController
@RequestMapping("/api/financeiro")
@Tag(name = "Financeiro")
public class FinanceiroController {

    private final FinanceiroApplicationService financeiroService;
    private final FinanceiroCartaoApplicationService financeiroCartaoService;
    private final FinanceiroPagamentoFaturaApplicationService pagamentoFaturaService;
    private final RegraClassificacaoApplicationService regraClassificacaoService;
    private final FinanceiroSugestaoService financeiroSugestaoService;
    private final FinanceiroCompensacaoService financeiroCompensacaoService;
    private final CartaoBancoMapeamentoApplicationService cartaoBancoMapeamentoService;
    private final FinanceiroFaturaSugestaoService financeiroFaturaSugestaoService;
    private final FinanceiroSaudeService financeiroSaudeService;
    private final FinanceiroMesApplicationService financeiroMesService;

    public FinanceiroController(
            FinanceiroApplicationService financeiroService,
            FinanceiroCartaoApplicationService financeiroCartaoService,
            FinanceiroPagamentoFaturaApplicationService pagamentoFaturaService,
            RegraClassificacaoApplicationService regraClassificacaoService,
            FinanceiroSugestaoService financeiroSugestaoService,
            FinanceiroCompensacaoService financeiroCompensacaoService,
            CartaoBancoMapeamentoApplicationService cartaoBancoMapeamentoService,
            FinanceiroFaturaSugestaoService financeiroFaturaSugestaoService,
            FinanceiroSaudeService financeiroSaudeService,
            FinanceiroMesApplicationService financeiroMesService) {
        this.financeiroService = financeiroService;
        this.financeiroCartaoService = financeiroCartaoService;
        this.pagamentoFaturaService = pagamentoFaturaService;
        this.regraClassificacaoService = regraClassificacaoService;
        this.financeiroSugestaoService = financeiroSugestaoService;
        this.financeiroCompensacaoService = financeiroCompensacaoService;
        this.cartaoBancoMapeamentoService = cartaoBancoMapeamentoService;
        this.financeiroFaturaSugestaoService = financeiroFaturaSugestaoService;
        this.financeiroSaudeService = financeiroSaudeService;
        this.financeiroMesService = financeiroMesService;
    }

    @GetMapping("/saude")
    @Operation(description = "Indicadores de saúde do módulo financeiro.")
    public FinanceiroSaudeResponse saude() {
        return financeiroSaudeService.obterSaude();
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

    @GetMapping("/lancamentos/contadores-etapa")
    @Operation(description = "Contagem de lançamentos bancários por etapa do workflow.")
    public Map<String, Long> contadoresEtapa() {
        return financeiroService.contarPorEtapa();
    }

    @GetMapping("/lancamentos/saldo-banco")
    @Operation(description = "Saldo acumulado (crédito − débito) e data do último lançamento do banco.")
    public SaldoBancoResponse saldoBanco(@RequestParam("numeroBanco") Integer numeroBanco) {
        return financeiroService.saldoPorNumeroBanco(numeroBanco);
    }

    @GetMapping("/lancamentos/paginada")
    @Operation(description = "Mesmos filtros de GET /lancamentos, com paginação.")
    public Page<LancamentoFinanceiroResponse> listarLancamentosPaginada(
            @RequestParam(value = "clienteId", required = false) Long clienteId,
            @RequestParam(value = "processoId", required = false) Long processoId,
            @RequestParam(value = "contaContabilId", required = false) Long contaContabilId,
            @RequestParam(value = "dataInicio", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataInicio,
            @RequestParam(value = "dataFim", required = false) @DateTimeFormat(iso = DateTimeFormat.ISO.DATE) LocalDate dataFim,
            @RequestParam(value = "etapa", required = false) String etapa,
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco,
            @RequestParam(value = "busca", required = false) String busca,
            @RequestParam(value = "semClienteId", required = false) Boolean semClienteId,
            @RequestParam(value = "semGrupoCompensacao", required = false) Boolean semGrupoCompensacao,
            @RequestParam(value = "ano", required = false) Integer ano,
            @RequestParam(value = "mes", required = false) Integer mes,
            @PageableDefault(size = 20, sort = "dataLancamento", direction = Sort.Direction.ASC) Pageable pageable) {
        EtapaLancamento etapaEnum = null;
        if (etapa != null && !etapa.isBlank()) {
            etapaEnum = EtapaLancamento.valueOf(etapa.trim().toUpperCase());
        }
        return financeiroService.listarLancamentosPaginado(
                clienteId,
                processoId,
                contaContabilId,
                dataInicio,
                dataFim,
                etapaEnum,
                numeroBanco,
                busca,
                semClienteId,
                semGrupoCompensacao,
                ano,
                mes,
                pageable);
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

    @GetMapping("/lancamentos/{id}/sugestao-classificacao")
    @Operation(description = "Sugestões de classificação (regras, histórico, recorrência).")
    public List<SugestaoClassificacaoResponse> sugestaoClassificacao(@PathVariable Long id) {
        return financeiroSugestaoService.sugerir(id);
    }

    @PostMapping("/lancamentos/sugestoes-classificacao/lote")
    @Operation(description = "Sugestões em lote (máx. 50 lançamentos).")
    public SugestaoClassificacaoLoteResponse sugestoesClassificacaoLote(
            @Valid @RequestBody SugestaoClassificacaoLoteRequest request) {
        SugestaoClassificacaoLoteResponse response = new SugestaoClassificacaoLoteResponse();
        response.setSugestoes(financeiroSugestaoService.sugerirLote(request.getLancamentoIds()));
        return response;
    }

    @PostMapping("/lancamentos/aplicar-sugestao")
    @Operation(description = "Aplica classificação sugerida e recalcula etapa.")
    public LancamentoFinanceiroResponse aplicarSugestao(@Valid @RequestBody AplicarSugestaoRequest request) {
        return financeiroSugestaoService.aplicarSugestao(request);
    }

    @PostMapping("/lancamentos/aplicar-sugestoes/lote")
    @Operation(description = "Aplica classificações em lote.")
    public AplicarSugestaoLoteResult aplicarSugestoesLote(@Valid @RequestBody AplicarSugestaoLoteRequest request) {
        return financeiroSugestaoService.aplicarSugestoesLote(request);
    }

    @PostMapping("/lancamentos/auto-classificar")
    @Operation(description = "Auto-classificação por confiança mínima (dry-run ou aplicação).")
    public AutoClassificarResponse autoClassificar(@Valid @RequestBody AutoClassificarRequest request) {
        return financeiroSugestaoService.autoClassificar(request);
    }

    @PostMapping("/lancamentos/parear")
    @Operation(description = "Pareia lançamentos de compensação (conta E + grupo_compensacao).")
    public ParearCompensacaoResponse parearCompensacao(@Valid @RequestBody ParearCompensacaoRequest request) {
        return financeiroCompensacaoService.parear(request);
    }

    @DeleteMapping("/lancamentos/parear/{grupoCompensacao}")
    @Operation(description = "Remove vínculo de compensação de um grupo (volta conta N / IMPORTADO).")
    public DesparearCompensacaoResponse desparearCompensacao(@PathVariable String grupoCompensacao) {
        return financeiroCompensacaoService.desparear(grupoCompensacao);
    }

    @GetMapping("/lancamentos/pares-sugeridos")
    @Operation(description = "Pares de compensação sugeridos (valor oposto, sem grupo, janela de datas).")
    public ParesSugeridosCompensacaoResponse paresSugeridos(
            @RequestParam(value = "numeroBanco", required = false) Integer numeroBanco,
            @RequestParam(value = "ano", required = false) Integer ano,
            @RequestParam(value = "mes", required = false) Integer mes,
            @RequestParam(value = "apenasInterbancario", defaultValue = "false") boolean apenasInterbancario,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "50") int size) {
        return financeiroCompensacaoService.listarParesSugeridos(
                numeroBanco, ano, mes, page, size, apenasInterbancario);
    }

    @GetMapping("/lancamentos/grupos-compensacao/inconsistentes")
    @Operation(description = "Grupos de compensação cuja soma não fecha em zero.")
    public GruposCompensacaoInconsistentesResponse gruposCompensacaoInconsistentes(
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        return financeiroCompensacaoService.listarGruposInconsistentes(page, size);
    }

    @PostMapping("/lancamentos/auto-parear")
    @Operation(description = "Pareamento automático de pares sugeridos (dry-run ou aplicação).")
    public AutoParearResponse autoParear(@Valid @RequestBody AutoParearRequest request) {
        return financeiroCompensacaoService.autoParear(request);
    }

    @PostMapping("/lancamentos/fechar-mes")
    @Operation(description = "Fecha o mês bancário (etapa FECHADO) se não houver IMPORTADO.")
    public FecharMesResponse fecharMes(@Valid @RequestBody FecharMesRequest request) {
        return financeiroMesService.fecharMes(request);
    }

    @PostMapping("/lancamentos/reabrir-mes")
    @Operation(description = "Reabre lançamentos FECHADO recalculando a etapa.")
    public ReabrirMesResponse reabrirMes(@Valid @RequestBody FecharMesRequest request) {
        return financeiroMesService.reabrirMes(request);
    }

    // --- Regras de classificação ---

    @GetMapping("/regras-classificacao")
    @Operation(description = "Lista regras de classificação (ativas e inativas).")
    public List<RegraClassificacaoResponse> listarRegrasClassificacao() {
        return regraClassificacaoService.listarTodas();
    }

    @GetMapping("/regras-classificacao/{id}")
    public RegraClassificacaoResponse buscarRegraClassificacao(@PathVariable Long id) {
        return regraClassificacaoService.buscar(id);
    }

    @PostMapping("/regras-classificacao")
    public ResponseEntity<RegraClassificacaoResponse> criarRegraClassificacao(
            @Valid @RequestBody RegraClassificacaoWriteRequest request) {
        RegraClassificacaoResponse body = regraClassificacaoService.criar(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/regras-classificacao/{id}")
    public RegraClassificacaoResponse atualizarRegraClassificacao(
            @PathVariable Long id,
            @Valid @RequestBody RegraClassificacaoWriteRequest request) {
        return regraClassificacaoService.atualizar(id, request);
    }

    @DeleteMapping("/regras-classificacao/{id}")
    public ResponseEntity<Void> removerRegraClassificacao(@PathVariable Long id) {
        regraClassificacaoService.remover(id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
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

    @GetMapping("/pagamentos-fatura/sugestoes")
    @Operation(description = "Sugestões de vínculo pagamento de fatura (banco ↔ cartão).")
    public SugestoesPagamentoFaturaResponse sugestoesPagamentoFatura(
            @RequestParam("mes") String mes,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "20") int size) {
        return financeiroFaturaSugestaoService.listarSugestoes(mes, page, size);
    }

    // --- Mapeamento cartão ↔ banco (fatura) ---

    @GetMapping("/cartao-banco-mapeamento")
    @Operation(description = "Lista regras de mapeamento débito bancário → cartão.")
    public List<CartaoBancoMapeamentoResponse> listarCartaoBancoMapeamento() {
        return cartaoBancoMapeamentoService.listarTodas();
    }

    @GetMapping("/cartao-banco-mapeamento/{id}")
    public CartaoBancoMapeamentoResponse buscarCartaoBancoMapeamento(@PathVariable Long id) {
        return cartaoBancoMapeamentoService.buscar(id);
    }

    @PostMapping("/cartao-banco-mapeamento")
    public ResponseEntity<CartaoBancoMapeamentoResponse> criarCartaoBancoMapeamento(
            @Valid @RequestBody CartaoBancoMapeamentoWriteRequest request) {
        CartaoBancoMapeamentoResponse body = cartaoBancoMapeamentoService.criar(request);
        URI uri = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(uri).body(body);
    }

    @PutMapping("/cartao-banco-mapeamento/{id}")
    public CartaoBancoMapeamentoResponse atualizarCartaoBancoMapeamento(
            @PathVariable Long id, @Valid @RequestBody CartaoBancoMapeamentoWriteRequest request) {
        return cartaoBancoMapeamentoService.atualizar(id, request);
    }

    @DeleteMapping("/cartao-banco-mapeamento/{id}")
    public ResponseEntity<Void> removerCartaoBancoMapeamento(@PathVariable Long id) {
        cartaoBancoMapeamentoService.remover(id);
        return ResponseEntity.status(HttpStatus.NO_CONTENT).build();
    }
}
