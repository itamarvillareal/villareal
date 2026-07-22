package br.com.vilareal.projudi;

/** Prioridade processual enviada ao PROJUDI no Passo 1. */
public record ProjudiPrioridadeProcessoInicial(String rotulo, int idProcessoPrioridade) {

    public static final ProjudiPrioridadeProcessoInicial NORMAL =
            new ProjudiPrioridadeProcessoInicial("Normal", 1);

    public static final ProjudiPrioridadeProcessoInicial MAIOR_60_ANOS =
            new ProjudiPrioridadeProcessoInicial("Maior de 60 Anos", 6);

    public static ProjudiPrioridadeProcessoInicial deAutorMaiorDe60Anos(boolean maiorDe60Anos) {
        return maiorDe60Anos ? MAIOR_60_ANOS : NORMAL;
    }
}
