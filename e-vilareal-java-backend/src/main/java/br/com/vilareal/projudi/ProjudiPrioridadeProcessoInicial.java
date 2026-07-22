package br.com.vilareal.projudi;

/** Prioridade processual enviada ao PROJUDI no Passo 1. */
public record ProjudiPrioridadeProcessoInicial(String rotulo, int idProcessoPrioridade) {

    public static final ProjudiPrioridadeProcessoInicial NORMAL =
            new ProjudiPrioridadeProcessoInicial("Normal", 1);

    /** Fallback quando o id não vem do HTML/catálogo — {@code 2} na Vara Cível de Anápolis (não {@code 6}). */
    public static final ProjudiPrioridadeProcessoInicial MAIOR_60_ANOS =
            new ProjudiPrioridadeProcessoInicial("Maior de 60 Anos", 2);

    public static ProjudiPrioridadeProcessoInicial deAutorMaiorDe60Anos(boolean maiorDe60Anos) {
        return deAutorMaiorDe60Anos(maiorDe60Anos, null);
    }

    /**
     * Quando {@code idProcessoPrioridadeMaior60} vem do HTML do PROJUDI, evita enviar id fixo incorreto
     * (ex.: {@code 6} = «Réu Preso» na Vara Cível, não «Maior de 60 Anos»).
     */
    public static ProjudiPrioridadeProcessoInicial deAutorMaiorDe60Anos(
            boolean maiorDe60Anos, Integer idProcessoPrioridadeMaior60) {
        if (!maiorDe60Anos) {
            return NORMAL;
        }
        if (idProcessoPrioridadeMaior60 != null && idProcessoPrioridadeMaior60 > 0) {
            return new ProjudiPrioridadeProcessoInicial(MAIOR_60_ANOS.rotulo(), idProcessoPrioridadeMaior60);
        }
        return MAIOR_60_ANOS;
    }
}
