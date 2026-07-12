package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.api.dto.AluguelTriagemResponse;
import br.com.vilareal.imovel.api.dto.SugestoesAluguelPendenteResponse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.AgendarCobrancaResultDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaItemDTO;
import br.com.vilareal.whatsapp.dto.CobrancaWhatsAppDTOs.CobrancaLoteResultDTO;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.service.CobrancaWhatsAppService;
import br.com.vilareal.whatsapp.service.WhatsAppService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.YearMonth;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Triagem dos aluguéis da competência + disparo de cobrança WhatsApp (template
 * {@code cobranca_pagamento}) para os contratos em atraso — o usuário apenas aprova.
 */
@Service
public class AluguelCobrancaService {

    /** Dia de vencimento presumido quando o contrato não informa. */
    private static final int DIA_VENCIMENTO_PADRAO = 10;

    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final Logger log = LoggerFactory.getLogger(AluguelCobrancaService.class);

    public static final String SITUACAO_PAGAMENTO_PROVAVEL = "PAGAMENTO_PROVAVEL";
    public static final String SITUACAO_EM_ATRASO = "EM_ATRASO";
    public static final String SITUACAO_A_VENCER = "A_VENCER";

    /** Horário padrão do envio agendado (09:00 BRT). */
    private static final LocalTime HORA_ENVIO_AGENDADO = LocalTime.of(9, 0);

    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LocacaoReconciliacaoService reconciliacaoService;
    private final ImovelProcessoRepository imovelProcessoRepository;
    private final CobrancaWhatsAppService cobrancaWhatsAppService;
    private final CobrancaWhatsAppRepository cobrancaWhatsAppRepository;

    public AluguelCobrancaService(
            ContratoLocacaoRepository contratoLocacaoRepository,
            LocacaoReconciliacaoService reconciliacaoService,
            ImovelProcessoRepository imovelProcessoRepository,
            CobrancaWhatsAppService cobrancaWhatsAppService,
            CobrancaWhatsAppRepository cobrancaWhatsAppRepository) {
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.reconciliacaoService = reconciliacaoService;
        this.imovelProcessoRepository = imovelProcessoRepository;
        this.cobrancaWhatsAppService = cobrancaWhatsAppService;
        this.cobrancaWhatsAppRepository = cobrancaWhatsAppRepository;
    }

    /**
     * Read-only: classifica cada contrato vigente sem aluguel na competência em
     * PAGAMENTO_PROVAVEL (crédito no extrato — conciliar), EM_ATRASO (cobrar) ou A_VENCER.
     */
    @Transactional(readOnly = true)
    public AluguelTriagemResponse triagem(String competenciaParam) {
        YearMonth ym = parseCompetenciaOuAtual(competenciaParam);
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);

        Map<Long, SugestoesAluguelPendenteResponse.ContratoPendenteItem> sugestaoPorContrato = new HashMap<>();
        for (SugestoesAluguelPendenteResponse.ContratoPendenteItem c :
                reconciliacaoService.sugerirAlugueisPendentes(ym.toString()).contratos()) {
            sugestaoPorContrato.put(c.contratoId(), c);
        }

        List<AluguelTriagemResponse.Item> itens = new ArrayList<>();
        int pagamentoProvavel = 0;
        int emAtraso = 0;
        int aVencer = 0;
        for (ContratoLocacaoEntity contrato : contratosPendentes(ym)) {
            AluguelTriagemResponse.Item item = montarItem(contrato, ym, hoje, sugestaoPorContrato.get(contrato.getId()));
            switch (item.situacao()) {
                case SITUACAO_PAGAMENTO_PROVAVEL -> pagamentoProvavel++;
                case SITUACAO_EM_ATRASO -> emAtraso++;
                default -> aVencer++;
            }
            itens.add(item);
        }

        // Atrasados primeiro (maior atraso no topo), depois conciliáveis, depois a vencer.
        Map<String, Integer> pesoSituacao = Map.of(
                SITUACAO_EM_ATRASO, 0, SITUACAO_PAGAMENTO_PROVAVEL, 1, SITUACAO_A_VENCER, 2);
        itens.sort(Comparator
                .comparing((AluguelTriagemResponse.Item i) -> pesoSituacao.getOrDefault(i.situacao(), 3))
                .thenComparing(AluguelTriagemResponse.Item::diasAtraso, Comparator.reverseOrder())
                .thenComparing(
                        AluguelTriagemResponse.Item::imovelNumeroPlanilha,
                        Comparator.nullsLast(Integer::compareTo)));

