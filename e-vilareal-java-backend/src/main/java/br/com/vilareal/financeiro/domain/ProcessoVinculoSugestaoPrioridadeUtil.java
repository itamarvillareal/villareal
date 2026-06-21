package br.com.vilareal.financeiro.domain;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/** Prioriza processos com lançamentos classificados mais recentes (banco + cartão). */
public final class ProcessoVinculoSugestaoPrioridadeUtil {

    public static final int ANOS_ATIVIDADE_RECENTE = 3;

    private ProcessoVinculoSugestaoPrioridadeUtil() {}

    public record AtividadeProcesso(LocalDate ultimaData, long quantidade) {}

    public static Map<Long, AtividadeProcesso> indexarLinhasAtividade(List<Object[]> rows) {
        Map<Long, AtividadeProcesso> map = new HashMap<>();
        if (rows == null) {
            return map;
        }
        for (Object[] row : rows) {
            if (row == null || row.length < 1 || row[0] == null) {
                continue;
            }
            Long processoId = ((Number) row[0]).longValue();
            LocalDate ultima = row.length > 1 ? toLocalDate(row[1]) : null;
            long qtd = row.length > 2 && row[2] != null ? ((Number) row[2]).longValue() : 0L;
            map.merge(processoId, new AtividadeProcesso(ultima, qtd), ProcessoVinculoSugestaoPrioridadeUtil::unir);
        }
        return map;
    }

    public static Comparator<ProcessoEntity> comparadorProcessos(Map<Long, AtividadeProcesso> atividade) {
        return (a, b) -> compararProcessoIds(a != null ? a.getId() : null, b != null ? b.getId() : null, atividade, a, b);
    }

    public static Comparator<Long> comparadorProcessoIds(Map<Long, AtividadeProcesso> atividade) {
        return (idA, idB) -> compararProcessoIds(idA, idB, atividade, null, null);
    }

    public static boolean temAtividadeRecente(AtividadeProcesso atividade, LocalDate referencia, int anos) {
        if (atividade == null || atividade.ultimaData() == null || referencia == null || anos < 0) {
            return false;
        }
        return !atividade.ultimaData().isBefore(referencia.minusYears(anos));
    }

    public static ConfiancaSugestao confiancaPrincipalPessoaProcesso(
            AtividadeProcesso atividade, LocalDate referencia) {
        if (temAtividadeRecente(atividade, referencia, ANOS_ATIVIDADE_RECENTE)) {
            return ConfiancaSugestao.ALTA;
        }
        return ConfiancaSugestao.MEDIA;
    }

    public static String sufixoAtividadeRegra(AtividadeProcesso atividade) {
        if (atividade == null || atividade.ultimaData() == null) {
            return "";
        }
        return " · últ. lanç. " + atividade.ultimaData();
    }

    private static int compararProcessoIds(
            Long idA,
            Long idB,
            Map<Long, AtividadeProcesso> atividade,
            ProcessoEntity procA,
            ProcessoEntity procB) {
        AtividadeProcesso aa = idA != null && atividade != null ? atividade.get(idA) : null;
        AtividadeProcesso ab = idB != null && atividade != null ? atividade.get(idB) : null;
        int cmp = compararAtividadeDesc(aa, ab);
        if (cmp != 0) {
            return cmp;
        }
        cmp = Long.compare(quantidade(ab), quantidade(aa));
        if (cmp != 0) {
            return cmp;
        }
        cmp = Integer.compare(numeroInterno(procB), numeroInterno(procA));
        if (cmp != 0) {
            return cmp;
        }
        return Long.compare(idB != null ? idB : 0L, idA != null ? idA : 0L);
    }

    private static int compararAtividadeDesc(AtividadeProcesso aa, AtividadeProcesso ab) {
        LocalDate da = aa != null ? aa.ultimaData() : null;
        LocalDate db = ab != null ? ab.ultimaData() : null;
        if (da == null && db == null) {
            return 0;
        }
        if (da == null) {
            return 1;
        }
        if (db == null) {
            return -1;
        }
        return db.compareTo(da);
    }

    private static long quantidade(AtividadeProcesso a) {
        return a != null ? a.quantidade() : 0L;
    }

    private static int numeroInterno(ProcessoEntity proc) {
        return proc != null && proc.getNumeroInterno() != null ? proc.getNumeroInterno() : 0;
    }

    private static AtividadeProcesso unir(AtividadeProcesso a, AtividadeProcesso b) {
        LocalDate max = maxDate(a.ultimaData(), b.ultimaData());
        return new AtividadeProcesso(max, a.quantidade() + b.quantidade());
    }

    private static LocalDate maxDate(LocalDate a, LocalDate b) {
        if (a == null) {
            return b;
        }
        if (b == null) {
            return a;
        }
        return a.isAfter(b) ? a : b;
    }

    private static LocalDate toLocalDate(Object raw) {
        if (raw == null) {
            return null;
        }
        if (raw instanceof LocalDate d) {
            return d;
        }
        if (raw instanceof java.sql.Date d) {
            return d.toLocalDate();
        }
        if (raw instanceof java.util.Date d) {
            return new java.sql.Date(d.getTime()).toLocalDate();
        }
        String s = String.valueOf(raw).trim();
        if (!StringUtils.hasText(s)) {
            return null;
        }
        return LocalDate.parse(s.length() >= 10 ? s.substring(0, 10) : s);
    }
}
