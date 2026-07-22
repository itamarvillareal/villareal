package br.com.vilareal.projudi;

import java.util.List;

/**
 * Classe processual enviada ao PROJUDI no Passo 1 (e replicada nos POSTs de estado do wizard).
 */
public record ProjudiClasseProcessoInicial(
        String id,
        String rotulo,
        int idProcessoTipo,
        int processoTipoCodigo,
        String processoTipoLabel,
        String areaDistribuicao,
        int idAreaDistribuicao,
        int forumCodigo,
        String processoPrioridade,
        int idProcessoPrioridade) {

    private static final String COMARCA_ANAPOLIS = "ANÁPOLIS";
    private static final int ID_COMARCA_ANAPOLIS = 2;

    public static final ProjudiClasseProcessoInicial JEC = new ProjudiClasseProcessoInicial(
            "JEC",
            "Procedimento do Juizado Especial Cível",
            162,
            1436,
            "PROCESSO CÍVEL E DO TRABALHO -> Processo de Conhecimento -> Procedimento de Conhecimento"
                    + " -> Procedimento do Juizado Especial Cível",
            "Anápolis - Juizados Especiais Cíveis",
            19,
            7,
            "Normal",
            1);

    public static final ProjudiClasseProcessoInicial EXECUCAO_TITULO_EXTRAJUDICIAL =
            new ProjudiClasseProcessoInicial(
                    "EXECUCAO_TITULO",
                    "Execução de Título Extrajudicial",
                    114,
                    1159,
                    "PROCESSO CÍVEL E DO TRABALHO -> Processo de Execução -> Execução de Título Extrajudicial",
                    JEC.areaDistribuicao(),
                    JEC.idAreaDistribuicao(),
                    JEC.forumCodigo(),
                    JEC.processoPrioridade(),
                    JEC.idProcessoPrioridade());

    /** Despejo por falta de pagamento — Vara Cível de Anápolis (prioridade maior de 60 anos). */
    public static final ProjudiClasseProcessoInicial DESPEJO_VARA_CIVEL = new ProjudiClasseProcessoInicial(
            "DESPEJO_VARA_CIVEL",
            "Despejo por Falta de Pagamento (Vara Cível)",
            109,
            1093,
            "PROCESSO CÍVEL E DO TRABALHO -> Processo de Conhecimento -> Procedimento de Conhecimento"
                    + " -> Procedimentos Especiais -> Procedimentos Regidos por Outros Códigos, Leis Esparsas e Regimentos"
                    + " -> Despejo por Falta de Pagamento",
            "Anápolis - Cível",
            735,
            3,
            "Maior de 60 Anos",
            6);

    private static final List<ProjudiClasseProcessoInicial> TODAS =
            List.of(JEC, EXECUCAO_TITULO_EXTRAJUDICIAL, DESPEJO_VARA_CIVEL);

    public String comarca() {
        return COMARCA_ANAPOLIS;
    }

    public int idComarca() {
        return ID_COMARCA_ANAPOLIS;
    }

    public static ProjudiClasseProcessoInicial porId(String classeId) {
        for (ProjudiClasseProcessoInicial classe : TODAS) {
            if (classe.id().equals(classeId)) {
                return classe;
            }
        }
        return JEC;
    }

    public static ProjudiClasseProcessoInicial porCodigos(int idProcessoTipo, int processoTipoCodigo) {
        for (ProjudiClasseProcessoInicial classe : TODAS) {
            if (classe.idProcessoTipo() == idProcessoTipo && classe.processoTipoCodigo() == processoTipoCodigo) {
                return classe;
            }
        }
        throw new IllegalArgumentException(
                "Classe PROJUDI desconhecida: Id_ProcessoTipo="
                        + idProcessoTipo
                        + " ProcessoTipoCodigo="
                        + processoTipoCodigo);
    }
}
