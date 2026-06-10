package br.com.vilareal.documento;

import java.util.List;

/**
 * Gênero e número de concordância de um polo processual (autores ou réus), derivados dos gêneros
 * das pessoas que o compõem. Utilitário puro: quem descobre o gênero de cada pessoa é a fase de
 * integração; aqui só se aplica a regra jurídica de concordância.
 */
public record PoloFlexao(FlexaoUtil.Genero genero, FlexaoUtil.Numero numero) {

    /**
     * Regra jurídica de concordância de um polo (autores ou réus):
     * <ul>
     *   <li>0 pessoas → (MASCULINO, SINGULAR) [fallback defensivo]</li>
     *   <li>1 pessoa → (gênero dela, SINGULAR)</li>
     *   <li>N do mesmo gênero → (aquele gênero, PLURAL)</li>
     *   <li>N de gêneros mistos → (MASCULINO, PLURAL)</li>
     * </ul>
     */
    public static PoloFlexao determinar(List<FlexaoUtil.Genero> generos) {
        if (generos == null || generos.isEmpty()) {
            return new PoloFlexao(FlexaoUtil.Genero.MASCULINO, FlexaoUtil.Numero.SINGULAR);
        }
        if (generos.size() == 1) {
            FlexaoUtil.Genero g = generos.get(0) != null ? generos.get(0) : FlexaoUtil.Genero.MASCULINO;
            return new PoloFlexao(g, FlexaoUtil.Numero.SINGULAR);
        }
        boolean todasFemininas = generos.stream().allMatch(g -> g == FlexaoUtil.Genero.FEMININO);
        FlexaoUtil.Genero genero = todasFemininas ? FlexaoUtil.Genero.FEMININO : FlexaoUtil.Genero.MASCULINO;
        return new PoloFlexao(genero, FlexaoUtil.Numero.PLURAL);
    }
}
