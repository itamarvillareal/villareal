package br.com.vilareal.pagamento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pagamento.api.dto.prestacao.PrestacaoContasImovelDto;
import br.com.vilareal.pagamento.api.dto.relatorio.*;
import br.com.vilareal.pagamento.infrastructure.persistence.RelatoriosPagamentosQueryDao;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.*;

@Service
public class RelatoriosPagamentosService {

    private static final int MAX_PERIOD_DAYS = 731;
    private static final double ANOMALIA_LIMITE = 30.0;

    private static final String[] NOMES_MESES = {
        "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
        "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
    };

    private final RelatoriosPagamentosQueryDao queryDao;
    private final ImovelRepository imovelRepository;
    private final Clock clock;

    public RelatoriosPagamentosService(
            RelatoriosPagamentosQueryDao queryDao, ImovelRepository imovelRepository, Clock clock) {
        this.queryDao = queryDao;
        this.imovelRepository = imovelRepository;
        this.clock = clock;
    }

    @Transactional(readOnly = true)
    public GastosPorImovelResponse gastosPorImovel(
            LocalDate periodoInicio, LocalDate periodoFim, Long clienteId, List<String> categorias) {
        validarPeriodo(periodoInicio, periodoFim);
        List<Object[]> rows = queryDao.gastosPorImovelCategoria(periodoInicio, periodoFim, clienteId, categorias);

        Map<Long, GastosPorImovelResponse.GastosPorImovelItem> mapa = new LinkedHashMap<>();
        Set<String> catsPresentes = new TreeSet<>();
        BigDecimal totalGeral = BigDecimal.ZERO;

        for (Object[] r : rows) {
            Long imovelId = toLong(r[0]);
            String cat = String.valueOf(r[1]);
            BigDecimal val = toBigDecimal(r[2]);
            catsPresentes.add(cat);
            GastosPorImovelResponse.GastosPorImovelItem item =
                    mapa.computeIfAbsent(imovelId, id -> {
                        GastosPorImovelResponse.GastosPorImovelItem x =
                                new GastosPorImovelResponse.GastosPorImovelItem();
                        x.setImovelId(id);
                        preencherImovelResumo(x, id);
                        return x;
                    });
            item.getGastosPorCategoria().put(cat, val);
            item.setTotal(safeAdd(item.getTotal(), val));
            totalGeral = totalGeral.add(val);
        }

        GastosPorImovelResponse resp = new GastosPorImovelResponse();
        resp.setPeriodo(new RelatorioPeriodoDto(periodoInicio, periodoFim));
        resp.setImoveis(new ArrayList<>(mapa.values()));
        resp.setTotalGeral(totalGeral.setScale(2, RoundingMode.HALF_UP));
        resp.setCategoriasPresentes(new ArrayList<>(catsPresentes));
        return resp;
    }

