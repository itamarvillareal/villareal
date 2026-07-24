package br.com.vilareal.patrimonio.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.patrimonio.api.dto.*;
import br.com.vilareal.patrimonio.domain.finance.*;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.AmortizacaoEntity;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.ParametroEntity;
import br.com.vilareal.patrimonio.infrastructure.persistence.entity.PassivoEntity;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.AmortizacaoRepository;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.ParametroRepository;
import br.com.vilareal.patrimonio.infrastructure.persistence.repository.PassivoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.Comparator;
import java.util.List;

/**
 * Motor de decisão + governança anti-impulso (§4).
 */
@Service
public class AmortizacaoApplicationService {

    private final PassivoRepository passivoRepository;
    private final AmortizacaoRepository amortizacaoRepository;
    private final ParametroRepository parametroRepository;
    private final PatrimonioConsolidacaoService consolidacaoService;
    private final PassivoApplicationService passivoApplicationService;

    public AmortizacaoApplicationService(
            PassivoRepository passivoRepository,
            AmortizacaoRepository amortizacaoRepository,
            ParametroRepository parametroRepository,
            PatrimonioConsolidacaoService consolidacaoService,
            PassivoApplicationService passivoApplicationService) {
        this.passivoRepository = passivoRepository;
        this.amortizacaoRepository = amortizacaoRepository;
        this.parametroRepository = parametroRepository;
        this.consolidacaoService = consolidacaoService;
        this.passivoApplicationService = passivoApplicationService;
    }

    @Transactional(readOnly = true)
    public AmortizacaoComparacaoResponse simular(AmortizacaoSimulacaoRequest req) {
        PassivoEntity passivo = buscarPassivo(req.passivoId());
        AmortizacaoComparacao cmp = executarComparacao(
                passivo, req.valor(), req.modalidade(),
                req.retornoAlternativaLiquidaAa(), req.retornoAlternativaBrutaAa(),
                req.inflacaoProjetadaAa(), req.cetJaProjetado());
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        return toComparacaoResponse(passivo, cmp, cons);
    }

    @Transactional(readOnly = true)
    public List<AmortizacaoComparacaoResponse> rankingPrioridade() {
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        BigDecimal taxaRef = cons.taxaReferenciaLiquidaAa();
        return passivoRepository.findByAtivoTrueOrderByCetEfetivoAaDesc().stream()
                .map(p -> {
                    AmortizacaoComparacao cmp = executarComparacao(
                            p, p.getParcelaAtual(), null, taxaRef, null, null, true);
                    return toComparacaoResponse(p, cmp, cons);
                })
                .sorted(Comparator.comparing(AmortizacaoComparacaoResponse::cetDividaAa).reversed())
                .toList();
    }

    @Transactional
    public AmortizacaoResponse solicitar(AmortizacaoSolicitacaoRequest req) {
        PassivoEntity passivo = buscarPassivo(req.passivoId());
        ParametroEntity param = parametroVigente();
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        AmortizacaoComparacao cmp = executarComparacao(
                passivo, req.valor(), req.modalidade(),
                req.retornoAlternativaLiquidaAa(), req.retornoAlternativaBrutaAa(),
                null, true);

        if (cmp.recomendacao() == RecomendacaoAmortizacao.BLOQUEADO_LIQUIDEZ) {
            throw new BusinessRuleException(cmp.explicacao());
        }
        if (cmp.recomendacao() == RecomendacaoAmortizacao.BLOQUEADO_RESERVA) {
            if (req.justificativaReserva() == null || req.justificativaReserva().isBlank()) {
                throw new BusinessRuleException(
                        "Reserva líquida abaixo do piso. Informe justificativa explícita para prosseguir.");
            }
        }

        TetoCheck teto = avaliarTeto(param, cons, req.valor());
        if (teto.ultrapassa() && (req.justificativaTeto() == null || req.justificativaTeto().isBlank())) {
            throw new BusinessRuleException(
                    "Operação ultrapassa o teto anual de amortização extraordinária ("
                            + fmt(cons.tetoAmortizacaoAnual()) + "). "
                            + "Usado no ano: " + fmt(cons.tetoAmortizacaoUsadoAno())
                            + ". Informe justificativa reforçada de desvio de plano.");
        }

        AmortizacaoEntity a = novaEntidade(passivo, req.valor(), req.modalidade(), param, cmp);
        a.setOrigem("SOLICITACAO");
        a.setRacional(req.racional() + teto.alertaTexto());
        a.setJustificativaReserva(req.justificativaReserva());
        a.setJustificativaTeto(req.justificativaTeto());
        a.setUltrapassouTeto(teto.ultrapassa());

        String gov;
        if (AmortizacaoComparador.acionaPeriodoReflexao(
                req.valor(), passivo.getParcelaAtual(),
                param.getReflexaoMinimoParcelas())) {
            int horas = param.getReflexaoHoras() != null ? param.getReflexaoHoras() : 48;
            a.setStatus("PENDENTE_REFLEXAO");
            a.setPendenteAte(Instant.now().plusSeconds(horas * 3600L));
            gov = "Período de reflexão de " + horas + "h acionado. Confirmação liberada após esse prazo."
                    + teto.alertaTexto();
        } else {
            a.setStatus("PRONTA");
            gov = "Abaixo do limiar de reflexão — pode confirmar após revisar o comparativo."
                    + teto.alertaTexto();
        }

        a = amortizacaoRepository.save(a);
        return toAmortizacaoResponse(a, cmp.explicacao() + " " + gov);
    }

