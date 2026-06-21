package br.com.vilareal.financeiro.domain;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Sugere vínculo quando o nome de pessoa cadastrada (titular ou parte de processo)
 * aparece na descrição do lançamento — ignora valor e banco (baixa confiança).
 */
public final class SemelhanteEscritorioNomeMatcher {

    private SemelhanteEscritorioNomeMatcher() {}

    public record PessoaProcessoRef(Long pessoaId, String pessoaNome, Long clienteId, Long processoId) {}

    public static List<SemelhanteEscritorioMatcher.MatchResult> parear(
            List<SemelhanteEscritorioMatcher.PendenteItem> pendentes,
            List<PessoaProcessoRef> vinculos,
            Map<Long, String> nomesPorPessoaId) {
        return parear(pendentes, vinculos, nomesPorPessoaId, Map.of());
    }

    public static List<SemelhanteEscritorioMatcher.MatchResult> parear(
            List<SemelhanteEscritorioMatcher.PendenteItem> pendentes,
            List<PessoaProcessoRef> vinculos,
            Map<Long, String> nomesPorPessoaId,
            Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> atividadePorProcesso) {
        if (pendentes == null || pendentes.isEmpty() || vinculos == null || vinculos.isEmpty()) {
            return List.of();
        }

        List<SemelhanteEscritorioMatcher.MatchResult> out = new ArrayList<>();
        for (SemelhanteEscritorioMatcher.PendenteItem p : pendentes) {
            if (p == null || p.lancamentoId() == null) {
                continue;
            }
            String descNorm = FinanceiroDescricaoNomeUtil.normalizarTextoDescricao(p.descricao(), null);
            if (!StringUtils.hasText(descNorm)) {
                continue;
            }
            PessoaProcessoRef hit = escolherMelhor(descNorm, vinculos, nomesPorPessoaId, atividadePorProcesso);
            if (hit == null) {
                continue;
            }
            String nome = nomesPorPessoaId.getOrDefault(hit.pessoaId(), "");
            out.add(SemelhanteEscritorioMatcher.MatchResult.nomePessoa(
                    p,
                    hit.clienteId(),
                    hit.processoId(),
                    hit.pessoaId(),
                    resumirNome(nome)));
        }
        return out;
    }

    public static List<PessoaProcessoRef> refsFromQueryRows(
            List<Object[]> rows,
            Map<Long, String> nomesPorPessoaId,
            Map<Long, Long> clienteIdPorProcessoId) {
        List<PessoaProcessoRef> out = new ArrayList<>();
        Set<String> vistos = new LinkedHashSet<>();
        for (Object[] row : rows) {
            if (row == null || row.length < 2 || row[0] == null || row[1] == null) {
                continue;
            }
            Long pessoaId = ((Number) row[0]).longValue();
            Long processoId = ((Number) row[1]).longValue();
            String chave = pessoaId + "|" + processoId;
            if (!vistos.add(chave)) {
                continue;
            }
            String nome = nomesPorPessoaId.get(pessoaId);
            if (!StringUtils.hasText(nome)) {
                continue;
            }
            Long clienteId = clienteIdPorProcessoId.get(processoId);
            if (clienteId == null) {
                continue;
            }
            out.add(new PessoaProcessoRef(pessoaId, nome, clienteId, processoId));
        }
        return out;
    }

    public static Map<Long, String> indexarNomesPorPessoa(List<Object[]> rows, java.util.function.Function<Long, String> loader) {
        Map<Long, String> out = new LinkedHashMap<>();
        for (Object[] row : rows) {
            if (row == null || row[0] == null) {
                continue;
            }
            Long pessoaId = ((Number) row[0]).longValue();
            out.computeIfAbsent(pessoaId, loader);
        }
        return out;
    }

    private static PessoaProcessoRef escolherMelhor(
            String descNorm,
            List<PessoaProcessoRef> vinculos,
            Map<Long, String> nomesPorPessoaId,
            Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> atividadePorProcesso) {
        List<PessoaProcessoRef> candidatos = new ArrayList<>();
        for (PessoaProcessoRef ref : vinculos) {
            String nome = nomesPorPessoaId.get(ref.pessoaId());
            if (!StringUtils.hasText(nome)) {
                continue;
            }
            if (!FinanceiroDescricaoNomeUtil.nomesCompativeis(descNorm, nome)) {
                continue;
            }
            candidatos.add(ref);
        }
        if (candidatos.isEmpty()) {
            return null;
        }
        Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> atividade =
                atividadePorProcesso != null ? atividadePorProcesso : Map.of();
        candidatos.sort(
                (a, b) -> ProcessoVinculoSugestaoPrioridadeUtil.comparadorProcessoIds(atividade)
                        .compare(a.processoId(), b.processoId()));
        return candidatos.get(0);
    }

    private static String resumirNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        String t = nome.trim();
        return t.length() > 48 ? t.substring(0, 45) + "…" : t;
    }
}
