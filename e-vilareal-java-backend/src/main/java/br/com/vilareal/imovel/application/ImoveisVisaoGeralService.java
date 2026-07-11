package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.api.dto.ImovelVinculoProcessoItemResponse;
import br.com.vilareal.imovel.api.dto.ImovelVinculosProcessoResponse;
import br.com.vilareal.imovel.api.dto.ImovelVisaoGeralItemResponse;
import br.com.vilareal.imovel.api.dto.ImovelVisaoGeralResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse;
import br.com.vilareal.imovel.domain.StatusRepasse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Visão geral consolidada do portfólio de imóveis: cadastro + contrato vigente + situação
 * financeira da competência em UMA chamada, iterando todos os imóveis do banco
 * (sem teto fixo de número de planilha e sem N+1 no browser).
 */
@Service
public class ImoveisVisaoGeralService {

    private static final DateTimeFormatter COMPETENCIA = DateTimeFormatter.ofPattern("yyyy-MM");

    private final ImovelRepository imovelRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final ImovelApplicationService imovelApplicationService;
    private final LocacaoReconciliacaoService reconciliacaoService;
    private final ObjectMapper objectMapper;

    public ImoveisVisaoGeralService(
            ImovelRepository imovelRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            ImovelApplicationService imovelApplicationService,
            LocacaoReconciliacaoService reconciliacaoService,
            ObjectMapper objectMapper) {
        this.imovelRepository = imovelRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.imovelApplicationService = imovelApplicationService;
        this.reconciliacaoService = reconciliacaoService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public ImovelVisaoGeralResponse gerar(String competencia, boolean soOcupados) {
        YearMonth alvo = parseCompetencia(competencia);
        String chaveAtual = alvo.format(COMPETENCIA);
        String chaveAnterior = alvo.minusMonths(1).format(COMPETENCIA);

        List<ImovelVisaoGeralItemResponse> itens = new ArrayList<>();
        for (ImovelEntity im : listarImoveisDedupe()) {
            ContratoLocacaoEntity contrato = selecionarContratoVigente(im.getId());
            boolean ocupado = isImovelOcupado(im, contrato);
            if (soOcupados && !ocupado) {
                continue;
            }
            itens.add(montarItem(im, contrato, ocupado, chaveAtual, chaveAnterior));
        }

        itens.sort(Comparator
                .comparing(ImovelVisaoGeralItemResponse::numeroPlanilha,
                        Comparator.nullsLast(Comparator.naturalOrder()))
                .thenComparing(ImovelVisaoGeralItemResponse::imovelId,
                        Comparator.nullsLast(Comparator.naturalOrder())));
        return new ImovelVisaoGeralResponse(chaveAtual, itens);
    }

    private ImovelVisaoGeralItemResponse montarItem(
            ImovelEntity im,
            ContratoLocacaoEntity contrato,
            boolean ocupado,
            String chaveAtual,
            String chaveAnterior) {
        JsonNode extras = parseExtras(im.getCamposExtrasJson());
        ImovelVinculoProcessoItemResponse principal =
                im.getNumeroPlanilha() != null ? resolverVinculoPrincipal(im.getNumeroPlanilha()) : null;

        String inquilino = textoExtra(extras, "inquilino");
        if (inquilino == null && contrato != null && contrato.getInquilinoPessoa() != null) {
            inquilino = trimOrNull(contrato.getInquilinoPessoa().getNome());
        }
        String proprietario = textoExtra(extras, "proprietario");
        if (proprietario == null && contrato != null && contrato.getLocadorPessoa() != null) {
            proprietario = trimOrNull(contrato.getLocadorPessoa().getNome());
        }
        if (proprietario == null && im.getResponsavelPessoa() != null) {
            proprietario = trimOrNull(im.getResponsavelPessoa().getNome());
        }

        BigDecimal aluguelRecebido = BigDecimal.ZERO;
        BigDecimal repassado = BigDecimal.ZERO;
        BigDecimal despesas = BigDecimal.ZERO;
        BigDecimal resultadoEscritorio = BigDecimal.ZERO;
        BigDecimal repasseAnterior = BigDecimal.ZERO;
        StatusRepasse statusRepasse = null;
        boolean repasseInterno = false;
        if (contrato != null && contrato.getId() != null) {
            ReconciliacaoResultadoResponse atual =
                    reconciliacaoService.resultado(contrato.getId(), chaveAtual, null, null);
            ReconciliacaoResultadoResponse anterior =
                    reconciliacaoService.resultado(contrato.getId(), chaveAnterior, null, null);
            if (atual != null) {
                aluguelRecebido = positivo(atual.aluguelRecebido());
                repassado = positivo(atual.repassado());
                despesas = positivo(atual.despesas());
                resultadoEscritorio = atual.resultadoEscritorio() != null
                        ? atual.resultadoEscritorio()
                        : BigDecimal.ZERO;
                statusRepasse = atual.statusRepasse();
                repasseInterno = atual.repasseInterno();
            }
            repasseAnterior = positivo(anterior != null ? anterior.repassado() : null);
        }

        return new ImovelVisaoGeralItemResponse(
                im.getId(),
                im.getNumeroPlanilha(),
                trimOrNull(im.getTitulo()),
                trimOrNull(im.getEnderecoCompleto()),
                trimOrNull(im.getCondominio()),
                trimOrNull(im.getUnidade()),
                trimOrNull(im.getTipoImovel()),
                trimOrNull(im.getSituacao()),
                ocupado,
                inquilino,
                proprietario,
                principal != null ? principal.getCodigoCliente() : null,
                principal != null ? principal.getNumeroInterno() : null,
                contrato != null ? contrato.getId() : null,
                contrato != null ? trimOrNull(contrato.getStatus()) : null,
                contrato != null ? contrato.getValorAluguel() : null,
                contrato != null ? contrato.getTaxaAdministracaoPercent() : null,
                contrato != null ? contrato.getDiaVencimentoAluguel() : null,
                contrato != null ? contrato.getDiaRepasse() : null,
                aluguelRecebido,
                repassado,
                despesas,
                resultadoEscritorio,
                statusRepasse,
                repasseInterno,
                repasseAnterior,
                chaveAnterior);
    }

    /**
     * Todos os imóveis ativos: dedupe por número de planilha (mantém o registro com mais dados de
     * cadastro, mesmo critério do relatório financeiro) + imóveis sem número de planilha.
     */
    private List<ImovelEntity> listarImoveisDedupe() {
        Map<Integer, ImovelEntity> porNumero = new HashMap<>();
        Map<Integer, Integer> scores = new HashMap<>();
        List<ImovelEntity> semPlanilha = new ArrayList<>();
        for (ImovelEntity im : imovelRepository.findAllByOrderByIdAsc()) {
            if (Boolean.FALSE.equals(im.getAtivo())) {
                continue;
            }
            Integer np = im.getNumeroPlanilha();
            if (np == null || np < 1) {
                semPlanilha.add(im);
                continue;
            }
            int score = scoreImovel(im);
            Integer prev = scores.get(np);
            if (prev == null || score > prev) {
                porNumero.put(np, im);
                scores.put(np, score);
            }
        }
        List<ImovelEntity> todos = new ArrayList<>(porNumero.values());
        todos.addAll(semPlanilha);
        return todos;
    }

    private static int scoreImovel(ImovelEntity im) {
        int s = 0;
        if (StringUtils.hasText(im.getUnidade())) {
            s += 4;
        }
        if (StringUtils.hasText(im.getCondominio())) {
            s += 2;
        }
        if ("OCUPADO".equalsIgnoreCase(String.valueOf(im.getSituacao()))) {
            s += 1;
        }
        return s;
    }

    private ImovelVinculoProcessoItemResponse resolverVinculoPrincipal(int numeroPlanilha) {
        ImovelVinculosProcessoResponse resp =
                imovelApplicationService.listarVinculosProcessoPorNumeroPlanilha(numeroPlanilha);
        if (resp == null || resp.getVinculos() == null) {
            return null;
        }
        return resp.getVinculos().stream()
                .filter(ImovelVinculoProcessoItemResponse::isPrincipal)
                .findFirst()
                .orElse(null);
    }

    private ContratoLocacaoEntity selecionarContratoVigente(Long imovelId) {
        List<ContratoLocacaoEntity> contratos =
                contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(imovelId);
        if (contratos.isEmpty()) {
            return null;
        }
        LocalDate hoje = LocalDate.now();
        for (ContratoLocacaoEntity c : contratos) {
            if (!"VIGENTE".equalsIgnoreCase(String.valueOf(c.getStatus()))) {
                continue;
            }
            LocalDate ini = c.getDataInicio();
            LocalDate fim = c.getDataFim();
            if (ini != null && ini.isAfter(hoje)) {
                continue;
            }
            if (fim != null && fim.isBefore(hoje)) {
                continue;
            }
            return c;
        }
        for (ContratoLocacaoEntity c : contratos) {
            if ("VIGENTE".equalsIgnoreCase(String.valueOf(c.getStatus()))) {
                return c;
            }
        }
        return contratos.get(0);
    }

    private static boolean isImovelOcupado(ImovelEntity im, ContratoLocacaoEntity contrato) {
        String sit = String.valueOf(im.getSituacao());
        if ("OCUPADO".equalsIgnoreCase(sit)) {
            return true;
        }
        if ("DESOCUPADO".equalsIgnoreCase(sit)) {
            return contrato != null && "VIGENTE".equalsIgnoreCase(String.valueOf(contrato.getStatus()));
        }
        return true;
    }

    private JsonNode parseExtras(String json) {
        if (!StringUtils.hasText(json)) {
            return objectMapper.createObjectNode();
        }
        try {
            return objectMapper.readTree(json);
        } catch (Exception e) {
            return objectMapper.createObjectNode();
        }
    }

    private static String textoExtra(JsonNode extras, String campo) {
        if (extras == null || !extras.has(campo)) {
            return null;
        }
        String t = extras.get(campo).asText("").trim();
        return t.isEmpty() ? null : t;
    }

    private static String trimOrNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static BigDecimal positivo(BigDecimal v) {
        return v == null ? BigDecimal.ZERO : v.abs();
    }

    private static YearMonth parseCompetencia(String competencia) {
        if (!StringUtils.hasText(competencia)) {
            return YearMonth.now();
        }
        try {
            return YearMonth.parse(competencia.trim(), COMPETENCIA);
        } catch (DateTimeParseException e) {
            throw new BusinessRuleException("competencia inválida: use AAAA-MM");
        }
    }
}
