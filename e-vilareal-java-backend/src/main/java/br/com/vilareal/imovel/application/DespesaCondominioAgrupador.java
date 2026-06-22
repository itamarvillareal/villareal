package br.com.vilareal.imovel.application;

import br.com.vilareal.financeiro.domain.DescricaoNormalizer;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.YearMonth;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Agrupa débitos de condomínio por condomínio/imóvel (não por descrição isolada).
 * Valor robusto = moda recente ou último mês deduplicado (sem média).
 */
final class DespesaCondominioAgrupador {

    private static final int MESES_MODA_RECENTE = 6;
    private static final int GAP_MESES_EXPANSAO = 4;

    private DespesaCondominioAgrupador() {}

    record SerieItem(String mes, BigDecimal valor, String grafia) {}

    record FluxoDebitos(
            String obrigacaoChave,
            String condominioChave,
            String condominioRotulo,
            List<LancamentoFinanceiroEntity> debitos,
            List<String> grafias,
            List<SerieItem> serie,
            BigDecimal valorEstimado,
            int diaTipico,
            boolean imovelUnico,
            Long imovelId,
            List<ImovelEntity> imoveisCandidatos) {}

    static List<FluxoDebitos> agrupar(
            List<LancamentoFinanceiroEntity> todosDebitos,
            List<ImovelEntity> imoveisAtivos,
            Map<String, List<ImovelEntity>> imoveisPorCondominio,
            java.util.function.Function<String, String> chaveCondominioFn,
            java.util.function.Function<String, String> normalizarFn) {

        List<LancamentoFinanceiroEntity> recorrentes = filtrarRecorrentesIndividuais(todosDebitos);
        Map<String, List<LancamentoFinanceiroEntity>> porGrafia = indexarPorGrafia(recorrentes);

        List<FluxoDebitos> fluxos = new ArrayList<>();
        Set<Long> debitosUsados = new LinkedHashSet<>();

        for (Map.Entry<String, List<ImovelEntity>> entry : imoveisPorCondominio.entrySet()) {
            String chave = entry.getKey();
            List<ImovelEntity> unidades = entry.getValue();
            List<LancamentoFinanceiroEntity> explicitos = recorrentes.stream()
                    .filter(l -> !debitosUsados.contains(l.getId()))
                    .filter(l -> textoDebito(l, normalizarFn).contains(chave))
                    .toList();

            if (explicitos.isEmpty()) {
                continue;
            }

            if (unidades.size() == 1) {
                ImovelEntity imovel = unidades.get(0);
                List<LancamentoFinanceiroEntity> merged = new ArrayList<>(explicitos);
                debitosUsados.addAll(merged.stream().map(LancamentoFinanceiroEntity::getId).toList());
                expandirGrafiasContiguas(merged, debitosUsados, recorrentes, porGrafia, chave, imoveisPorCondominio, normalizarFn);
                fluxos.add(montarFluxoImovelUnico(imovel, chave, merged, normalizarFn));
            } else {
                List<LancamentoFinanceiroEntity> predio =
                        new ArrayList<>(explicitos);
                debitosUsados.addAll(predio.stream().map(LancamentoFinanceiroEntity::getId).toList());
                fluxos.addAll(montarFluxosPredioCompartilhado(chave, predio, unidades, normalizarFn));
            }
        }

        return fluxos;
    }

    private static List<LancamentoFinanceiroEntity> filtrarRecorrentesIndividuais(
            List<LancamentoFinanceiroEntity> debitos) {
        Map<String, List<LancamentoFinanceiroEntity>> bruto = new LinkedHashMap<>();
        for (LancamentoFinanceiroEntity l : debitos) {
            String g = grafia(l);
            if (g.isBlank()) {
                continue;
            }
            bruto.computeIfAbsent(g, k -> new ArrayList<>()).add(l);
        }
        List<LancamentoFinanceiroEntity> out = new ArrayList<>();
        for (List<LancamentoFinanceiroEntity> lista : bruto.values()) {
            long meses = lista.stream()
                    .map(LancamentoFinanceiroEntity::getDataLancamento)
                    .filter(Objects::nonNull)
                    .map(YearMonth::from)
                    .distinct()
                    .count();
            if (lista.size() >= 2 && meses >= 2) {
                out.addAll(lista);
            }
        }
        return out;
    }

    private static Map<String, List<LancamentoFinanceiroEntity>> indexarPorGrafia(
            List<LancamentoFinanceiroEntity> recorrentes) {
        Map<String, List<LancamentoFinanceiroEntity>> mapa = new LinkedHashMap<>();
        for (LancamentoFinanceiroEntity l : recorrentes) {
            mapa.computeIfAbsent(grafia(l), k -> new ArrayList<>()).add(l);
        }
        return mapa;
    }

