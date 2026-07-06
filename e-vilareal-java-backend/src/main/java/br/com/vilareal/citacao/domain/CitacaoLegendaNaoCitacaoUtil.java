package br.com.vilareal.citacao.domain;

import br.com.vilareal.pessoa.domain.EnderecoDedupUtil;
import org.springframework.util.StringUtils;

/**
 * Detecta legendas PROJUDI que indicam retorno infrutífero de citação/diligência.
 * Calibrado com textos reais de {@code movimentacao_monitorada.legenda} (TJGO).
 */
public final class CitacaoLegendaNaoCitacaoUtil {

    /**
     * Padrões no <strong>prefixo</strong> da legenda (antes do primeiro {@code " - "}).
     * Evita falso positivo em intimações que apenas referenciam mov. anterior.
     */
    public static final String[] PADROES_NAO_CITACAO = {
        "citacao nao efetivada",
        "citacao frustrada",
        "mandado nao cumprido",
        "retorno de ar nao efetivado",
        "ar nao efetivado",
        "diligencia negativa",
        "ar negativo",
        "aviso de recebimento negativo",
        "carta devolvida",
        "correspondencia devolvida",
        "nao localizado",
        "nao encontrado",
        "endereco insuficiente",
        "endereco incorreto",
        "endereco nao localizado",
        "mudou-se",
        "mudou se",
        "desconhecido",
        "ausente",
        "nao procurado",
    };

    /** Tipos expedidos/positivos — não são retorno infrutífero. */
    private static final String[] EXCLUSOES_PREFIXO = {
        "citacao expedida",
        "mandado expedido",
        "certidao expedida",
        "intimacao efetivada",
        "intimacao expedida",
        "juntada",
        "juntada de documento",
    };

    private CitacaoLegendaNaoCitacaoUtil() {}

    public static boolean legendaIndicaRetornoInfrutifero(String legenda) {
        if (!StringUtils.hasText(legenda)) {
            return false;
        }
        String norm = EnderecoDedupUtil.normalizarTexto(legenda);
        String prefixo = extrairPrefixo(norm);

        for (String ex : EXCLUSOES_PREFIXO) {
            if (prefixo.contains(normalizarChave(ex))) {
                if (prefixo.contains(normalizarChave("certidao expedida"))) {
                    return corpoContemPadraoNegativo(extrairCorpo(norm));
                }
                return false;
            }
        }

        if (corpoContemPadraoNegativo(prefixo)) {
            return true;
        }
        return corpoContemPadraoNegativo(extrairCorpo(norm));
    }

    private static String extrairCorpo(String legendaNorm) {
        int idx = legendaNorm.indexOf(" - ");
        return idx >= 0 ? legendaNorm.substring(idx + 3).trim() : "";
    }

    private static boolean corpoContemPadraoNegativo(String texto) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        for (String padrao : PADROES_NAO_CITACAO) {
            if (texto.contains(normalizarChave(padrao))) {
                return true;
            }
        }
        return false;
    }

    private static String extrairPrefixo(String legendaNorm) {
        int idx = legendaNorm.indexOf(" - ");
        return idx >= 0 ? legendaNorm.substring(0, idx).trim() : legendaNorm.trim();
    }

    private static String normalizarChave(String s) {
        return EnderecoDedupUtil.normalizarTexto(s);
    }
}
