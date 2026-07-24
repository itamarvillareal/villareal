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

    public AmortizacaoApplicationService(
            PassivoRepository passivoRepository,
            AmortizacaoRepository amortizacaoRepository,
            ParametroRepository parametroRepository,
            PatrimonioConsolidacaoService consolidacaoService) {
        this.passivoRepository = passivoRepository;
        this.amortizacaoRepository = amortizacaoRepository;
        this.parametroRepository = parametroRepository;
        this.consolidacaoService = consolidacaoService;
    }

    @Transactional(readOnly = true)
    public AmortizacaoComparacaoResponse simular(AmortizacaoSimulacaoRequest req) {
        PassivoEntity passivo = buscarPassivo(req.passivoId());
        AmortizacaoComparacao cmp = executarComparacao(passivo, req.valor(), req.modalidade(), req.retornoAlternativaLiquidaAa());
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        return toComparacaoResponse(passivo, cmp, cons);
    }

    @Transactional(readOnly = true)
    public List<AmortizacaoComparacaoResponse> rankingPrioridade() {
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        BigDecimal taxaRef = cons.taxaReferenciaLiquidaAa();
        return passivoRepository.findByAtivoTrueOrderByCetEfetivoAaDesc().stream()
                .map(p -> {
                    BigDecimal valor = p.getParcelaAtual();
                    AmortizacaoComparacao cmp = executarComparacao(p, valor, null, taxaRef);
                    return toComparacaoResponse(p, cmp, cons);
                })
                .sorted(Comparator.comparing(AmortizacaoComparacaoResponse::cetDividaAa).reversed())
                .toList();
    }

    /**
     * Fluxo obrigatório §4.5: comparativo + checagem reserva + período de reflexão.
     */
    @Transactional
    public AmortizacaoResponse solicitar(AmortizacaoSolicitacaoRequest req) {
        PassivoEntity passivo = buscarPassivo(req.passivoId());
        ParametroEntity param = parametroVigente();
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        AmortizacaoComparacao cmp = executarComparacao(
                passivo, req.valor(), req.modalidade(), req.retornoAlternativaLiquidaAa());

        if (cmp.recomendacao() == RecomendacaoAmortizacao.BLOQUEADO_LIQUIDEZ) {
            throw new BusinessRuleException(cmp.explicacao());
        }
        if (cmp.recomendacao() == RecomendacaoAmortizacao.BLOQUEADO_RESERVA) {
            if (req.justificativaReserva() == null || req.justificativaReserva().isBlank()) {
                throw new BusinessRuleException(
                        "Reserva abaixo do piso. Informe justificativa explícita para prosseguir.");
            }
        }

        String alertaTeto = "";
        if (param.getTetoAmortizacaoAnual() != null) {
            LocalDate inicioAno = LocalDate.now().withDayOfYear(1);
            Instant ini = inicioAno.atStartOfDay().toInstant(ZoneOffset.UTC);
            Instant fim = inicioAno.plusYears(1).atStartOfDay().toInstant(ZoneOffset.UTC);
            BigDecimal acumulado = amortizacaoRepository.somaEfetivadaNoPeriodo(ini, fim);
            if (acumulado.add(req.valor()).compareTo(param.getTetoAmortizacaoAnual()) > 0) {
                alertaTeto = " ALERTA: operação ultrapassa o teto anual de amortização extraordinária ("
                        + param.getTetoAmortizacaoAnual().toPlainString() + ").";
            }
        }

        AmortizacaoEntity a = new AmortizacaoEntity();
        a.setPassivoId(passivo.getId());
        a.setDataSolicitacao(Instant.now());
        a.setValor(req.valor());
        a.setModalidade(resolverModalidade(req.modalidade(), param).name());
        a.setRacional(req.racional() + alertaTeto);
        a.setJustificativaReserva(req.justificativaReserva());
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

        BigDecimal limiarReflexao = passivo.getParcelaAtual()
                .multiply(param.getReflexaoMinimoParcelas() != null
                        ? param.getReflexaoMinimoParcelas() : BigDecimal.ONE);
        String gov;
        if (req.valor().compareTo(limiarReflexao) >= 0) {
            int horas = param.getReflexaoHoras() != null ? param.getReflexaoHoras() : 48;
            a.setStatus("PENDENTE_REFLEXAO");
            a.setPendenteAte(Instant.now().plusSeconds(horas * 3600L));
            gov = "Período de reflexão de " + horas + "h acionado (valor ≥ "
                    + limiarReflexao.toPlainString() + "). Confirmação liberada após esse prazo."
                    + alertaTeto;
        } else {
            a.setStatus("PRONTA");
            gov = "Abaixo do limiar de reflexão — pode confirmar imediatamente após revisar o comparativo."
                    + alertaTeto;
        }

        a = amortizacaoRepository.save(a);
        return toAmortizacaoResponse(a, cmp.explicacao() + " " + gov);
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
        // Sistema recomenda, não executa operação financeira — apenas registra a decisão.
        a.setStatus("EFETIVADA");
        a.setDataEfetivacao(Instant.now());
        PassivoEntity passivo = buscarPassivo(a.getPassivoId());
        passivo.setSaldoDevedor(passivo.getSaldoDevedor().subtract(a.getValor()).max(BigDecimal.ZERO));
        if ("REDUZIR_PRAZO".equals(a.getModalidade()) && a.getMesesEliminados() != null) {
            passivo.setPrazoRemanescenteMeses(
                    Math.max(0, passivo.getPrazoRemanescenteMeses() - a.getMesesEliminados()));
        }
        passivoRepository.save(passivo);
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

    private AmortizacaoComparacao executarComparacao(
            PassivoEntity p, BigDecimal valor, String modalidade, BigDecimal retornoAlt) {
        ParametroEntity param = parametroVigente();
        ConsolidacaoResponse cons = consolidacaoService.consolidar();
        BigDecimal alt = retornoAlt != null ? retornoAlt : cons.taxaReferenciaLiquidaAa();
        AmortizacaoComparacao.ModalidadeAmortizacao mod = resolverModalidade(modalidade, param);

        BigDecimal reservaApos = cons.reservaEmergencia().subtract(valor);
        // Se RF de reserva for usada, reserva cai; caixa livre é o teto operacional
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
                cons.pisoReserva()));
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
                cons.reservaEmergencia(),
                cons.pisoReserva());
    }

    private AmortizacaoResponse toAmortizacaoResponse(AmortizacaoEntity a, String gov) {
        return new AmortizacaoResponse(
                a.getId(), a.getPassivoId(), a.getDataSolicitacao(), a.getDataEfetivacao(),
                a.getValor(), a.getModalidade(), a.getStatus(), a.getRacional(),
                a.getCetVigenteAa(), a.getRetornoAlternativaAa(), a.getDiferencialPp(),
                a.getEconomiaVp(), a.getValorNominalEliminado(), a.getMesesEliminados(),
                a.getTaxaImplicitaAa(), a.getImpactoPl12m(), a.getImpactoPl36m(),
                a.getRecomendacao(), a.getPendenteAte(), gov);
    }

    private static BigDecimal nz(BigDecimal v) {
        return v != null ? v : BigDecimal.ZERO;
    }
}