    private static void expandirGrafiasContiguas(
            List<LancamentoFinanceiroEntity> merged,
            Set<Long> debitosUsados,
            List<LancamentoFinanceiroEntity> recorrentes,
            Map<String, List<LancamentoFinanceiroEntity>> porGrafia,
            String chaveCondominio,
            Map<String, List<ImovelEntity>> imoveisPorCondominio,
            java.util.function.Function<String, String> normalizarFn) {

        boolean changed = true;
        while (changed) {
            changed = false;
            Set<YearMonth> meses = mesesDe(merged);
            if (meses.isEmpty()) {
                return;
            }
            YearMonth min = meses.stream().min(Comparator.naturalOrder()).orElseThrow();
            YearMonth max = meses.stream().max(Comparator.naturalOrder()).orElseThrow();
            YearMonth limiteMin = min.minusMonths(GAP_MESES_EXPANSAO);
            YearMonth limiteMax = max.plusMonths(GAP_MESES_EXPANSAO);

            for (Map.Entry<String, List<LancamentoFinanceiroEntity>> e : porGrafia.entrySet()) {
                List<LancamentoFinanceiroEntity> candidatos = e.getValue().stream()
                        .filter(l -> !debitosUsados.contains(l.getId()))
                        .toList();
                if (candidatos.isEmpty()) {
                    continue;
                }
                if (candidatos.stream().anyMatch(l -> textoDebito(l, normalizarFn).contains(chaveCondominio))) {
                    continue;
                }
                if (candidatos.stream()
                        .anyMatch(l -> matchesOutroCondominio(l, chaveCondominio, imoveisPorCondominio, normalizarFn))) {
                    continue;
                }
                boolean cabe = candidatos.stream()
                        .map(LancamentoFinanceiroEntity::getDataLancamento)
                        .filter(Objects::nonNull)
                        .map(YearMonth::from)
                        .allMatch(ym -> !ym.isBefore(limiteMin) && !ym.isAfter(limiteMax));
                if (!cabe) {
                    continue;
                }
                boolean conflito = candidatos.stream()
                        .map(LancamentoFinanceiroEntity::getDataLancamento)
                        .filter(Objects::nonNull)
                        .map(YearMonth::from)
                        .anyMatch(meses::contains);
                if (conflito) {
                    continue;
                }
                merged.addAll(candidatos);
                debitosUsados.addAll(candidatos.stream().map(LancamentoFinanceiroEntity::getId).toList());
                changed = true;
            }
        }
    }

    private static boolean matchesOutroCondominio(
            LancamentoFinanceiroEntity l,
            String chaveAtual,
            Map<String, List<ImovelEntity>> imoveisPorCondominio,
            java.util.function.Function<String, String> normalizarFn) {
        String texto = textoDebito(l, normalizarFn);
        for (String outra : imoveisPorCondominio.keySet()) {
            if (outra.equals(chaveAtual)) {
                continue;
            }
            if (texto.contains(outra)) {
                return true;
            }
        }
        return false;
    }

    private static FluxoDebitos montarFluxoImovelUnico(
            ImovelEntity imovel,
            String chave,
            List<LancamentoFinanceiroEntity> debitos,
            java.util.function.Function<String, String> normalizarFn) {
        List<String> grafias = debitos.stream()
                .map(DespesaCondominioAgrupador::grafia)
                .distinct()
                .sorted()
                .toList();
        List<SerieItem> serie = montarSerie(debitos);
        return new FluxoDebitos(
                "imovel:" + imovel.getId(),
                chave,
                imovel.getCondominio(),
                debitos,
                grafias,
                serie,
                valorEstimadoRobusto(serie),
                modaDia(debitos),
                true,
                imovel.getId(),
                List.of());
    }

    private static List<FluxoDebitos> montarFluxosPredioCompartilhado(
            String chave,
            List<LancamentoFinanceiroEntity> debitos,
            List<ImovelEntity> unidades,
            java.util.function.Function<String, String> normalizarFn) {

        Map<String, List<LancamentoFinanceiroEntity>> porValorDia = new LinkedHashMap<>();
        for (LancamentoFinanceiroEntity l : debitos) {
            if (l.getValor() == null || l.getDataLancamento() == null) {
                continue;
            }
            String cluster = l.getValor().setScale(2, RoundingMode.HALF_UP) + "|" + l.getDataLancamento().getDayOfMonth();
            porValorDia.computeIfAbsent(cluster, k -> new ArrayList<>()).add(l);
        }

        List<FluxoDebitos> fluxos = new ArrayList<>();
        int idx = 0;
        for (List<LancamentoFinanceiroEntity> cluster : porValorDia.values()) {
            long meses = cluster.stream()
                    .map(LancamentoFinanceiroEntity::getDataLancamento)
                    .filter(Objects::nonNull)
                    .map(YearMonth::from)
                    .distinct()
                    .count();
            if (cluster.size() < 2 || meses < 2) {
                continue;
            }
            List<String> grafias = cluster.stream().map(DespesaCondominioAgrupador::grafia).distinct().sorted().toList();
            List<SerieItem> serie = montarSerie(cluster);
            BigDecimal valor = valorEstimadoRobusto(serie);
            String rotulo = unidades.isEmpty() ? chave : unidades.get(0).getCondominio();
            fluxos.add(new FluxoDebitos(
                    "condominio:" + chave + ":fluxo:" + idx++,
                    chave,
                    rotulo,
                    cluster,
                    grafias,
                    serie,
                    valor,
                    modaDia(cluster),
                    false,
                    null,
                    unidades));
        }
        return fluxos;
    }

