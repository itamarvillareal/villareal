package br.com.vilareal.monitoramento.domain;

/**
 * Rótulo de exibição de um processo descoberto, derivado SEMPRE no backend — a tela nunca
 * interpreta o enum {@link SituacaoProcessoDescoberto} cru (mudança de regra de rótulo não
 * pode exigir deploy do frontend).
 */
public final class RotuloProcessoDescoberto {

    public static final String ALERTA = "Alerta";
    public static final String NO_ACERVO = "No seu acervo";
    public static final String HISTORICO_NAO_CADASTRADO = "Histórico (não cadastrado)";
    public static final String IGNORADO = "Ignorado";

    private RotuloProcessoDescoberto() {}

    public static String derivar(SituacaoProcessoDescoberto situacao, boolean temProcessoNoAcervo) {
        return switch (situacao) {
            case NOVO -> ALERTA;
            case BASELINE -> temProcessoNoAcervo ? NO_ACERVO : HISTORICO_NAO_CADASTRADO;
            case VINCULADO -> NO_ACERVO;
            case IGNORADO -> IGNORADO;
        };
    }
}
