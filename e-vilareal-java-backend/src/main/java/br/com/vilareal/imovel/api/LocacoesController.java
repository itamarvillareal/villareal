package br.com.vilareal.imovel.api;

import br.com.vilareal.imovel.api.dto.*;
import br.com.vilareal.imovel.application.ImovelApplicationService;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.support.ServletUriComponentsBuilder;

import java.net.URI;
import java.util.List;

@RestController
@RequestMapping("/api/locacoes")
@Tag(name = "Locações", description = "Contratos e reconciliação (caixa real × ciclo de locação)")
public class LocacoesController {

    private final ImovelApplicationService imovelApplicationService;
    private final LocacaoReconciliacaoService reconciliacaoService;

    public LocacoesController(
            ImovelApplicationService imovelApplicationService,
            LocacaoReconciliacaoService reconciliacaoService) {
        this.imovelApplicationService = imovelApplicationService;
        this.reconciliacaoService = reconciliacaoService;
    }

    @GetMapping("/contratos")
    @Operation(summary = "Listar contratos por imóvel")
    public List<ContratoLocacaoResponse> listarContratos(@RequestParam Long imovelId) {
        return imovelApplicationService.listarContratos(imovelId);
    }

    @PostMapping("/contratos")
    public ResponseEntity<ContratoLocacaoResponse> criarContrato(@Valid @RequestBody ContratoLocacaoWriteRequest request) {
        ContratoLocacaoResponse body = imovelApplicationService.criarContrato(request);
        URI location = ServletUriComponentsBuilder.fromCurrentRequest()
                .path("/{id}")
                .buildAndExpand(body.getId())
                .toUri();
        return ResponseEntity.created(location).body(body);
    }

    @PutMapping("/contratos/{id}")
    public ContratoLocacaoResponse atualizarContrato(
            @PathVariable Long id, @Valid @RequestBody ContratoLocacaoWriteRequest request) {
        return imovelApplicationService.atualizarContrato(id, request);
    }

    // Repasse/despesa LEGADO (locacao_repasse/locacao_despesa) removido — C9/A8.
    // /resultado e reconciliação derivam só de locacao_repasse_lancamento.

    @GetMapping("/repasses-pendentes")
    @Operation(
            summary = "Carteira de repasses em aberto",
            description =
                    "Ciclos com aluguel vinculado e repasse PENDENTE ou DIVERGENTE. Valores derivados dos vínculos existentes.")
    public RepassePendenteCarteiraResponse repassesPendentes(@RequestParam(required = false) String ate) {
        return reconciliacaoService.repassesPendentes(ate);
    }

    @PostMapping("/conciliar-alugueis")
    @Operation(
            summary = "Auto-conciliar aluguéis Cora inequívocos",
            description =
                    "Vincula créditos Cora como ALUGUEL (origem=AUTO) quando há exatamente 1 contrato vigente e 1 crédito na faixa de valor. Idempotente.")
    public ConciliarAlugueisAutomaticoResponse conciliarAlugueisAutomatico(
            @RequestParam(required = false) String competencia) {
        return reconciliacaoService.conciliarAlugueisAutomatico(competencia);
    }

    // ----------------------------------------------------------------- Reconciliação (caixa real)

    @GetMapping("/{contratoId}/reconciliacao/sugestoes")
    @Operation(summary = "Sugestões de papel (ALUGUEL/REPASSE/DESPESA) para os lançamentos do imóvel")
    public List<ReconciliacaoSugestaoItemResponse> sugestoesReconciliacao(
            @PathVariable Long contratoId,
            @RequestParam(required = false) String competencia) {
        return reconciliacaoService.sugerir(contratoId, competencia);
    }

    @PostMapping("/{contratoId}/reconciliacao/vincular")
    @Operation(summary = "Confirmar vínculos (caso a caso ou lote) com o caixa; idempotente")
    public List<ReconciliacaoVinculoResponse> vincularReconciliacao(
            @PathVariable Long contratoId, @Valid @RequestBody ReconciliacaoVincularRequest request) {
        return reconciliacaoService.vincular(contratoId, request);
    }

    @DeleteMapping("/{contratoId}/reconciliacao/vinculos/{vinculoId}")
    @Operation(summary = "Desfazer um vínculo de reconciliação")
    public ResponseEntity<Void> desvincularReconciliacao(
            @PathVariable Long contratoId, @PathVariable Long vinculoId) {
        reconciliacaoService.desvincular(contratoId, vinculoId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{contratoId}/resultado")
    @Operation(summary = "Resultado por competência (ou período) calculado somente dos vínculos")
    public ReconciliacaoResultadoResponse resultadoReconciliacao(
            @PathVariable Long contratoId,
            @RequestParam(required = false) String competencia,
            @RequestParam(required = false) String inicio,
            @RequestParam(required = false) String fim) {
        return reconciliacaoService.resultado(contratoId, competencia, inicio, fim);
    }
}