    static List<SerieItem> montarSerie(List<LancamentoFinanceiroEntity> debitos) {
        Map<YearMonth, LancamentoFinanceiroEntity> porMes = new HashMap<>();
        for (LancamentoFinanceiroEntity l : debitos) {
            if (l.getDataLancamento() == null || l.getValor() == null) {
                continue;
            }
            YearMonth ym = YearMonth.from(l.getDataLancamento());
            LancamentoFinanceiroEntity existente = porMes.get(ym);
            if (existente == null || l.getDataLancamento().isAfter(existente.getDataLancamento())) {
                porMes.put(ym, l);
            }
        }
        return porMes.entrySet().stream()
                .sorted(Map.Entry.comparingByKey())
                .map(e -> new SerieItem(
                        e.getKey().toString(),
                        e.getValue().getValor(),
                        grafia(e.getValue())))
                .toList();
    }

    static BigDecimal valorEstimadoRobusto(List<SerieItem> serie) {
        if (serie.isEmpty()) {
            return null;
        }
        List<SerieItem> recentes = serie.size() <= MESES_MODA_RECENTE
                ? serie
                : serie.subList(serie.size() - MESES_MODA_RECENTE, serie.size());

        Map<BigDecimal, Long> freq = recentes.stream()
                .collect(Collectors.groupingBy(SerieItem::valor, Collectors.counting()));
        BigDecimal moda = freq.entrySet().stream()
                .max(Map.Entry.<BigDecimal, Long>comparingByValue()
                        .thenComparing(e -> recentes.stream()
                                .filter(s -> s.valor().compareTo(e.getKey()) == 0)
                                .map(SerieItem::mes)
                                .max(String::compareTo)
                                .orElse("")))
                .map(Map.Entry::getKey)
                .orElse(recentes.get(recentes.size() - 1).valor());

        SerieItem ultimo = serie.get(serie.size() - 1);
        if (ultimo.valor().compareTo(moda) == 0) {
            return ultimo.valor().setScale(2, RoundingMode.HALF_UP);
        }
        return ultimo.valor().setScale(2, RoundingMode.HALF_UP);
    }

    private static Set<YearMonth> mesesDe(List<LancamentoFinanceiroEntity> debitos) {
        return debitos.stream()
                .map(LancamentoFinanceiroEntity::getDataLancamento)
                .filter(Objects::nonNull)
                .map(YearMonth::from)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private static int modaDia(List<LancamentoFinanceiroEntity> lista) {
        Map<Integer, Long> freq = new HashMap<>();
        for (LancamentoFinanceiroEntity l : lista) {
            if (l.getDataLancamento() == null) {
                continue;
            }
            freq.merge(l.getDataLancamento().getDayOfMonth(), 1L, Long::sum);
        }
        return freq.entrySet().stream()
                .max(Map.Entry.<Integer, Long>comparingByValue().thenComparing(Map.Entry::getKey))
                .map(Map.Entry::getKey)
                .orElse(10);
    }

    private static String grafia(LancamentoFinanceiroEntity l) {
        if (l == null) {
            return "";
        }
        if (l.getDescricaoNorm() != null && !l.getDescricaoNorm().isBlank()) {
            return l.getDescricaoNorm().trim();
        }
        return DescricaoNormalizer.normalizar(l.getDescricao());
    }

    private static String textoDebito(
            LancamentoFinanceiroEntity l, java.util.function.Function<String, String> normalizarFn) {
        StringBuilder sb = new StringBuilder();
        if (l.getDescricao() != null) {
            sb.append(l.getDescricao()).append(' ');
        }
        if (l.getDescricaoDetalhada() != null) {
            sb.append(l.getDescricaoDetalhada());
        }
        String n = normalizarFn.apply(sb.toString());
        return n != null ? n : "";
    }
}