        return new AluguelTriagemResponse(
                ym.toString(), itens.size(), pagamentoProvavel, emAtraso, aVencer, itens);
    }

    /**
     * Dispara a cobrança WhatsApp (template existente) para os contratos selecionados. Só aceita
     * contrato que continue pendente na competência — se o aluguel foi vinculado nesse meio tempo,
     * o contrato é ignorado (nunca cobra quem já pagou).
     */
    @Transactional
    public CobrancaLoteResultDTO cobrarAlugueis(
            List<Long> contratoIds, String competenciaParam, String createdBy, boolean agendarCobrancaWhatsApp) {
        if (contratoIds == null || contratoIds.isEmpty()) {
            throw new BusinessRuleException("Selecione ao menos um contrato para cobrança.");
        }
        YearMonth ym = parseCompetenciaOuAtual(competenciaParam);
        Set<Long> selecionados = new HashSet<>(contratoIds);

        List<CobrancaItemDTO> itens = new ArrayList<>();
        List<ContratoLocacaoEntity> contratosSelecionados = new ArrayList<>();
        for (ContratoLocacaoEntity contrato : contratosPendentes(ym)) {
            if (!selecionados.contains(contrato.getId())) {
                continue;
            }
            itens.add(montarItemCobranca(contrato));
            contratosSelecionados.add(contrato);
        }
        if (itens.isEmpty()) {
            throw new BusinessRuleException(
                    "Nenhum dos contratos selecionados segue com aluguel pendente em " + ym + ".");
        }
        String loteDescricao = "Aluguel em atraso · " + ym;

        boolean agendar = agendarCobrancaWhatsApp
                || contratosSelecionados.stream().anyMatch(c -> Boolean.TRUE.equals(c.getAgendarCobrancaWhatsApp()));
        if (agendar) {
            Instant scheduledAt = instantVencimentoCompetencia(contratosSelecionados.get(0), ym);
            log.info(
                    "[cobranca-aluguel] agendamento lote competencia={} contratos={} scheduledAt={}",
                    ym,
                    itens.size(),
                    scheduledAt);
            AgendarCobrancaResultDTO ag =
                    cobrancaWhatsAppService.agendarLote(itens, loteDescricao, scheduledAt, createdBy, false);
            return new CobrancaLoteResultDTO(
                    ag.loteId(), ag.total(), 0, 0, ag.semTelefone(), 0, ag.puladosInelegiveis());
        }

        log.info("[cobranca-aluguel] disparo lote competencia={} contratos={}", ym, itens.size());
        return cobrancaWhatsAppService.dispararLote(itens, loteDescricao, createdBy, false);
    }

    /**
     * Job diário: agenda cobrança no vencimento para contratos com opt-in ainda sem aluguel na competência.
     * Idempotente — ignora contratos já cobrados/agendados no mês.
     */
    @Transactional
    public int agendarCobrancasVencimentoOptIn() {
        YearMonth ym = YearMonth.now(ZONE_BRASILIA);
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
        int agendados = 0;
        for (ContratoLocacaoEntity contrato : contratosPendentes(ym)) {
            if (!Boolean.TRUE.equals(contrato.getAgendarCobrancaWhatsApp())) {
                continue;
            }
            LocalDate vencimento = dataVencimento(contrato, ym);
            if (!hoje.equals(vencimento)) {
                continue;
            }
            ImovelEntity imovel = contrato.getImovel();
            if (imovel != null
                    && imovel.getId() != null
                    && cobrancaWhatsAppRepository.existsCobrancaNoMes(
                            imovel.getId(), inicioMesAtual(hoje), fimMesAtual(hoje))) {
                continue;
            }
            CobrancaItemDTO item = montarItemCobranca(contrato);
            if (!StringUtils.hasText(item.telefone())) {
                continue;
            }
            Instant scheduledAt = vencimento.atTime(HORA_ENVIO_AGENDADO).atZone(ZONE_BRASILIA).toInstant();
            if (!scheduledAt.isAfter(Instant.now())) {
                scheduledAt = Instant.now().plusSeconds(120);
            }
            String loteDescricao = "Aluguel vencimento · " + ym;
            cobrancaWhatsAppService.agendarLote(List.of(item), loteDescricao, scheduledAt, "sistema", false);
            agendados++;
        }
        if (agendados > 0) {
            log.info("[cobranca-aluguel] opt-in vencimento competencia={} agendados={}", ym, agendados);
        }
        return agendados;
    }

    private static Instant instantVencimentoCompetencia(ContratoLocacaoEntity contrato, YearMonth ym) {
        LocalDate vencimento = dataVencimento(contrato, ym);
        Instant scheduledAt = vencimento.atTime(HORA_ENVIO_AGENDADO).atZone(ZONE_BRASILIA).toInstant();
        if (!scheduledAt.isAfter(Instant.now())) {
            scheduledAt = Instant.now().plusSeconds(120);
        }
        return scheduledAt;
    }

    private List<ContratoLocacaoEntity> contratosPendentes(YearMonth ym) {
        return contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                ym.toString(), ym.atDay(1), ym.atEndOfMonth());
    }

    private AluguelTriagemResponse.Item montarItem(
            ContratoLocacaoEntity contrato,
            YearMonth ym,
            LocalDate hoje,
            SugestoesAluguelPendenteResponse.ContratoPendenteItem sugestao) {
        ImovelEntity imovel = contrato.getImovel();
        PessoaEntity inquilino = contrato.getInquilinoPessoa();

        LocalDate vencimento = dataVencimento(contrato, ym);
        int diasAtraso = hoje.isAfter(vencimento) ? (int) ChronoUnit.DAYS.between(vencimento, hoje) : 0;

        boolean temSugestao = sugestao != null && !sugestao.sugestoes().isEmpty();
        String confianca = temSugestao ? sugestao.sugestoes().get(0).confianca() : null;
        String situacao = temSugestao
                ? SITUACAO_PAGAMENTO_PROVAVEL
                : (diasAtraso > 0 ? SITUACAO_EM_ATRASO : SITUACAO_A_VENCER);

        String telefone = inquilino != null
                ? cobrancaWhatsAppService.resolverTelefonePessoa(inquilino.getId(), null)
                : null;
        boolean temTelefone = StringUtils.hasText(telefone);

        boolean jaCobrado = imovel != null && imovel.getId() != null
                && cobrancaWhatsAppRepository.existsCobrancaNoMes(
                        imovel.getId(), inicioMesAtual(hoje), fimMesAtual(hoje));

        return new AluguelTriagemResponse.Item(
                contrato.getId(),
                imovel != null ? imovel.getNumeroPlanilha() : null,
                imovel != null ? imovel.getId() : null,
                imovel != null ? imovel.getEnderecoCompleto() : null,
                imovel != null ? imovel.getCondominio() : null,
                imovel != null ? imovel.getUnidade() : null,
                inquilino != null ? inquilino.getNome() : null,
                inquilino != null ? inquilino.getId() : null,
                contrato.getValorAluguel(),
                contrato.getDiaVencimentoAluguel(),
                vencimento,
                diasAtraso,
                situacao,
                confianca,
                temSugestao ? sugestao.sugestoes().size() : 0,
                temTelefone,
                temTelefone ? WhatsAppService.formatPhoneDisplay(telefone) : null,
                jaCobrado,
                Boolean.TRUE.equals(contrato.getAgendarCobrancaWhatsApp()));
    }

    private CobrancaItemDTO montarItemCobranca(ContratoLocacaoEntity contrato) {
        ImovelEntity imovel = contrato.getImovel();
        PessoaEntity inquilino = contrato.getInquilinoPessoa();
        Long imovelId = imovel != null ? imovel.getId() : null;
        Long clienteId = imovel != null && imovel.getCliente() != null ? imovel.getCliente().getId() : null;
        Long processoId = imovelId != null
                ? imovelProcessoRepository
                        .findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(imovelId)
                        .map(ip -> ip.getProcesso() != null ? ip.getProcesso().getId() : null)
                        .orElse(null)
                : null;
        String telefone = inquilino != null
                ? cobrancaWhatsAppService.resolverTelefonePessoa(inquilino.getId(), null)
                : null;
        // Parâmetros do template cobranca_pagamento: {1} nome, {2} unidade, {3} condomínio/local.
        String condominioNome = imovel != null && StringUtils.hasText(imovel.getCondominio())
                ? imovel.getCondominio().trim()
                : (imovel != null && StringUtils.hasText(imovel.getEnderecoCompleto())
                        ? imovel.getEnderecoCompleto().trim()
                        : "Vila Real");
        return new CobrancaItemDTO(
                imovelId,
                clienteId,
                inquilino != null ? inquilino.getId() : null,
                inquilino != null ? inquilino.getNome() : null,
                telefone,
                condominioNome,
                CobrancaWhatsAppService.montarUnidadeDescricao(imovel != null ? imovel.getUnidade() : null),
                processoId,
                contrato.getValorAluguel());
    }

    private static LocalDate dataVencimento(ContratoLocacaoEntity contrato, YearMonth ym) {
        int dia = contrato.getDiaVencimentoAluguel() != null && contrato.getDiaVencimentoAluguel() >= 1
                ? contrato.getDiaVencimentoAluguel()
                : DIA_VENCIMENTO_PADRAO;
        return ym.atDay(Math.min(dia, ym.lengthOfMonth()));
    }

    private static Instant inicioMesAtual(LocalDate hoje) {
        return hoje.withDayOfMonth(1).atStartOfDay(ZONE_BRASILIA).toInstant();
    }

    private static Instant fimMesAtual(LocalDate hoje) {
        return hoje.withDayOfMonth(1).plusMonths(1).atStartOfDay(ZONE_BRASILIA).toInstant();
    }

    private static YearMonth parseCompetenciaOuAtual(String competencia) {
        if (!StringUtils.hasText(competencia)) {
            return YearMonth.now(ZONE_BRASILIA);
        }
        try {
            return YearMonth.parse(competencia.trim());
        } catch (DateTimeParseException e) {
            throw new BusinessRuleException("Competência inválida (use AAAA-MM): " + competencia);
        }
    }
}
