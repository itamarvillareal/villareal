package br.com.vilareal.importacao;

import org.springframework.util.StringUtils;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Alinha texto da coluna M da planilha às strings canônicas de {@code FASES} no frontend
 * ({@code e-vilareal-react-web/src/data/processosDadosRelatorio.js}).
 */
public final class FasePlanilhaNormalizer {

    /** Ordem idêntica ao array {@code FASES} no React. */
    public static final List<String> FASES_CANONICAS = List.of(
            "Ag. Documentos",
            "Ag. Peticionar",
            "Ag. Verificação",
            "Protocolo / Movimentação",
            "Aguardando Providência",
            "Procedimento Adm.",
            "Em Andamento");

    private static final Map<String, String> NORMALIZADA_PARA_CANONICA = new LinkedHashMap<>();

    static {
        for (String c : FASES_CANONICAS) {
            NORMALIZADA_PARA_CANONICA.put(normalizarChave(c), c);
        }
        // Sinónimos comuns (extensível)
        sin("aguardando documentos", "Ag. Documentos");
        sin("ag documentos", "Ag. Documentos");
        sin("ag. documentos", "Ag. Documentos");
        sin("aguardando peticionar", "Ag. Peticionar");
        sin("ag peticionar", "Ag. Peticionar");
        sin("aguardando verificação", "Ag. Verificação");
        sin("ag verificacao", "Ag. Verificação");
        sin("ag verificação", "Ag. Verificação");
        sin("protocolo", "Protocolo / Movimentação");
        sin("protocolo / movimentacao", "Protocolo / Movimentação");
        sin("movimentação", "Protocolo / Movimentação");
        sin("aguardando providencia", "Aguardando Providência");
        sin("aguardando providência", "Aguardando Providência");
        sin("procedimento adm", "Procedimento Adm.");
        sin("procedimento administrativo", "Procedimento Adm.");
        sin("em andamento", "Em Andamento");
    }

    private static void sin(String alias, String canonica) {
        NORMALIZADA_PARA_CANONICA.put(normalizarChave(alias), canonica);
    }

    private FasePlanilhaNormalizer() {}

    /**
     * @param textoCelula valor bruto da coluna M (pode ser null)
     * @return fase canónica ou empty se célula vazia
     * @throws IllegalArgumentException se preenchido e não reconhecido
     */
    public static Optional<String> normalizarOuVazio(String textoCelula) {
        if (!StringUtils.hasText(textoCelula)) {
            return Optional.empty();
        }
        String compacto = textoCelula.trim().replaceAll("\\s+", " ");
        String chave = normalizarChave(compacto);
        String canon = NORMALIZADA_PARA_CANONICA.get(chave);
        if (canon != null) {
            return Optional.of(canon);
        }
        throw new IllegalArgumentException(
                "Fase não reconhecida (coluna M): \"" + compacto + "\". Use um dos valores: " + FASES_CANONICAS);
    }

    private static String normalizarChave(String s) {
        if (s == null) {
            return "";
        }
        String t = s.trim().toLowerCase(Locale.ROOT);
        t = java.text.Normalizer.normalize(t, java.text.Normalizer.Form.NFD);
        return t.replaceAll("\\p{M}+", "").replaceAll("\\s+", " ");
    }
}
