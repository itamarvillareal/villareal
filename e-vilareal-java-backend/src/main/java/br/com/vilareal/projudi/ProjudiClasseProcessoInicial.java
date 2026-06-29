package br.com.vilareal.projudi;

/**
 * Classe processual enviada ao PROJUDI no Passo 1 (e replicada nos POSTs de estado do wizard).
 */
public record ProjudiClasseProcessoInicial(
        String id,
        String rotulo,
        int idProcessoTipo,
        int processoTipoCodigo,
        String processoTipoLabel) {

    public static final ProjudiClasseProcessoInicial JEC = new ProjudiClasseProcessoInicial(
            "JEC",
            "Procedimento do Juizado Especial Cível",
            162,
            1436,
            "PROCESSO CÍVEL E DO TRABALHO -> Processo de Conhecimento -> Procedimento de Conhecimento"
                    + " -> Procedimento do Juizado Especial Cível");

    public static final ProjudiClasseProcessoInicial EXECUCAO_TITULO_EXTRAJUDICIAL =
            new ProjudiClasseProcessoInicial(
                    "EXECUCAO_TITULO",
                    "Execução de Título Extrajudicial",
                    114,
                    1159,
                    "PROCESSO CÍVEL E DO TRABALHO -> Processo de Execução -> Execução de Título Extrajudicial");
}