    /**
     * Registra amortização já executada na instituição (fato consumado).
     * Abate o teto anual, atualiza saldo e regenera cronograma.
     */
    @Transactional
    public AmortizacaoResponse registrarExecutada(AmortizacaoRegistroRequest req) {
        PassivoEntity passivo = buscarPassivo(req.passivoId());
        ParametroEntity param = parametroVigente();
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        AmortizacaoComparacao cmp = executarComparacao(
                passivo, req.valor(), req.modalidade(),
                req.retornoAlternativaLiquidaAa(), null, null, true);

        TetoCheck teto = avaliarTeto(param, cons, req.valor());
        if (teto.ultrapassa() && (req.justificativaTeto() == null || req.justificativaTeto().isBlank())) {
            throw new BusinessRuleException(
                    "Registro ultrapassa o teto anual. Informe justificativa reforçada de desvio de plano.");
        }

        AmortizacaoEntity a = novaEntidade(passivo, req.valor(), req.modalidade(), param, cmp);
        a.setOrigem("REGISTRO_POSTERIORI");
        a.setStatus("EFETIVADA");
        a.setDataEfetivacao(req.dataEfetivacao().atStartOfDay().toInstant(ZoneOffset.UTC));
        a.setRacional(req.racional() + teto.alertaTexto());
        a.setJustificativaReserva(req.justificativaReserva());
        a.setJustificativaTeto(req.justificativaTeto());
        a.setUltrapassouTeto(teto.ultrapassa());
        a = amortizacaoRepository.save(a);

        aplicarNoPassivo(passivo, a);
        return toAmortizacaoResponse(a,
                "Amortização registrada a posteriori. Cronograma regenerado. "
                        + "Nenhuma operação bancária foi executada pelo sistema." + teto.alertaTexto());
    }

    @Transactional
    public AmortizacaoResponse confirmar(Long id) {
        AmortizacaoEntity a = amortizacaoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Amortização não encontrada: " + id));
        if ("EFETIVADA".equals(a.getStatus()) || "CANCELADA".equals(a.getStatus())) {
            throw new BusinessRuleException("Amortização já finalizada: " + a.getStatus());
        }
        if ("PENDENTE_REFLEXAO".equals(a.getStatus())
                && a.getPendenteAte() != null
                && Instant.now().isBefore(a.getPendenteAte())) {
            throw new BusinessRuleException(
                    "Aguarde o período de reflexão até " + a.getPendenteAte());
        }
        a.setStatus("EFETIVADA");
        a.setDataEfetivacao(Instant.now());
        PassivoEntity passivo = buscarPassivo(a.getPassivoId());
        aplicarNoPassivo(passivo, a);
        a = amortizacaoRepository.save(a);
        return toAmortizacaoResponse(a, "Decisão registrada. Nenhuma operação bancária foi executada pelo sistema.");
    }

    @Transactional(readOnly = true)
    public List<AmortizacaoResponse> listar(Long passivoId) {
        List<AmortizacaoEntity> lista = passivoId != null
                ? amortizacaoRepository.findByPassivoIdOrderByDataSolicitacaoDesc(passivoId)
                : amortizacaoRepository.findAll();
        return lista.stream().map(a -> toAmortizacaoResponse(a, null)).toList();
    }