    @Transactional(readOnly = true)
    public ComparativoMensalResponse comparativoMensal(Integer ano, Long imovelId) {
        if (ano == null) {
            throw new BusinessRuleException("Informe o ano.");
        }
        List<Object[]> rows = queryDao.comparativoMensal(ano, imovelId);

        Map<Integer, ComparativoMensalResponse.MesComparativo> porMes = new LinkedHashMap<>();
        Map<String, Map<Integer, BigDecimal>> catPorMes = new HashMap<>();

        for (Object[] r : rows) {
            int mes = toInt(r[0]);
            String cat = String.valueOf(r[1]);
            BigDecimal val = toBigDecimal(r[2]);
            ComparativoMensalResponse.MesComparativo mc = porMes.computeIfAbsent(mes, m -> {
                ComparativoMensalResponse.MesComparativo x = new ComparativoMensalResponse.MesComparativo();
                x.setMes(m);
                x.setNomeMes(nomeMes(m));
                return x;
            });
            mc.getCategorias().put(cat, val);
            mc.setTotal(safeAdd(mc.getTotal(), val));
            catPorMes.computeIfAbsent(cat, k -> new HashMap<>()).put(mes, val);
        }

        for (int m = 1; m <= 12; m++) {
            porMes.computeIfAbsent(m, mm -> {
                ComparativoMensalResponse.MesComparativo x = new ComparativoMensalResponse.MesComparativo();
                x.setMes(mm);
                x.setNomeMes(nomeMes(mm));
                return x;
            });
        }

        List<ComparativoMensalResponse.MesComparativo> meses = new ArrayList<>();
        BigDecimal somaTotais = BigDecimal.ZERO;
        int mesesComDado = 0;
        for (int m = 1; m <= 12; m++) {
            ComparativoMensalResponse.MesComparativo mc = porMes.get(m);
            meses.add(mc);
            if (mc.getTotal() != null && mc.getTotal().compareTo(BigDecimal.ZERO) > 0) {
                somaTotais = somaTotais.add(mc.getTotal());
                mesesComDado++;
            }
        }

        List<ComparativoMensalResponse.AlertaAnomalia> alertas = new ArrayList<>();
        for (Map.Entry<String, Map<Integer, BigDecimal>> e : catPorMes.entrySet()) {
            String cat = e.getKey();
            for (Map.Entry<Integer, BigDecimal> me : e.getValue().entrySet()) {
                int mes = me.getKey();
                BigDecimal valor = me.getValue();
                BigDecimal media6 = media6MesesAnteriores(e.getValue(), mes);
                if (media6.compareTo(BigDecimal.ZERO) > 0) {
                    double pct =
                            valor.subtract(media6)
                                            .multiply(BigDecimal.valueOf(100))
                                            .divide(media6, 2, RoundingMode.HALF_UP)
                                            .doubleValue();
                    if (pct > ANOMALIA_LIMITE) {
                        ComparativoMensalResponse.AlertaAnomalia a =
                                new ComparativoMensalResponse.AlertaAnomalia();
                        a.setMes(mes);
                        a.setCategoria(cat);
                        a.setValor(valor);
                        a.setMedia6m(media6.setScale(2, RoundingMode.HALF_UP));
                        a.setPercentualAcima(pct);
                        alertas.add(a);
                    }
                }
            }
        }

        ComparativoMensalResponse resp = new ComparativoMensalResponse();
        resp.setAno(ano);
        if (imovelId != null) {
            PrestacaoContasImovelDto im = new PrestacaoContasImovelDto();
            im.setId(imovelId);
            preencherImovelDto(im, imovelId);
            resp.setImovel(im);
        }
        resp.setMeses(meses);
        resp.setMediaMensal(
                mesesComDado > 0
                        ? somaTotais.divide(BigDecimal.valueOf(mesesComDado), 2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO);
        resp.setAlertasAnomalia(alertas);
        return resp;
    }

    @Transactional(readOnly = true)
    public LucratividadeResponse lucratividade(LocalDate periodoInicio, LocalDate periodoFim) {
        validarPeriodo(periodoInicio, periodoFim);
        List<Object[]> acertados = queryDao.lucratividadeAcertados(periodoInicio, periodoFim);

        Map<Long, LucratividadeResponse.LucratividadeImovelItem> mapa = new LinkedHashMap<>();
        List<Long> pagamentoIds = new ArrayList<>();

        for (Object[] r : acertados) {
            Long pagId = toLong(r[0]);
            Long imovelId = toLong(r[1]);
            BigDecimal valor = toBigDecimal(r[2]);
            pagamentoIds.add(pagId);
            LucratividadeResponse.LucratividadeImovelItem item =
                    mapa.computeIfAbsent(imovelId, id -> {
                        LucratividadeResponse.LucratividadeImovelItem x =
                                new LucratividadeResponse.LucratividadeImovelItem();
                        x.setImovelId(id);
                        preencherLucratividadeImovel(x, id);
                        return x;
                    });
            item.setVolumeAdministrado(safeAdd(item.getVolumeAdministrado(), valor));
            item.setQtdPagamentos(item.getQtdPagamentos() + 1);
        }

        Map<Long, BigDecimal> receitaPorPagamento = new HashMap<>();
        if (!pagamentoIds.isEmpty()) {
            for (Object[] t : queryDao.prestacaoTaxaPorPagamentoIds(pagamentoIds)) {
                Long pagId = toLong(t[0]);
                BigDecimal taxa = toBigDecimal(t[2]);
                BigDecimal totalPrest = toBigDecimal(t[3]);
                BigDecimal valorPag = null;
                for (Object[] a : acertados) {
                    if (pagId.equals(toLong(a[0]))) {
                        valorPag = toBigDecimal(a[2]);
                        break;
                    }
                }
                if (taxa != null
                        && totalPrest != null
                        && totalPrest.compareTo(BigDecimal.ZERO) > 0
                        && valorPag != null) {
                    BigDecimal parte = taxa.multiply(valorPag)
                            .divide(totalPrest, 2, RoundingMode.HALF_UP);
                    receitaPorPagamento.merge(pagId, parte, BigDecimal::add);
                }
            }
        }

        for (Object[] r : acertados) {
            Long pagId = toLong(r[0]);
            Long imovelId = toLong(r[1]);
            BigDecimal receita = receitaPorPagamento.getOrDefault(pagId, BigDecimal.ZERO);
            LucratividadeResponse.LucratividadeImovelItem item = mapa.get(imovelId);
            if (item != null) {
                item.setReceitaAdministracao(safeAdd(item.getReceitaAdministracao(), receita));
            }
        }

        BigDecimal totalVol = BigDecimal.ZERO;
        BigDecimal totalRec = BigDecimal.ZERO;
        List<LucratividadeResponse.LucratividadeImovelItem> lista = new ArrayList<>(mapa.values());
        lista.sort(Comparator.comparing(
                        LucratividadeResponse.LucratividadeImovelItem::getReceitaAdministracao,
                        Comparator.nullsFirst(Comparator.naturalOrder()))
                .reversed());
        for (LucratividadeResponse.LucratividadeImovelItem i : lista) {
            if (i.getVolumeAdministrado() != null) {
                i.setVolumeAdministrado(i.getVolumeAdministrado().setScale(2, RoundingMode.HALF_UP));
                totalVol = totalVol.add(i.getVolumeAdministrado());
            }
            if (i.getReceitaAdministracao() != null) {
                i.setReceitaAdministracao(i.getReceitaAdministracao().setScale(2, RoundingMode.HALF_UP));
                totalRec = totalRec.add(i.getReceitaAdministracao());
            }
        }

        LucratividadeResponse resp = new LucratividadeResponse();
        resp.setPeriodo(new RelatorioPeriodoDto(periodoInicio, periodoFim));
        resp.setImoveis(lista);
        resp.setTotalVolumeAdministrado(totalVol.setScale(2, RoundingMode.HALF_UP));
        resp.setTotalReceitaAdministracao(totalRec.setScale(2, RoundingMode.HALF_UP));
        return resp;
    }

    @Transactional(readOnly = true)
    public EficienciaResponse eficiencia(LocalDate periodoInicio, LocalDate periodoFim) {
        validarPeriodo(periodoInicio, periodoFim);
        EficienciaResponse resp = new EficienciaResponse();
        resp.setPeriodo(new RelatorioPeriodoDto(periodoInicio, periodoFim));
        resp.setMetricas(calcularMetricasEficiencia(periodoInicio, periodoFim));

        List<EficienciaResponse.EficienciaSerieMensal> serie = new ArrayList<>();
        YearMonth ini = YearMonth.from(periodoInicio);
        YearMonth fim = YearMonth.from(periodoFim);
        for (YearMonth ym = ini; !ym.isAfter(fim); ym = ym.plusMonths(1)) {
            LocalDate mIni = ym.atDay(1);
            LocalDate mFim = ym.atEndOfMonth();
            if (mIni.isBefore(periodoInicio)) {
                mIni = periodoInicio;
            }
            if (mFim.isAfter(periodoFim)) {
                mFim = periodoFim;
            }
            EficienciaResponse.EficienciaMetricas m = calcularMetricasEficiencia(mIni, mFim);
            EficienciaResponse.EficienciaSerieMensal sm = new EficienciaResponse.EficienciaSerieMensal();
            sm.setMes(ym.getMonthValue());
            sm.setNomeMes(nomeMes(ym.getMonthValue()));
            sm.setTempoMedioIdentificacaoAgendamento(m.getTempoMedioIdentificacaoAgendamento());
            sm.setTempoMedioAgendamentoPagamento(m.getTempoMedioAgendamentoPagamento());
            sm.setTaxaFalhaBancaria(m.getTaxaFalhaBancaria());
            sm.setTaxaDivergenciaValor(m.getTaxaDivergenciaValor());
            sm.setTaxaVencidos(m.getTaxaVencidos());
            serie.add(sm);
        }
        resp.setSerieMensal(serie);
        return resp;
    }

    @Transactional(readOnly = true)
    public PendenciasResponse pendencias() {
        List<Object[]> rows = queryDao.pendenciasSnapshot();
        Map<Long, PendenciasResponse.PendenciasImovelItem> mapa = new LinkedHashMap<>();
        Map<String, PendenciasResponse.PendenciasResumoItem> resumo = new LinkedHashMap<>();

        for (Object[] r : rows) {
            Long imovelId = r[0] != null ? toLong(r[0]) : null;
            String status = String.valueOf(r[1]);
            long qtd = toLong(r[2]);
            BigDecimal val = toBigDecimal(r[3]);

            long keyImovel = imovelId != null ? imovelId : -1L;
            PendenciasResponse.PendenciasImovelItem item = mapa.computeIfAbsent(keyImovel, k -> {
                PendenciasResponse.PendenciasImovelItem x = new PendenciasResponse.PendenciasImovelItem();
                if (imovelId != null) {
                    x.setImovelId(imovelId);
                    preencherPendenciasImovel(x, imovelId);
                } else {
                    x.setNumeroPlanilha("—");
                    x.setEndereco("Sem imóvel vinculado");
                }
                return x;
            });
            item.getPendencias().put(status, new PendenciasResponse.PendenciasResumoItem(qtd, val));
            item.setTotalAberto(safeAdd(item.getTotalAberto(), val));

            acumularResumoGeral(resumo, status, qtd, val);
        }

        PendenciasResponse.PendenciasResumoItem totalGeral =
                new PendenciasResponse.PendenciasResumoItem(0, BigDecimal.ZERO);
        for (Map.Entry<String, PendenciasResponse.PendenciasResumoItem> e : resumo.entrySet()) {
            if ("totalGeralAberto".equals(e.getKey())) {
                continue;
            }
            totalGeral.setQtd(totalGeral.getQtd() + e.getValue().getQtd());
            totalGeral.setValor(safeAdd(totalGeral.getValor(), e.getValue().getValor()));
        }
        resumo.put("totalGeralAberto", totalGeral);

        PendenciasResponse resp = new PendenciasResponse();
        resp.setGeradoEm(Instant.now(clock));
        resp.setImoveis(new ArrayList<>(mapa.values()));
        resp.setResumoGeral(resumo);
        return resp;
    }

    private EficienciaResponse.EficienciaMetricas calcularMetricasEficiencia(
            LocalDate inicio, LocalDate fim) {
        EficienciaResponse.EficienciaMetricas m = new EficienciaResponse.EficienciaMetricas();
        m.setTempoMedioIdentificacaoAgendamento(round1(queryDao.tempoMedioIdentificacaoAgendamento(inicio, fim)));
        m.setTempoMedioAgendamentoPagamento(round1(queryDao.tempoMedioAgendamentoPagamento(inicio, fim)));
        long agendados = queryDao.countAgendadosNoPeriodo(inicio, fim);
        long falha = queryDao.countFalhaBancariaAtual(inicio, fim);
        m.setTaxaFalhaBancaria(agendados > 0 ? round4((double) falha / agendados) : 0.0);
        long conferidos = queryDao.countConferidosNoPeriodo(inicio, fim);
        long diverg = queryDao.countDivergenciaNoPeriodo(inicio, fim);
        m.setTaxaDivergenciaValor(conferidos > 0 ? round4((double) diverg / conferidos) : 0.0);
        long criados = queryDao.countCriadosNoPeriodo(inicio, fim);
        long venc = queryDao.countVencidosHistoricoNoPeriodo(inicio, fim);
        m.setTaxaVencidos(criados > 0 ? round4((double) venc / criados) : 0.0);
        return m;
    }

    private static void acumularResumoGeral(
            Map<String, PendenciasResponse.PendenciasResumoItem> resumo,
            String status,
            long qtd,
            BigDecimal val) {
        String key =
                switch (status) {
                    case "PENDENTE" -> "totalPendente";
                    case "AGENDADO" -> "totalAgendado";
                    case "PAGO_CONFIRMADO", "PAGO_SEM_COMPROVANTE", "CONFERENCIA_PENDENTE" -> "totalPago";
                    case "CONFERIDO" -> "totalConferido";
                    default -> "outros";
                };
        if ("outros".equals(key)) {
            return;
        }
        PendenciasResponse.PendenciasResumoItem g =
                resumo.computeIfAbsent(key, k -> new PendenciasResponse.PendenciasResumoItem(0, BigDecimal.ZERO));
        g.setQtd(g.getQtd() + qtd);
        g.setValor(safeAdd(g.getValor(), val));
    }

    private void validarPeriodo(LocalDate inicio, LocalDate fim) {
        if (inicio == null || fim == null) {
            throw new BusinessRuleException("Informe periodoInicio e periodoFim.");
        }
        if (fim.isBefore(inicio)) {
            throw new BusinessRuleException("periodoFim deve ser igual ou posterior a periodoInicio.");
        }
        long dias = ChronoUnit.DAYS.between(inicio, fim);
        if (dias > MAX_PERIOD_DAYS) {
            throw new BusinessRuleException("Período máximo de 2 anos. Reduza o intervalo.");
        }
    }

    private static BigDecimal media6MesesAnteriores(Map<Integer, BigDecimal> valoresPorMes, int mesAtual) {
        BigDecimal soma = BigDecimal.ZERO;
        int n = 0;
        for (int i = 1; i <= 6; i++) {
            int m = mesAtual - i;
            if (m >= 1) {
                BigDecimal v = valoresPorMes.get(m);
                if (v != null) {
                    soma = soma.add(v);
                    n++;
                }
            }
        }
        if (n == 0) {
            return BigDecimal.ZERO;
        }
        return soma.divide(BigDecimal.valueOf(n), 2, RoundingMode.HALF_UP);
    }

    private void preencherImovelResumo(GastosPorImovelResponse.GastosPorImovelItem item, Long imovelId) {
        imovelRepository.findById(imovelId).ifPresent(im -> {
            item.setNumeroPlanilha(formatNumeroPlanilha(im));
            item.setEndereco(resolverEndereco(im));
        });
    }

    private void preencherLucratividadeImovel(LucratividadeResponse.LucratividadeImovelItem item, Long imovelId) {
        imovelRepository.findById(imovelId).ifPresent(im -> {
            item.setNumeroPlanilha(formatNumeroPlanilha(im));
            item.setEndereco(resolverEndereco(im));
        });
    }

    private void preencherPendenciasImovel(PendenciasResponse.PendenciasImovelItem item, Long imovelId) {
        imovelRepository.findById(imovelId).ifPresent(im -> {
            item.setNumeroPlanilha(formatNumeroPlanilha(im));
            item.setEndereco(resolverEndereco(im));
        });
    }

    private void preencherImovelDto(PrestacaoContasImovelDto dto, Long imovelId) {
        imovelRepository.findById(imovelId).ifPresent(im -> {
            dto.setNumeroPlanilha(formatNumeroPlanilha(im));
            dto.setEndereco(resolverEndereco(im));
        });
    }

    private static String formatNumeroPlanilha(ImovelEntity im) {
        return im.getNumeroPlanilha() != null ? "F-" + im.getNumeroPlanilha() : String.valueOf(im.getId());
    }

    private static String resolverEndereco(ImovelEntity im) {
        if (im.getEnderecoCompleto() != null && !im.getEnderecoCompleto().isBlank()) {
            return im.getEnderecoCompleto();
        }
        if (im.getCondominio() != null && !im.getCondominio().isBlank()) {
            return im.getCondominio();
        }
        return im.getTitulo();
    }

    private static String nomeMes(int mes) {
        if (mes >= 1 && mes <= 12) {
            return NOMES_MESES[mes - 1];
        }
        return String.valueOf(mes);
    }

    private static BigDecimal safeAdd(BigDecimal a, BigDecimal b) {
        BigDecimal x = a != null ? a : BigDecimal.ZERO;
        BigDecimal y = b != null ? b : BigDecimal.ZERO;
        return x.add(y);
    }

    private static Long toLong(Object o) {
        if (o == null) return null;
        if (o instanceof Number n) return n.longValue();
        return Long.parseLong(o.toString());
    }

    private static int toInt(Object o) {
        if (o instanceof Number n) return n.intValue();
        return Integer.parseInt(o.toString());
    }

    private static BigDecimal toBigDecimal(Object o) {
        if (o == null) return BigDecimal.ZERO;
        if (o instanceof BigDecimal bd) return bd;
        if (o instanceof Number n) return BigDecimal.valueOf(n.doubleValue());
        return new BigDecimal(o.toString());
    }

    private static Double round1(Double v) {
        if (v == null) return null;
        return Math.round(v * 10.0) / 10.0;
    }

    private static double round4(double v) {
        return Math.round(v * 10000.0) / 10000.0;
    }
}
