package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.api.dto.AluguelFollowupResponse;
import br.com.vilareal.imovel.api.dto.SugestoesAluguelPendenteResponse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.AluguelFollowupEventoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.AluguelFollowupEventoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.CobrancaWhatsAppEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.entity.WhatsAppMessageEntity;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.CobrancaWhatsAppRepository;
import br.com.vilareal.whatsapp.infrastructure.persistence.repository.WhatsAppMessageRepository;
import br.com.vilareal.whatsapp.service.CobrancaWhatsAppService;
import br.com.vilareal.whatsapp.service.WhatsAppService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.time.LocalDate;
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
import java.util.Optional;
import java.util.Set;

/**
 * Motor de follow-up dos aluguéis em atraso: transforma cada contrato × competência vencida sem
 * pagamento em um CASO que a API acompanha até a resolução. Para cada caso a API calcula a próxima
 * ação (enviar mensagem → aguardar resposta → reenviar → ligar) e o prazo, verificando sozinha se o
 * inquilino respondeu no WhatsApp — a gestão deixa de depender da memória do usuário. O caso sai da
 * lista automaticamente quando o aluguel é conciliado.
 */
@Service
public class AluguelFollowupService {

    /** Dias que se espera por resposta após uma mensagem/ligação antes de exigir nova ação. */
    static final int DIAS_AGUARDAR_RESPOSTA = 2;

    /** Competências anteriores analisadas por padrão (casos antigos não podem cair no esquecimento). */
    static final int MESES_PADRAO = 3;

    private static final int MESES_MAX = 12;
    private static final int DIA_VENCIMENTO_PADRAO = 10;
    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final String PREFIXO_LOTE_ALUGUEL = "Aluguel";

    public static final String ACAO_CONCILIAR = "CONCILIAR";
    public static final String ACAO_ENVIAR_MENSAGEM = "ENVIAR_MENSAGEM";
    public static final String ACAO_REENVIAR_MENSAGEM = "REENVIAR_MENSAGEM";
    public static final String ACAO_LIGAR = "LIGAR";
    public static final String ACAO_VERIFICAR_RESPOSTA = "VERIFICAR_RESPOSTA";
    public static final String ACAO_AGUARDAR = "AGUARDAR";

    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final LocacaoReconciliacaoService reconciliacaoService;
    private final CobrancaWhatsAppService cobrancaWhatsAppService;
    private final CobrancaWhatsAppRepository cobrancaWhatsAppRepository;
    private final WhatsAppMessageRepository whatsAppMessageRepository;
    private final AluguelFollowupEventoRepository eventoRepository;

    public AluguelFollowupService(
            ContratoLocacaoRepository contratoLocacaoRepository,
            LocacaoReconciliacaoService reconciliacaoService,
            CobrancaWhatsAppService cobrancaWhatsAppService,
            CobrancaWhatsAppRepository cobrancaWhatsAppRepository,
            WhatsAppMessageRepository whatsAppMessageRepository,
            AluguelFollowupEventoRepository eventoRepository) {
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.reconciliacaoService = reconciliacaoService;
        this.cobrancaWhatsAppService = cobrancaWhatsAppService;
        this.cobrancaWhatsAppRepository = cobrancaWhatsAppRepository;
        this.whatsAppMessageRepository = whatsAppMessageRepository;
        this.eventoRepository = eventoRepository;
    }

