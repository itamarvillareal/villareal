package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.api.dto.ImovelVinculoProcessoItemResponse;
import br.com.vilareal.imovel.api.dto.ImovelVinculosProcessoResponse;
import br.com.vilareal.imovel.api.dto.RelatorioFinanceiroImovelLinhaResponse;
import br.com.vilareal.imovel.api.dto.RelatorioFinanceiroImoveisResponse;
import br.com.vilareal.imovel.api.dto.ReconciliacaoResultadoResponse;
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
 * Relatório financeiro imóveis × competência — totais calculados no servidor (vínculos/reconciliação),
 * evitando baixar extratos no browser (OOM / Chrome erro 5).
 */
@Service
public class RelatorioFinanceiroImoveisService {

    static final int MAX_NUMERO_PLANILHA = 66;

    private static final DateTimeFormatter COMPETENCIA = DateTimeFormatter.ofPattern("yyyy-MM");

    private final ImovelRepository imovelRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final ImovelApplicationService imovelApplicationService;
    private final LocacaoReconciliacaoService reconciliacaoService;
    private final ObjectMapper objectMapper;

    public RelatorioFinanceiroImoveisService(
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
    public RelatorioFinanceiroImoveisResponse gerar(String competencia, boolean soOcupados) {
        YearMonth alvo = parseCompetencia(competencia);
        String chaveAnterior = alvo.minusMonths(1).format(COMPETENCIA);

        Map<Integer, ImovelEntity> porPlanilha = dedupePorNumeroPlanilha();
        List<RelatorioFinanceiroImovelLinhaResponse> linhas = new ArrayList<>();

        for (int np = 1; np <= MAX_NUMERO_PLANILHA; np++) {
            ImovelEntity im = porPlanilha.get(np);
            if (im == null) {
                continue;
            }
            ContratoLocacaoEntity contrato = selecionarContratoVigente(im.getId());
            boolean ocupado = isImovelOcupado(im, contrato);
            if (soOcupados && !ocupado) {
                continue;
            }

            ImovelVinculoProcessoItemResponse principal = resolverVinculoPrincipal(np);
            JsonNode extras = parseExtras(im.getCamposExtrasJson());

            BigDecimal totalAluguel = BigDecimal.ZERO;
            BigDecimal totalRepasse = BigDecimal.ZERO;
            BigDecimal totalRepasseAnterior = BigDecimal.ZERO;
            if (contrato != null && contrato.getId() != null) {
                ReconciliacaoResultadoResponse atual =
                        reconciliacaoService.resultado(contrato.getId(), alvo.format(COMPETENCIA), null, null);
                ReconciliacaoResultadoResponse anterior =
                        reconciliacaoService.resultado(contrato.getId(), chaveAnterior, null, null);
                totalAluguel = positivo(atual != null ? atual.aluguelRecebido() : null);
                totalRepasse = positivo(atual != null ? atual.repassado() : null);
                totalRepasseAnterior = positivo(anterior != null ? anterior.repassado() : null);
            }

            linhas.add(new RelatorioFinanceiroImovelLinhaResponse(
                    np,
                    ocupado,
                    trimOrNull(im.getUnidade()),
                    trimOrNull(im.getCondominio()),
                    textoExtra(extras, "inquilino"),
                    textoExtra(extras, "proprietario"),
                    principal != null ? principal.getCodigoCliente() : null,
                    principal != null ? principal.getNumeroInterno() : null,
                    contrato != null ? contrato.getValorAluguel() : null,
                    contrato != null ? contrato.getTaxaAdministracaoPercent() : null,
                    contrato != null ? contrato.getDiaVencimentoAluguel() : null,
                    contrato != null ? contrato.getDiaRepasse() : null,
                    totalAluguel,
                    totalRepasse,
                    totalRepasseAnterior,
                    chaveAnterior));
        }

        linhas.sort(Comparator.comparing(
                RelatorioFinanceiroImovelLinhaResponse::numeroPlanilha, Comparator.nullsLast(Comparator.naturalOrder())));
        return new RelatorioFinanceiroImoveisResponse(alvo.format(COMPETENCIA), linhas);
    }

    private Map<Integer, ImovelEntity> dedupePorNumeroPlanilha() {
        Map<Integer, ImovelEntity> porNumero = new HashMap<>();
        Map<Integer, Integer> scores = new HashMap<>();
        for (ImovelEntity im : imovelRepository.findAllByOrderByIdAsc()) {
            Integer np = im.getNumeroPlanilha();
            if (np == null || np < 1 || np > MAX_NUMERO_PLANILHA) {
                continue;
            }
            int score = scoreImovel(im);
            Integer prev = scores.get(np);
            if (prev == null || score > prev) {
                porNumero.put(np, im);
                scores.put(np, score);
            }
        }
        return porNumero;
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
        ImovelVinculosProcessoResponse resp = imovelApplicationService.listarVinculosProcessoPorNumeroPlanilha(numeroPlanilha);
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
        if (v == null) {
            return BigDecimal.ZERO;
        }
        return v.abs();
    }

    private static YearMonth parseCompetencia(String competencia) {
        if (!StringUtils.hasText(competencia)) {
            throw new BusinessRuleException("competencia é obrigatória (AAAA-MM)");
        }
        try {
            return YearMonth.parse(competencia.trim(), COMPETENCIA);
        } catch (DateTimeParseException e) {
            throw new BusinessRuleException("competencia inválida: use AAAA-MM");
        }
    }
}
