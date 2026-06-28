package br.com.vilareal.projudi;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Catálogo fixo de assuntos PROJUDI conhecidos e regras de sugestão por natureza da ação.
 */
@Service
public class ProjudiAssuntoCatalogoService {

    public record AssuntoItem(int idAssunto, String rotuloCompleto) {}

    public record AssuntoSugeridoResponse(Integer idAssuntoSugerido) {}

    private static final List<AssuntoItem> CATALOGO = List.of(
            new AssuntoItem(
                    451,
                    "DIREITO CIVIL > Obrigações > Espécies de Títulos de Crédito > Nota Promissória"),
            new AssuntoItem(
                    985,
                    "DIREITO DO CONSUMIDOR > Responsabilidade do Fornecedor > Indenização por Dano Material"));

    /** natureza normalizada (contém) → idAssunto sugerido. Ordem importa (primeira regra que casar). */
    private static final List<Map.Entry<String, Integer>> REGRAS_SUGESTAO = List.of(
            Map.entry("COBRANCA", 451));

    public List<AssuntoItem> listarCatalogo() {
        return CATALOGO;
    }

    public AssuntoSugeridoResponse sugerir(String naturezaAcao) {
        return new AssuntoSugeridoResponse(sugerirIdAssunto(naturezaAcao));
    }

    public Integer sugerirIdAssunto(String naturezaAcao) {
        String norm = normalizarNaturezaAcao(naturezaAcao);
        if (!StringUtils.hasText(norm)) {
            return null;
        }
        for (Map.Entry<String, Integer> regra : REGRAS_SUGESTAO) {
            if (norm.contains(regra.getKey())) {
                return regra.getValue();
            }
        }
        return null;
    }

    static String normalizarNaturezaAcao(String naturezaAcao) {
        if (!StringUtils.hasText(naturezaAcao)) {
            return "";
        }
        String upper = naturezaAcao.trim().toUpperCase(Locale.ROOT);
        return Normalizer.normalize(upper, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    }
}
