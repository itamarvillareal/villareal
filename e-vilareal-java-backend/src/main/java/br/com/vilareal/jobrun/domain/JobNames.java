package br.com.vilareal.jobrun.domain;

import java.util.List;

/** Identificadores estáveis dos jobs monitorados. */
public final class JobNames {

    public static final String GMAIL_PROJUDI = "buscar_emails_projudi";
    public static final String GMAIL_PROJUDI_COMPLETO = "atualizar_emails_projudi";
    public static final String GMAIL_PUBLICACOES = "buscar_emails_publicacoes";
    public static final String GMAIL_TRT = "buscar_emails_trt";
    public static final String PIPELINE_PROJUDI = "pipeline_projudi_movimentacoes";
    public static final String PAGAMENTO_ROTINA_DIARIA = "pagamento_rotina_diaria";
    public static final String PAGAMENTO_RECORRENCIA = "pagamento_recorrencia";
    public static final String IPTU_ROTINA_DIARIA = "iptu_rotina_diaria";
    public static final String FINANCEIRO_FECHAMENTO_FATURA_CARTAO = "financeiro_fechamento_fatura_cartao";
    public static final String WHATSAPP_AGENDAMENTOS = "whatsapp_agendamentos";
    public static final String WHATSAPP_LEMBRETE_AUDIENCIA = "whatsapp_lembrete_audiencia";
    public static final String WHATSAPP_REFORCO_AUDIENCIA = "whatsapp_reforco_audiencia";

    public static final List<String> TODOS_MONITORADOS = List.of(
            GMAIL_PROJUDI,
            GMAIL_PROJUDI_COMPLETO,
            GMAIL_PUBLICACOES,
            GMAIL_TRT,
            PIPELINE_PROJUDI,
            PAGAMENTO_ROTINA_DIARIA,
            PAGAMENTO_RECORRENCIA,
            IPTU_ROTINA_DIARIA,
            FINANCEIRO_FECHAMENTO_FATURA_CARTAO,
            WHATSAPP_AGENDAMENTOS,
            WHATSAPP_LEMBRETE_AUDIENCIA,
            WHATSAPP_REFORCO_AUDIENCIA);

    private JobNames() {}
}
