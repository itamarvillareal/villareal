package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.AcertoResumoPeriodoResponse;
import br.com.vilareal.financeiro.api.dto.AcertoResumoPeriodosResponse;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Detecção de períodos do acerto (Etapa 5c): bloco manual, cortes por saldo zero e overlay de
 * fechamentos formais.
 */
final class AcertoPeriodosDetector {

    static final BigDecimal TOLERANCIA_ZERO = new BigDecimal("0.01");

    static final String STATUS_FECHADO_MANUAL = "FECHADO_MANUAL";
    static final String STATUS_FECHADO_AUTO = "FECHADO_AUTO";
    static final String STATUS_FECHADO = "FECHADO";
    static final String STATUS_ABERTO = "ABERTO";

    private AcertoPeriodosDetector() {}

    record LancamentoLeve(
            Long id,
            LocalDate data,
            String natureza,
            BigDecimal valor,
            boolean pendente,
            boolean naoConferido,
            Long processoId) {}

    record FechamentoFormal(Long id, LocalDate periodoInicio, LocalDate periodoFim, boolean temPdf) {}

    static AcertoResumoPeriodosResponse montarResumo(
            List<LancamentoLeve> lancamentos,
            LocalDate dataUltimoAcertoConhecido,
            List<FechamentoFormal> fechamentosFormais) {
        List<PeriodoAgg> agregados = detectar(lancamentos, dataUltimoAcertoConhecido, fechamentosFormais);

        AcertoResumoPeriodosResponse out = new AcertoResumoPeriodosResponse();
        out.setDataUltimoAcertoConhecido(dataUltimoAcertoConhecido);

        LocalDate ultimoCorte = dataUltimoAcertoConhecido;
        Integer abertoIdx = null;

        for (int i = 0; i < agregados.size(); i++) {
            PeriodoAgg p = agregados.get(i);
            AcertoResumoPeriodoResponse dto = new AcertoResumoPeriodoResponse();
            dto.setIndice(i);
            dto.setStatus(p.status());
            dto.setDataInicio(p.dataInicio());
            dto.setDataFim(p.dataFim());
            dto.setSaldoFinal(p.saldoFinal());
            dto.setQtdLancamentos(p.qtdLancamentos());
            dto.setQtdProcessos(p.qtdProcessos());
            dto.setPendentes(p.pendentes());
            dto.setNaoConferidos(p.naoConferidos());
            dto.setFechamentoId(p.fechamentoId());
            dto.setTemPdf(p.temPdf());
            out.getPeriodos().add(dto);

            if (STATUS_ABERTO.equals(p.status())) {
                abertoIdx = i;
            } else if (p.dataFim() != null) {
                ultimoCorte = p.dataFim();
            }
        }

        out.setPeriodoAbertoIndice(abertoIdx);
        out.setUltimoCorteData(ultimoCorte);
        return out;
    }

    static List<PeriodoAgg> detectar(
            List<LancamentoLeve> todos,
            LocalDate corteManual,
            List<FechamentoFormal> formais) {
        List<LancamentoLeve> restantes = new ArrayList<>(todos);
        List<PeriodoAgg> periodos = new ArrayList<>();

        if (corteManual != null) {
            List<LancamentoLeve> manuais = new ArrayList<>();
            List<LancamentoLeve> depois = new ArrayList<>();
            for (LancamentoLeve l : restantes) {
                if (l.data() != null && !l.data().isAfter(corteManual)) {
                    manuais.add(l);
                } else {
                    depois.add(l);
                }
            }
            if (!manuais.isEmpty()) {
                periodos.add(agregar(manuais, STATUS_FECHADO_MANUAL, corteManual, BigDecimal.ZERO, null, false));
            }
            restantes = depois;
        }

        List<LancamentoLeve> buffer = new ArrayList<>();
        BigDecimal saldo = BigDecimal.ZERO;

        for (LancamentoLeve l : restantes) {
            buffer.add(l);
            saldo = saldo.add(valorAssinado(l));
            if (saldo.abs().compareTo(TOLERANCIA_ZERO) <= 0) {
                LocalDate fim = l.data();
                periodos.add(agregar(buffer, STATUS_FECHADO_AUTO, fim, BigDecimal.ZERO, null, false));
                buffer = new ArrayList<>();
                saldo = BigDecimal.ZERO;
            }
        }

        if (!buffer.isEmpty()) {
            periodos.add(agregar(buffer, STATUS_ABERTO, null, saldo, null, false));
        }

        aplicarFechamentosFormais(periodos, todos, formais);
        return periodos;
    }

