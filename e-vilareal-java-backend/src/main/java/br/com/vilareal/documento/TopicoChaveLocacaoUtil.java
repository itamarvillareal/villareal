package br.com.vilareal.documento;

import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoRepository;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/** Resolve {@code chave_navegacao} dos modelos legados CONTRATOS=LOCAÇÃO=… */
final class TopicoChaveLocacaoUtil {

    private static final String PREFIXO = "CONTRATOS=LOCAÇÃO=";

    private TopicoChaveLocacaoUtil() {}

    static String montarChave(String variante) {
        if (!StringUtils.hasText(variante)) {
            return PREFIXO.trim();
        }
        return PREFIXO + variante.trim();
    }

    static Optional<String> resolverChaveExistente(TopicoRepository repository, String variante) {
        if (!StringUtils.hasText(variante)) {
            return Optional.empty();
        }
        String candidata = montarChave(variante);
        if (!repository.findByChaveNavegacaoAndAtivoTrueOrderByBlocoIndiceAsc(candidata).isEmpty()) {
            return Optional.of(candidata);
        }
        String normVariante = normalizarComparacao(variante.trim());
        List<TopicoEntity> porFiltro = repository.findByFiltroSubcategoriaOuChave(variante.trim());
        return porFiltro.stream()
                .map(TopicoEntity::getChaveNavegacao)
                .filter(StringUtils::hasText)
                .filter(ch -> ch.toUpperCase(Locale.ROOT).contains("LOCA"))
                .filter(ch -> normalizarComparacao(ch).endsWith(normVariante)
                        || normalizarComparacao(sufixoAposLocacao(ch)).equals(normVariante))
                .findFirst();
    }

    private static String sufixoAposLocacao(String chave) {
        int idx = normalizarComparacao(chave).lastIndexOf(normalizarComparacao("LOCAÇÃO="));
        if (idx < 0) {
            return chave;
        }
        return chave.substring(idx + "LOCAÇÃO=".length());
    }

    static String normalizarComparacao(String texto) {
        if (texto == null) {
            return "";
        }
        return Normalizer.normalize(texto, Normalizer.Form.NFC)
                .replace('\u00A0', ' ')
                .trim()
                .toUpperCase(Locale.ROOT);
    }
}