    private void aplicarNoPassivo(PassivoEntity passivo, AmortizacaoEntity a) {
        passivo.setSaldoDevedor(passivo.getSaldoDevedor().subtract(a.getValor()).max(BigDecimal.ZERO));
        if ("REDUZIR_PRAZO".equals(a.getModalidade()) && a.getMesesEliminados() != null) {
            passivo.setPrazoRemanescenteMeses(
                    Math.max(0, passivo.getPrazoRemanescenteMeses() - a.getMesesEliminados()));
        }
        passivoRepository.save(passivo);
        if (!"CONSORCIO".equalsIgnoreCase(passivo.getSistemaAmortizacao())) {
            passivoApplicationService.regenerarCronograma(passivo.getId());
        }
    }

    private AmortizacaoEntity novaEntidade(
            PassivoEntity passivo, BigDecimal valor, String modalidade,
            ParametroEntity param, AmortizacaoComparacao cmp) {
        AmortizacaoEntity a = new AmortizacaoEntity();
        a.setPassivoId(passivo.getId());
        a.setDataSolicitacao(Instant.now());
        a.setValor(valor);
        a.setModalidade(resolverModalidade(modalidade, param).name());
        a.setCetVigenteAa(cmp.cetDividaAa());
        a.setRetornoAlternativaAa(cmp.retornoAlternativaLiquidaAa());
        a.setDiferencialPp(cmp.diferencialPpAa());
        a.setEconomiaVp(cmp.economiaValorPresente());
        a.setValorNominalEliminado(cmp.valorNominalEliminado());
        a.setMesesEliminados(cmp.mesesEliminados());
        a.setTaxaImplicitaAa(cmp.taxaImplicitaAa());
        a.setImpactoPl12m(cmp.impactoPl12m());
        a.setImpactoPl36m(cmp.impactoPl36m());
        a.setRecomendacao(cmp.recomendacao().name());
        return a;
    }

    private record TetoCheck(boolean ultrapassa, String alertaTexto) {
    }

    private TetoCheck avaliarTeto(ParametroEntity param, ConsolidacaoResponse cons, BigDecimal valor) {
        if (param.getTetoAmortizacaoAnual() == null) {
            return new TetoCheck(false, "");
        }
        BigDecimal usado = cons.tetoAmortizacaoUsadoAno() != null
                ? cons.tetoAmortizacaoUsadoAno() : BigDecimal.ZERO;
        boolean ultrapassa = usado.add(valor).compareTo(param.getTetoAmortizacaoAnual()) > 0;
        if (!ultrapassa) {
            return new TetoCheck(false, "");
        }
        return new TetoCheck(true,
                " ALERTA DE DESVIO DE PLANO: ultrapassa teto anual de amortização extraordinária ("
                        + fmt(param.getTetoAmortizacaoAnual()) + "; usado "
                        + fmt(usado) + ").");
    }

    private AmortizacaoComparacao executarComparacao(
            PassivoEntity p, BigDecimal valor, String modalidade,
            BigDecimal retornoAltLiquida, BigDecimal retornoAltBruta,
            BigDecimal inflacaoProjetada, Boolean cetJaProjetado) {
        ParametroEntity param = parametroVigente();
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        BigDecimal alt = retornoAltLiquida != null ? retornoAltLiquida : cons.taxaReferenciaLiquidaAa();
        AmortizacaoComparacao.ModalidadeAmortizacao mod = resolverModalidade(modalidade, param);

        // Reserva líquida (só RF com liquidez diária) — operação abate do disponível líquido
        BigDecimal reservaApos = cons.reservaEmergenciaLiquida().subtract(valor);

        BigDecimal seguros = nz(p.getSeguroMipMensal())
                .add(nz(p.getSeguroDfiMensal()))
                .add(nz(p.getTaxaAdministracaoMensal()));

        LocalDate proximo = LocalDate.now().withDayOfMonth(
                Math.min(p.getDiaVencimento() != null ? p.getDiaVencimento() : 10, 28));
        if (!proximo.isAfter(LocalDate.now())) {
            proximo = proximo.plusMonths(1);
        }

        return AmortizacaoComparador.comparar(new AmortizacaoComparador.Entrada(
                SistemaAmortizacao.valueOf(p.getSistemaAmortizacao()),
                p.getSaldoDevedor(),
                p.getCetEfetivoAa(),
                p.getTaxaJurosNominalAa() != null ? p.getTaxaJurosNominalAa() : p.getCetEfetivoAa(),
                p.getPrazoRemanescenteMeses(),
                p.getParcelaAtual(),
                seguros,
                proximo,
                valor,
                alt,
                mod,
                Boolean.TRUE.equals(p.getConsorcioContemplado()),
                cons.caixaLivre(),
                reservaApos,
                cons.pisoReserva(),
                p.getIndexador(),
                "CDI",
                inflacaoProjetada,
                cetJaProjetado == null || cetJaProjetado,
                retornoAltBruta,
                IrRegressivoCalculator.mesesParaDias(p.getPrazoRemanescenteMeses())));
    }