    private static void aplicarFechamentosFormais(
            List<PeriodoAgg> periodos, List<LancamentoLeve> todos, List<FechamentoFormal> formais) {
        if (formais == null || formais.isEmpty()) {
            return;
        }
        for (FechamentoFormal f : formais) {
            if (f.periodoFim() == null) {
                continue;
            }
            boolean aplicado = false;
            for (int i = 0; i < periodos.size(); i++) {
                PeriodoAgg p = periodos.get(i);
                if (STATUS_ABERTO.equals(p.status()) || STATUS_FECHADO_MANUAL.equals(p.status())) {
                    continue;
                }
                if (p.dataFim() != null && p.dataFim().equals(f.periodoFim())) {
                    periodos.set(i, p.comFechamentoFormal(f));
                    aplicado = true;
                    break;
                }
            }
            if (!aplicado && f.periodoInicio() != null) {
                List<LancamentoLeve> noIntervalo = todos.stream()
                        .filter(l -> l.data() != null
                                && !l.data().isBefore(f.periodoInicio())
                                && !l.data().isAfter(f.periodoFim()))
                        .toList();
                if (!noIntervalo.isEmpty()) {
                    int insertAt = 0;
                    for (int i = 0; i < periodos.size(); i++) {
                        if (STATUS_ABERTO.equals(periodos.get(i).status())) {
                            insertAt = i;
                            break;
                        }
                        insertAt = i + 1;
                    }
                    periodos.add(
                            insertAt,
                            agregar(
                                    noIntervalo,
                                    STATUS_FECHADO,
                                    f.periodoFim(),
                                    BigDecimal.ZERO,
                                    f.id(),
                                    f.temPdf()));
                }
            }
        }
    }

    private static PeriodoAgg agregar(
            List<LancamentoLeve> itens,
            String status,
            LocalDate dataFim,
            BigDecimal saldoFinal,
            Long fechamentoId,
            boolean temPdf) {
        LocalDate inicio = itens.stream()
                .map(LancamentoLeve::data)
                .filter(d -> d != null)
                .min(LocalDate::compareTo)
                .orElse(null);
        long pendentes = itens.stream().filter(LancamentoLeve::pendente).count();
        long naoConf = itens.stream().filter(LancamentoLeve::naoConferido).count();
        Set<Long> procs = new HashSet<>();
        for (LancamentoLeve l : itens) {
            if (l.processoId() != null) {
                procs.add(l.processoId());
            }
        }
        return new PeriodoAgg(
                status,
                inicio,
                dataFim,
                saldoFinal,
                itens.size(),
                procs.size(),
                pendentes,
                naoConf,
                fechamentoId,
                temPdf);
    }

    private static BigDecimal valorAssinado(LancamentoLeve l) {
        BigDecimal v = l.valor() != null ? l.valor() : BigDecimal.ZERO;
        return "CREDITO".equalsIgnoreCase(l.natureza()) ? v : v.negate();
    }

    record PeriodoAgg(
            String status,
            LocalDate dataInicio,
            LocalDate dataFim,
            BigDecimal saldoFinal,
            long qtdLancamentos,
            long qtdProcessos,
            long pendentes,
            long naoConferidos,
            Long fechamentoId,
            boolean temPdf) {

        PeriodoAgg comFechamentoFormal(FechamentoFormal f) {
            return new PeriodoAgg(
                    STATUS_FECHADO,
                    dataInicio,
                    dataFim,
                    saldoFinal,
                    qtdLancamentos,
                    qtdProcessos,
                    pendentes,
                    naoConferidos,
                    f.id(),
                    f.temPdf());
        }
    }
}