    @Transactional(readOnly = true)
    public AluguelFollowupResponse followup(String competenciaParam, Integer mesesParam) {
        YearMonth base = parseCompetenciaOuAtual(competenciaParam);
        int meses = mesesParam != null ? Math.max(1, Math.min(mesesParam, MESES_MAX)) : MESES_PADRAO;
        LocalDate hoje = LocalDate.now(ZONE_BRASILIA);

        // 1. Levanta os casos: contrato × competência vencida sem aluguel vinculado.
        List<Caso> casos = new ArrayList<>();
        for (int i = meses - 1; i >= 0; i--) {
            YearMonth ym = base.minusMonths(i);
            Map<Long, Integer> sugestoesPorContrato = new HashMap<>();
            for (SugestoesAluguelPendenteResponse.ContratoPendenteItem c :
                    reconciliacaoService.sugerirAlugueisPendentes(ym.toString()).contratos()) {
                sugestoesPorContrato.put(c.contratoId(), c.sugestoes().size());
            }
            for (ContratoLocacaoEntity contrato : contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                    ym.toString(), ym.atDay(1), ym.atEndOfMonth())) {
                LocalDate vencimento = dataVencimento(contrato, ym);
                if (!vencimento.isBefore(hoje)) {
                    continue; // ainda no prazo — não é caso de follow-up
                }
                casos.add(new Caso(contrato, ym, vencimento,
                        sugestoesPorContrato.getOrDefault(contrato.getId(), 0)));
            }
        }
        if (casos.isEmpty()) {
            return new AluguelFollowupResponse(base.toString(), meses, 0, 0, 0, List.of());
        }

        // 2. Carrega em lote as cobranças WhatsApp de aluguel e os eventos manuais dos casos.
        Set<Long> imovelIds = new HashSet<>();
        Set<Long> contratoIds = new HashSet<>();
        for (Caso caso : casos) {
            contratoIds.add(caso.contrato.getId());
            if (caso.contrato.getImovel() != null && caso.contrato.getImovel().getId() != null) {
                imovelIds.add(caso.contrato.getImovel().getId());
            }
        }
        Map<Long, List<CobrancaWhatsAppEntity>> cobrancasPorImovel = new HashMap<>();
        if (!imovelIds.isEmpty()) {
            for (CobrancaWhatsAppEntity c :
                    cobrancaWhatsAppRepository.findByImovelIdInAndStatusNotOrderByCreatedAtDesc(
                            imovelIds, "CANCELADO")) {
                if (c.getLoteDescricao() == null || !c.getLoteDescricao().startsWith(PREFIXO_LOTE_ALUGUEL)) {
                    continue;
                }
                cobrancasPorImovel.computeIfAbsent(c.getImovelId(), k -> new ArrayList<>()).add(c);
            }
        }
        Map<String, List<AluguelFollowupEventoEntity>> eventosPorCaso = new HashMap<>();
        for (AluguelFollowupEventoEntity e : eventoRepository.findByContratoIdInOrderByCreatedAtAsc(contratoIds)) {
            eventosPorCaso
                    .computeIfAbsent(chaveCaso(e.getContratoId(), e.getCompetencia()), k -> new ArrayList<>())
                    .add(e);
        }

        // 3. Monta cada item com o estado derivado + a próxima ação calculada.
        List<AluguelFollowupResponse.Item> itens = new ArrayList<>();
        for (Caso caso : casos) {
            List<AluguelFollowupEventoEntity> eventos = eventosPorCaso.getOrDefault(
                    chaveCaso(caso.contrato.getId(), caso.competencia.toString()), List.of());
            if (eventos.stream().anyMatch(e -> AluguelFollowupEventoEntity.TIPO_RESOLVIDO_MANUAL.equals(e.getTipo()))) {
                continue;
            }
            itens.add(montarItem(caso, eventos, cobrancasPorImovel, hoje));
        }

        // Ações vencidas primeiro (mais atraso no topo); aguardando por último.
        itens.sort(Comparator
                .comparing(AluguelFollowupResponse.Item::acaoVencida, Comparator.reverseOrder())
                .thenComparing(AluguelFollowupResponse.Item::diasAtraso, Comparator.reverseOrder())
                .thenComparing(AluguelFollowupResponse.Item::competencia));

