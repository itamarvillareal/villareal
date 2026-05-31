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
final class ProjudiDriveProgressivoUtil {

    /** Extrai o número da movimentação só do prefixo do nome (compatível com nomes antigos e enriquecidos). */
    private static final Pattern PADRAO_NUMERO_ARQUIVO_DRIVE =
            Pattern.compile("^(\\d{1,4})\\s+Movimentação\\s+-\\s+Arquivo\\b", Pattern.CASE_INSENSITIVE);

    private ProjudiDriveProgressivoUtil() {}

    static List<ProjudiTeorService.MovimentacaoProjudi> filtrarComDocDesc(
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

    static Set<Integer> extrairNumerosArquivados(List<String> nomesArquivosDrive) {
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

    static SelecaoProgressiva selecionarMovimentacoes(
            List<ProjudiTeorService.MovimentacaoProjudi> comDocDesc,
            Set<Integer> arquivadas,
            int passoBackfill) {
        Set<Integer> arquivadasSeguras = arquivadas != null ? arquivadas : Set.of();
        int passo = passoBackfill > 0 ? passoBackfill : 10;

        List<ProjudiTeorService.MovimentacaoProjudi> novasTopo = new ArrayList<>();
        if (!arquivadasSeguras.isEmpty()) {
            int maxArquivado = Collections.max(arquivadasSeguras);
            for (ProjudiTeorService.MovimentacaoProjudi mov : comDocDesc) {
                int num = parseNumeroMov(mov.numero());
                if (!arquivadasSeguras.contains(num) && num > maxArquivado) {
                    novasTopo.add(mov);
                }
            }
        }

        List<ProjudiTeorService.MovimentacaoProjudi> candidatosBackfill = new ArrayList<>();
        if (arquivadasSeguras.isEmpty()) {
            for (ProjudiTeorService.MovimentacaoProjudi mov : comDocDesc) {
                int num = parseNumeroMov(mov.numero());
                if (!arquivadasSeguras.contains(num)) {
                    candidatosBackfill.add(mov);
                }
            }
        } else {
            int minArquivado = Collections.min(arquivadasSeguras);
            for (ProjudiTeorService.MovimentacaoProjudi mov : comDocDesc) {
                int num = parseNumeroMov(mov.numero());
                if (!arquivadasSeguras.contains(num) && num < minArquivado) {
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
            int num = parseNumeroMov(mov.numero());
            if (arquivadasSeguras.contains(num) || !vistos.add(num)) {
                continue;
            }
            baixar.add(mov);
        }
        for (ProjudiTeorService.MovimentacaoProjudi mov : backfill) {
            int num = parseNumeroMov(mov.numero());
            if (arquivadasSeguras.contains(num) || !vistos.add(num)) {
                continue;
            }
            baixar.add(mov);
        }

        return new SelecaoProgressiva(
                List.copyOf(novasTopo),
                List.copyOf(backfill),
                List.copyOf(baixar),
                arquivadasSeguras.size(),
                minOuNull(arquivadasSeguras),
                maxOuNull(arquivadasSeguras));
    }

    static int contarJaArquivadasEmComDoc(
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

    record SelecaoProgressiva(
            List<ProjudiTeorService.MovimentacaoProjudi> novasTopo,
            List<ProjudiTeorService.MovimentacaoProjudi> backfill,
            List<ProjudiTeorService.MovimentacaoProjudi> baixar,
            int totalArquivadasDrive,
            Integer minArquivado,
            Integer maxArquivado) {

        String resumo() {
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