    private AmortizacaoComparacao.ModalidadeAmortizacao resolverModalidade(String modalidade, ParametroEntity param) {
        if (modalidade != null && !modalidade.isBlank()) {
            return AmortizacaoComparacao.ModalidadeAmortizacao.valueOf(modalidade);
        }
        if (param != null && "REDUZIR_PARCELA".equals(param.getObjetivoAmortizacao())) {
            return AmortizacaoComparacao.ModalidadeAmortizacao.REDUZIR_PARCELA;
        }
        return AmortizacaoComparacao.ModalidadeAmortizacao.REDUZIR_PRAZO;
    }

    private ParametroEntity parametroVigente() {
        return parametroRepository.findTopByVigenteAteIsNullOrderByVersaoDesc()
                .orElseThrow(() -> new BusinessRuleException("Parâmetros patrimoniais não configurados"));
    }

    private PassivoEntity buscarPassivo(Long id) {
        return passivoRepository.findById(id)
                .filter(p -> Boolean.TRUE.equals(p.getAtivo()))
                .orElseThrow(() -> new ResourceNotFoundException("Passivo não encontrado: " + id));
    }

    private AmortizacaoComparacaoResponse toComparacaoResponse(
            PassivoEntity p, AmortizacaoComparacao cmp, ConsolidacaoResponse cons) {
        boolean ultrapassaTeto = cons.tetoAmortizacaoAnual() != null
                && cons.tetoAmortizacaoUsadoAno().add(cmp.valorAmortizacao())
                .compareTo(cons.tetoAmortizacaoAnual()) > 0;
        return new AmortizacaoComparacaoResponse(
                p.getId(),
                p.getCredor(),
                cmp.cetDividaAa(),
                cmp.retornoAlternativaLiquidaAa(),
                cmp.diferencialPpAa(),
                cmp.valorAmortizacao(),
                cmp.mesesEliminados(),
                cmp.valorNominalEliminado(),
                cmp.economiaValorPresente(),
                cmp.taxaImplicitaAa(),
                cmp.impactoPl12m(),
                cmp.impactoPl36m(),
                cmp.modalidade().name(),
                cmp.recomendacao().name(),
                cmp.explicacao(),
                cmp.consorcio(),
                cmp.contemplado(),
                cons.caixaLivre(),
                cons.reservaEmergenciaLiquida(),
                cons.pisoReserva(),
                cons.rendaFixaTotal(),
                cons.reservaEmergenciaLiquida(),
                cmp.baseComparacao(),
                cmp.avisoBase(),
                cmp.horizonteComparacaoDias(),
                cmp.aliquotaIrAlternativa(),
                cons.tetoAmortizacaoAnual(),
                cons.tetoAmortizacaoUsadoAno(),
                cons.tetoAmortizacaoDisponivel(),
                ultrapassaTeto,
                cons.taxaReferenciaAtualizadaEm(),
                cons.taxaReferenciaDesatualizada());
    }

    private AmortizacaoResponse toAmortizacaoResponse(AmortizacaoEntity a, String gov) {
        return new AmortizacaoResponse(
                a.getId(), a.getPassivoId(), a.getDataSolicitacao(), a.getDataEfetivacao(),
                a.getValor(), a.getModalidade(), a.getStatus(), a.getOrigem(), a.getRacional(),
                a.getCetVigenteAa(), a.getRetornoAlternativaAa(), a.getDiferencialPp(),
                a.getEconomiaVp(), a.getValorNominalEliminado(), a.getMesesEliminados(),
                a.getTaxaImplicitaAa(), a.getImpactoPl12m(), a.getImpactoPl36m(),
                a.getRecomendacao(), a.getPendenteAte(),
                Boolean.TRUE.equals(a.getUltrapassouTeto()), gov);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }

    private static String fmt(BigDecimal v) {
        return v == null ? "—" : MoneyMath.money(v).toPlainString();
    }
}
