package br.com.vilareal.projudi;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Collections;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.stream.Collectors;

/** Seleção progressiva de movimentações a arquivar no Drive (modo somente Drive). */
public final class ProjudiDriveProgressivoUtil {

    /** Extrai o número da movimentação só do prefixo do nome (compatível com nomes antigos e enriquecidos). */
    private static final Pattern PADRAO_NUMERO_ARQUIVO_DRIVE =
            Pattern.compile("^(\\d{1,4})\\s+Movimentação\\s+-\\s+Arquivo\\b", Pattern.CASE_INSENSITIVE);

    private ProjudiDriveProgressivoUtil() {}

    public static List<ProjudiTeorService.MovimentacaoProjudi> filtrarComDocDesc(
            List<ProjudiTeorService.MovimentacaoProjudi> movimentacoes) {
        if (movimentacoes == null || movimentacoes.isEmpty()) {
            return List.of();
        }
        return movimentacoes.stream()
                .filter(m -> m.temDocumento() && StringUtils.hasText(m.idMovimentacaoArquivo()))
                .sorted(Comparator.comparingInt((ProjudiTeorService.MovimentacaoProjudi m) ->
                                parseNumeroMov(m.numero()))
                        .reversed())
                .toList();
    }

    public static Set<Integer> extrairNumerosArquivados(List<String> nomesArquivosDrive) {
        if (nomesArquivosDrive == null || nomesArquivosDrive.isEmpty()) {
            return Set.of();
        }
        Set<Integer> numeros = new LinkedHashSet<>();
        for (String nome : nomesArquivosDrive) {
            if (!StringUtils.hasText(nome)) {
                continue;
            }
            Matcher m = PADRAO_NUMERO_ARQUIVO_DRIVE.matcher(nome.trim());
            if (m.find()) {
                numeros.add(Integer.parseInt(m.group(1)));
            }
        }
        return numeros;
    }

    public static SelecaoProgressiva selecionarMovimentacoes(
            List<ProjudiTeorService.MovimentacaoProjudi> comDocDesc,
            Set<Integer> arquivadas,
            int passoBackfill) {
        Set<Integer> arquivadasSeguras = arquivadas != null ? arquivadas : Set.of();
        int passo = passoBackfill > 0 ? passoBackfill : 10;

        // Movimentações com documento ainda não arquivadas no Drive (comDocDesc já vem
        // ordenado por número decrescente — as mais novas primeiro). Considera somente
        // números válidos (>0); número não parseável não é rastreável por nome de arquivo.
        List<ProjudiTeorService.MovimentacaoProjudi> faltantes = new ArrayList<>();
        for (ProjudiTeorService.MovimentacaoProjudi mov : comDocDesc) {
            int num = parseNumeroMov(mov.numero());
            if (num > 0 && !arquivadasSeguras.contains(num)) {
                faltantes.add(mov);
            }
        }

        // Novas no topo (acima do maior já arquivado): baixadas integralmente.
        // Backfill: TODAS as faltantes restantes (inclusive lacunas no meio do intervalo
        // já arquivado, não só abaixo do menor), as mais novas primeiro, até o passo.
        List<ProjudiTeorService.MovimentacaoProjudi> novasTopo = new ArrayList<>();
        List<ProjudiTeorService.MovimentacaoProjudi> candidatosBackfill = new ArrayList<>();
        if (arquivadasSeguras.isEmpty()) {
            candidatosBackfill.addAll(faltantes);
        } else {
            int maxArquivado = Collections.max(arquivadasSeguras);
            for (ProjudiTeorService.MovimentacaoProjudi mov : faltantes) {
                if (parseNumeroMov(mov.numero()) > maxArquivado) {
                    novasTopo.add(mov);
                } else {
                    candidatosBackfill.add(mov);
                }
            }
        }

        List<ProjudiTeorService.MovimentacaoProjudi> backfill = candidatosBackfill.stream()
                .limit(passo)
                .toList();

        List<ProjudiTeorService.MovimentacaoProjudi> baixar = new ArrayList<>();
        LinkedHashSet<Integer> vistos = new LinkedHashSet<>();
        for (ProjudiTeorService.MovimentacaoProjudi mov : novasTopo) {
            if (vistos.add(parseNumeroMov(mov.numero()))) {
                baixar.add(mov);
            }
        }
        for (ProjudiTeorService.MovimentacaoProjudi mov : backfill) {
            if (vistos.add(parseNumeroMov(mov.numero()))) {
                baixar.add(mov);
            }
        }

        return new SelecaoProgressiva(
                List.copyOf(novasTopo),
                List.copyOf(backfill),
                List.copyOf(baixar),
                arquivadasSeguras.size(),
                minOuNull(arquivadasSeguras),
                maxOuNull(arquivadasSeguras));
    }

    public static int contarJaArquivadasEmComDoc(
            List<ProjudiTeorService.MovimentacaoProjudi> comDocDesc, Set<Integer> arquivadas) {
        if (comDocDesc.isEmpty() || arquivadas == null || arquivadas.isEmpty()) {
            return 0;
        }
        return (int) comDocDesc.stream()
                .map(m -> parseNumeroMov(m.numero()))
                .filter(arquivadas::contains)
                .distinct()
                .count();
    }

    /**
     * Quantas movimentações com documento (por número distinto, >0) ainda NÃO estão no Drive.
     *
     * <p>Decide a conclusão do arquivamento por <b>conjunto</b> (quais números faltam), não por
     * comparação de contagens — evita declarar "tudo arquivado" quando há lacunas mas o total
     * coincide.</p>
     */
    public static int contarFaltantesEmComDoc(
            List<ProjudiTeorService.MovimentacaoProjudi> comDocDesc, Set<Integer> arquivadas) {
        if (comDocDesc == null || comDocDesc.isEmpty()) {
            return 0;
        }
        Set<Integer> arquivadasSeguras = arquivadas != null ? arquivadas : Set.of();
        return (int) comDocDesc.stream()
                .map(m -> parseNumeroMov(m.numero()))
                .filter(n -> n > 0)
                .distinct()
                .filter(n -> !arquivadasSeguras.contains(n))
                .count();
    }

    static int parseNumeroMov(String numero) {
        if (!StringUtils.hasText(numero)) {
            return 0;
        }
        try {
            return Integer.parseInt(numero.trim());
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static Integer minOuNull(Set<Integer> valores) {
        return valores == null || valores.isEmpty() ? null : Collections.min(valores);
    }

    private static Integer maxOuNull(Set<Integer> valores) {
        return valores == null || valores.isEmpty() ? null : Collections.max(valores);
    }

    public record SelecaoProgressiva(
            List<ProjudiTeorService.MovimentacaoProjudi> novasTopo,
            List<ProjudiTeorService.MovimentacaoProjudi> backfill,
            List<ProjudiTeorService.MovimentacaoProjudi> baixar,
            int totalArquivadasDrive,
            Integer minArquivado,
            Integer maxArquivado) {

        public String resumo() {
            String numsBaixar = baixar.stream()
                    .map(m -> String.valueOf(parseNumeroMov(m.numero())))
                    .collect(Collectors.joining(", "));
            return String.format(
                    Locale.ROOT,
                    "arquivadasDrive=%d min=%s max=%s novasTopo=%d backfill=%d baixar=[%s]",
                    totalArquivadasDrive,
                    minArquivado,
                    maxArquivado,
                    novasTopo.size(),
                    backfill.size(),
                    numsBaixar);
        }
    }
}