        int acaoHoje = (int) itens.stream().filter(AluguelFollowupResponse.Item::acaoVencida).count();
        return new AluguelFollowupResponse(
                base.toString(), meses, itens.size(), acaoHoje, itens.size() - acaoHoje, itens);
    }

    /** Registra evento manual (LIGACAO, ANOTACAO, ADIAR, RESOLVIDO_MANUAL) de um caso. */
    @Transactional
    public void registrarEvento(AluguelFollowupResponse.EventoRequest request, String createdBy) {
        if (request == null || request.contratoId() == null) {
            throw new BusinessRuleException("Informe o contrato do caso.");
        }
        if (!StringUtils.hasText(request.competencia())) {
            throw new BusinessRuleException("Informe a competência do caso (AAAA-MM).");
        }
        parseCompetenciaOuAtual(request.competencia());
        String tipo = StringUtils.hasText(request.tipo()) ? request.tipo().trim().toUpperCase() : null;
        Set<String> tiposValidos = Set.of(
                AluguelFollowupEventoEntity.TIPO_LIGACAO,
                AluguelFollowupEventoEntity.TIPO_ANOTACAO,
                AluguelFollowupEventoEntity.TIPO_ADIAR,
                AluguelFollowupEventoEntity.TIPO_RESOLVIDO_MANUAL);
        if (tipo == null || !tiposValidos.contains(tipo)) {
            throw new BusinessRuleException("Tipo de evento inválido: " + request.tipo());
        }
        if (AluguelFollowupEventoEntity.TIPO_ADIAR.equals(tipo)) {
            LocalDate hoje = LocalDate.now(ZONE_BRASILIA);
            if (request.adiadoAte() == null || !request.adiadoAte().isAfter(hoje)) {
                throw new BusinessRuleException("Para adiar, informe uma data futura em adiadoAte.");
            }
        }
        contratoLocacaoRepository
                .findById(request.contratoId())
                .orElseThrow(() -> new BusinessRuleException("Contrato não encontrado: " + request.contratoId()));

        AluguelFollowupEventoEntity evento = new AluguelFollowupEventoEntity();
        evento.setContratoId(request.contratoId());
        evento.setCompetencia(request.competencia().trim());
        evento.setTipo(tipo);
        evento.setObservacao(StringUtils.hasText(request.observacao()) ? request.observacao().trim() : null);
        evento.setAdiadoAte(AluguelFollowupEventoEntity.TIPO_ADIAR.equals(tipo) ? request.adiadoAte() : null);
        evento.setCreatedBy(createdBy);
        eventoRepository.save(evento);
    }

    private AluguelFollowupResponse.Item montarItem(
            Caso caso,
            List<AluguelFollowupEventoEntity> eventos,
            Map<Long, List<CobrancaWhatsAppEntity>> cobrancasPorImovel,
            LocalDate hoje) {
        ContratoLocacaoEntity contrato = caso.contrato;
        ImovelEntity imovel = contrato.getImovel();
        PessoaEntity inquilino = contrato.getInquilinoPessoa();

        String telefone = inquilino != null
                ? cobrancaWhatsAppService.resolverTelefonePessoa(inquilino.getId(), null)
                : null;
        boolean temTelefone = StringUtils.hasText(telefone);

        List<CobrancaWhatsAppEntity> cobrancas = cobrancasDoCaso(
                imovel != null ? cobrancasPorImovel.get(imovel.getId()) : null, caso.competencia);
        int cobrancasEnviadas = cobrancas.size();
        Instant ultimaCobrancaEm = cobrancas.stream()
                .map(c -> c.getEnviadoAt() != null ? c.getEnviadoAt() : c.getCreatedAt())
                .max(Comparator.naturalOrder())
                .orElse(null);

        int ligacoes = 0;
        Instant ultimaLigacaoEm = null;
        String ultimaAnotacao = null;
        LocalDate adiadoAte = null;
        for (AluguelFollowupEventoEntity e : eventos) {
            switch (e.getTipo()) {
                case AluguelFollowupEventoEntity.TIPO_LIGACAO -> {
                    ligacoes++;
                    ultimaLigacaoEm = e.getCreatedAt();
                    if (StringUtils.hasText(e.getObservacao())) {
                        ultimaAnotacao = e.getObservacao();
                    }
                }
                case AluguelFollowupEventoEntity.TIPO_ANOTACAO -> {
                    if (StringUtils.hasText(e.getObservacao())) {
                        ultimaAnotacao = e.getObservacao();
                    }
                }
                case AluguelFollowupEventoEntity.TIPO_ADIAR -> adiadoAte = e.getAdiadoAte();
                default -> { }
            }
        }
        if (adiadoAte != null && !adiadoAte.isAfter(hoje)) {
            adiadoAte = null; // adiamento expirado — o caso volta a exigir ação
        }

        Instant ultimaAcaoEm = maxInstant(ultimaCobrancaEm, ultimaLigacaoEm);
        boolean respondeu = false;
        Instant ultimaRespostaEm = null;
        if (temTelefone && ultimaAcaoEm != null) {
            Optional<WhatsAppMessageEntity> inbound = whatsAppMessageRepository
                    .findLatestInboundByPhoneSuffixSince(sufixo11(telefone), ultimaAcaoEm);
            if (inbound.isPresent()) {
                respondeu = true;
                ultimaRespostaEm = inbound.get().getCreatedAt();
            }
        }

        int diasSemAcao = ultimaAcaoEm != null
                ? (int) ChronoUnit.DAYS.between(ultimaAcaoEm.atZone(ZONE_BRASILIA).toLocalDate(), hoje)
                : (int) ChronoUnit.DAYS.between(caso.vencimento, hoje);

        ProximaAcao acao = calcularProximaAcao(
                caso, temTelefone, cobrancasEnviadas, ligacoes, respondeu, adiadoAte, ultimaAcaoEm, hoje);

        int diasAtraso = (int) ChronoUnit.DAYS.between(caso.vencimento, hoje);
        return new AluguelFollowupResponse.Item(
                contrato.getId(),
                caso.competencia.toString(),
                imovel != null ? imovel.getNumeroPlanilha() : null,
                imovel != null ? imovel.getId() : null,
                imovel != null ? imovel.getEnderecoCompleto() : null,
                imovel != null ? imovel.getCondominio() : null,
                imovel != null ? imovel.getUnidade() : null,
                inquilino != null ? inquilino.getNome() : null,
                inquilino != null ? inquilino.getId() : null,
                contrato.getValorAluguel(),
                caso.vencimento,
                diasAtraso,
                cobrancasEnviadas,
                ultimaCobrancaEm,
                respondeu,
                ultimaRespostaEm,
                ligacoes,
                ultimaLigacaoEm,
                ultimaAnotacao,
                adiadoAte,
                acao.codigo,
                acao.descricao,
                acao.prazo,
                !acao.prazo.isAfter(hoje),
                diasSemAcao,
                temTelefone,
                temTelefone ? WhatsAppService.formatPhoneDisplay(telefone) : null,
                temTelefone ? telefone : null);
    }

    /**
     * Escada de escalonamento: conciliar (se há crédito provável) → enviar mensagem → aguardar
     * {@value DIAS_AGUARDAR_RESPOSTA} dias → verificar resposta OU reenviar → ligar → ligar de novo.
     */
    private ProximaAcao calcularProximaAcao(
            Caso caso,
            boolean temTelefone,
            int cobrancasEnviadas,
            int ligacoes,
            boolean respondeu,
            LocalDate adiadoAte,
            Instant ultimaAcaoEm,
            LocalDate hoje) {
        if (adiadoAte != null) {
            return new ProximaAcao(ACAO_AGUARDAR, "Caso adiado — retomar em " + adiadoAte, adiadoAte);
        }
        if (caso.sugestoesExtrato > 0) {
            return new ProximaAcao(
                    ACAO_CONCILIAR,
                    "Crédito compatível no extrato — conciliar antes de cobrar",
                    hoje);
        }
        if (respondeu) {
            return new ProximaAcao(
                    ACAO_VERIFICAR_RESPOSTA,
                    "Inquilino respondeu no WhatsApp — ler a conversa e definir o próximo passo",
                    hoje);
        }
        if (!temTelefone) {
            return new ProximaAcao(
                    ACAO_LIGAR,
                    "Sem WhatsApp cadastrado — contatar por telefone ou outro meio e registrar",
                    hoje);
        }
        if (cobrancasEnviadas == 0 && ligacoes == 0) {
            return new ProximaAcao(ACAO_ENVIAR_MENSAGEM, "Nenhuma cobrança feita — enviar a primeira mensagem", hoje);
        }
        LocalDate ultimaAcaoDia = ultimaAcaoEm != null
                ? ultimaAcaoEm.atZone(ZONE_BRASILIA).toLocalDate()
                : caso.vencimento;
        LocalDate prazoResposta = ultimaAcaoDia.plusDays(DIAS_AGUARDAR_RESPOSTA);
        if (hoje.isBefore(prazoResposta)) {
            return new ProximaAcao(
                    ACAO_AGUARDAR,
                    "Aguardando resposta até " + prazoResposta + " — a API avisa se ninguém responder",
                    prazoResposta);
        }
        if (ligacoes > 0) {
            return new ProximaAcao(
                    ACAO_LIGAR,
                    "Sem retorno após ligação — ligar novamente ou registrar acordo/anotação",
                    hoje);
        }
        if (cobrancasEnviadas == 1) {
            return new ProximaAcao(
                    ACAO_REENVIAR_MENSAGEM,
                    "Mensagem sem resposta há " + DIAS_AGUARDAR_RESPOSTA + "+ dias — reenviar cobrança",
                    hoje);
        }
        return new ProximaAcao(
                ACAO_LIGAR,
                cobrancasEnviadas + " mensagens sem resposta — ligar para o inquilino",
                hoje);
    }

    /** Cobranças de aluguel do caso: pelo lote com a competência ou pela data dentro do mês. */
    private static List<CobrancaWhatsAppEntity> cobrancasDoCaso(
            List<CobrancaWhatsAppEntity> cobrancasImovel, YearMonth competencia) {
        if (cobrancasImovel == null || cobrancasImovel.isEmpty()) {
            return List.of();
        }
        Instant inicio = competencia.atDay(1).atStartOfDay(ZONE_BRASILIA).toInstant();
        Instant fim = competencia.plusMonths(1).atDay(1).atStartOfDay(ZONE_BRASILIA).toInstant();
        List<CobrancaWhatsAppEntity> resultado = new ArrayList<>();
        for (CobrancaWhatsAppEntity c : cobrancasImovel) {
            boolean loteDaCompetencia =
                    c.getLoteDescricao() != null && c.getLoteDescricao().contains(competencia.toString());
            boolean dentroDoMes = c.getCreatedAt() != null
                    && !c.getCreatedAt().isBefore(inicio)
                    && c.getCreatedAt().isBefore(fim);
            if (loteDaCompetencia || (dentroDoMes && semCompetenciaNoLote(c))) {
                resultado.add(c);
            }
        }
        return resultado;
    }

    private static boolean semCompetenciaNoLote(CobrancaWhatsAppEntity c) {
        return c.getLoteDescricao() == null || !c.getLoteDescricao().matches(".*\\d{4}-\\d{2}.*");
    }

    private static String chaveCaso(Long contratoId, String competencia) {
        return contratoId + "|" + competencia;
    }

    private static Instant maxInstant(Instant a, Instant b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.isAfter(b) ? a : b;
    }

    private static String sufixo11(String phoneNumber) {
        String digits = phoneNumber.replaceAll("\\D", "");
        return digits.length() >= 11 ? digits.substring(digits.length() - 11) : digits;
    }

    private static LocalDate dataVencimento(ContratoLocacaoEntity contrato, YearMonth ym) {
        int dia = contrato.getDiaVencimentoAluguel() != null && contrato.getDiaVencimentoAluguel() >= 1
                ? contrato.getDiaVencimentoAluguel()
                : DIA_VENCIMENTO_PADRAO;
        return ym.atDay(Math.min(dia, ym.lengthOfMonth()));
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

    private record Caso(ContratoLocacaoEntity contrato, YearMonth competencia, LocalDate vencimento,
                        int sugestoesExtrato) {}

    private record ProximaAcao(String codigo, String descricao, LocalDate prazo) {}
}
