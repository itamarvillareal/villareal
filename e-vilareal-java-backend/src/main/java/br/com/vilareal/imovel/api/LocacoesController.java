package br.com.vilareal.imovel.api;

import br.com.vilareal.imovel.api.dto.*;
import br.com.vilareal.imovel.application.AluguelCobrancaService;
import br.com.vilareal.imovel.application.AluguelFollowupService;
import br.com.vilareal.imovel.application.DespesaCondominioAutoConciliacaoService;
import br.com.vilareal.imovel.application.DespesaCondominioCandidatoService;
import br.com.vilareal.imovel.application.DespesaCondominioConfirmacaoService;
import br.com.vilareal.imovel.application.ImovelApplicationService;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResultDTO;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.util.StringUtils;
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
    private final DespesaCondominioCandidatoService despesaCondominioCandidatoService;
    private final DespesaCondominioConfirmacaoService despesaCondominioConfirmacaoService;
    private final DespesaCondominioAutoConciliacaoService despesaCondominioAutoConciliacaoService;
    private final AluguelCobrancaService aluguelCobrancaService;
    private final AluguelFollowupService aluguelFollowupService;

    public LocacoesController(
            ImovelApplicationService imovelApplicationService,
            LocacaoReconciliacaoService reconciliacaoService,
            DespesaCondominioCandidatoService despesaCondominioCandidatoService,
            DespesaCondominioConfirmacaoService despesaCondominioConfirmacaoService,
            DespesaCondominioAutoConciliacaoService despesaCondominioAutoConciliacaoService,
            AluguelCobrancaService aluguelCobrancaService,
            AluguelFollowupService aluguelFollowupService) {
        this.imovelApplicationService = imovelApplicationService;
        this.reconciliacaoService = reconciliacaoService;
        this.despesaCondominioCandidatoService = despesaCondominioCandidatoService;
        this.despesaCondominioConfirmacaoService = despesaCondominioConfirmacaoService;
        this.despesaCondominioAutoConciliacaoService = despesaCondominioAutoConciliacaoService;
        this.aluguelCobrancaService = aluguelCobrancaService;
        this.aluguelFollowupService = aluguelFollowupService;
    }

    @GetMapping("/contratos")
    @Operation(summary = "Listar contratos por imóvel (opcionalmente filtrados por processo/Cod.+Proc.)")
    public List<ContratoLocacaoResponse> listarContratos(
            @RequestParam Long imovelId, @RequestParam(required = false) Long processoId) {
        return imovelApplicationService.listarContratos(imovelId, processoId);
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

    @GetMapping("/sugestoes-alugueis-pendentes")
    @Operation(
            summary = "Sugestões de aluguel para contratos sem crédito na competência",
            description =
                    "Read-only: cruza créditos do extrato ainda sem Cod.+Proc. (ex.: PIX Cora com o nome do "
                            + "pagador) e créditos Cora do processo com nome do inquilino × valor × dia de "
                            + "vencimento. A confirmação usa POST /{contratoId}/reconciliacao/vincular.")
    public SugestoesAluguelPendenteResponse sugestoesAlugueisPendentes(
            @RequestParam(required = false) String competencia) {
        return reconciliacaoService.sugerirAlugueisPendentes(competencia);
    }

    @GetMapping("/alugueis-triagem")
    @Operation(
            summary = "Triagem automática dos aluguéis da competência",
            description =
                    "Classifica cada contrato pendente: PAGAMENTO_PROVAVEL (crédito no extrato — conciliar), "
                            + "EM_ATRASO (vencido sem crédito — cobrar) ou A_VENCER. Read-only.")
    public AluguelTriagemResponse alugueisTriagem(@RequestParam(required = false) String competencia) {
        return aluguelCobrancaService.triagem(competencia);
    }

    @PostMapping("/alugueis-cobrar")
    @Operation(
            summary = "Disparar cobrança WhatsApp para aluguéis em atraso",
            description =
                    "Envia o template cobranca_pagamento aos inquilinos dos contratos selecionados. "
                            + "Contratos cujo aluguel foi vinculado nesse meio tempo são ignorados.")
    public CobrancaLoteResultDTO cobrarAlugueis(@Valid @RequestBody AluguelTriagemResponse.CobrarRequest request) {
        return aluguelCobrancaService.cobrarAlugueis(
                request.contratoIds(), request.competencia(), currentUsername());
    }

    @GetMapping("/alugueis-followup")
    @Operation(
            summary = "Casos em aberto de aluguel com próxima ação calculada (follow-up)",
            description =
                    "Cada contrato × competência vencida sem pagamento vira um caso acompanhado até a "
                            + "resolução: a API verifica sozinha se o inquilino respondeu no WhatsApp e diz "
                            + "a próxima ação (enviar, reenviar, ligar, verificar resposta) com prazo. "
                            + "Analisa também competências anteriores para nada cair no esquecimento.")
    public AluguelFollowupResponse alugueisFollowup(
            @RequestParam(required = false) String competencia,
            @RequestParam(required = false) Integer meses) {
        return aluguelFollowupService.followup(competencia, meses);
    }

    @PostMapping("/alugueis-followup/evento")
    @Operation(
            summary = "Registrar evento manual de um caso de follow-up",
            description = "Tipos: LIGACAO (liguei para o inquilino), ANOTACAO, ADIAR (com adiadoAte) "
                    + "ou RESOLVIDO_MANUAL (tira o caso da lista).")
    public ResponseEntity<Void> registrarEventoFollowup(
            @Valid @RequestBody AluguelFollowupResponse.EventoRequest request) {
        aluguelFollowupService.registrarEvento(request, currentUsername());
        return ResponseEntity.noContent().build();
    }

    private static String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        return auth != null && StringUtils.hasText(auth.getName()) ? auth.getName() : "sistema";
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

    @GetMapping("/despesas-condominio/candidatos")
    @Operation(
            summary = "Candidatos read-only: débitos recorrentes de condomínio",
            description =
                    "Agrupa saídas do extrato (contas A/I, descrição com CONDOM, ≥2 meses) e sugere imóvel "
                            + "pelo nome do condomínio. Não grava vínculos.")
    public DespesaCondominioCandidatosResponse candidatosDespesaCondominio() {
        return despesaCondominioCandidatoService.candidatosDespesaCondominio();
    }

    @PostMapping("/despesas-condominio/confirmar")
    @Operation(
            summary = "Confirmar condomínio pago pelo escritório",
            description =
                    "Marca imóvel com responsável ESCRITORIO e cria recorrência CONDOMINIO no A Pagar. "
                            + "Idempotente. Não altera repasse/LRL DESPESA.")
    public DespesaCondominioConfirmarResponse confirmarDespesaCondominio(
            @Valid @RequestBody DespesaCondominioConfirmarRequest request) {
        return despesaCondominioConfirmacaoService.confirmarDespesaCondominio(
                request.obrigacaoChave(), request.imovelId());
    }

    @PostMapping("/despesas-condominio/conciliar-automatico")
    @Operation(
            summary = "Auto-conciliar condomínio inequívoco",
            description =
                    "Vincula pagamentos CONDOMINIO em aberto ao débito do mês quando há exatamente 1 candidato "
                            + "(grafia + valor ±15%). Idempotente. Reversível via desvincular conciliação.")
    public ConciliarCondominioAutomaticoResponse conciliarCondominioAutomatico(
            @RequestParam(required = false) String competencia) {
        return despesaCondominioAutoConciliacaoService.conciliarCondominioAutomatico(competencia);
    }

    @GetMapping("/{contratoId}/reconciliacao/vinculos")
    @Operation(summary = "Vínculos de reconciliação do contrato (aluguel/repasse/despesa por lançamento)")
    public List<ReconciliacaoVinculoResponse> listarVinculosReconciliacao(@PathVariable Long contratoId) {
        return reconciliacaoService.listarVinculosContrato(contratoId);
    }

    @GetMapping("/{contratoId}/reconciliacao/matriz-competencias")
    @Operation(
            summary = "Checklist de competências para classificar aluguéis",
            description =
                    "Por mês: aluguel vinculado ou créditos candidatos. Base da UI de classificação mensal.")
    public MatrizCompetenciasResponse matrizCompetencias(
            @PathVariable Long contratoId, @RequestParam(required = false, defaultValue = "18") Integer meses) {
        return reconciliacaoService.matrizCompetencias(contratoId, meses);
    }

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

    @PostMapping("/{contratoId}/reconciliacao/gerar-repasses-internos")
    @Operation(
            summary = "Gerar repasses internos (imóvel próprio)",
            description =
                    "Cria par débito + crédito na conta virtual 900 para cada ALUGUEL vinculado ainda "
                            + "sem REPASSE. Idempotente. Disparo manual (não automático ao vincular).")
    public GerarRepassesInternosResponse gerarRepassesInternos(
            @PathVariable Long contratoId, @RequestParam(required = false) String competencia) {
        return reconciliacaoService.gerarRepassesInternosContrato(contratoId, competencia);
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
