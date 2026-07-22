package br.com.vilareal.projudi;

import java.util.Map;
import java.util.Optional;

/**
 * Mapeamento confirmado de {@code Id_ProcessoPrioridade} por {@code Id_AreaDistribuicao}.
 *
 * <p>O id {@code 6} do rascunho manual (.projudi) na Vara Cível corresponde a «Réu Preso», não a
 * «Maior de 60 Anos». O PROJUDI não expõe o {@code <select>} de prioridade nas respostas HTTP do
 * wizard — o catálogo abaixo é o fallback quando o parsing HTML falha.
 */
final class ProjudiPrioridadeAreaCatalogo {

    /** {@code Id_AreaDistribuicao} → {@code Id_ProcessoPrioridade} de «Maior de 60 Anos». */
    private static final Map<Integer, Integer> MAIOR_60_POR_AREA = Map.of(
            735, 2 // Anápolis - Cível (Vara Cível Comum)
            );

    private ProjudiPrioridadeAreaCatalogo() {}

    static Optional<Integer> idMaiorDe60Anos(int idAreaDistribuicao) {
        return Optional.ofNullable(MAIOR_60_POR_AREA.get(idAreaDistribuicao));
    }
}
