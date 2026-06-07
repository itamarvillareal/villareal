package br.com.vilareal.agendamento.application;

import java.util.List;

/** Colunas fixas do CSV de backup/restore de consultas periódicas (ordem obrigatória). */
public final class ConsultaPeriodicaBackupCsv {

    public static final char DELIMITADOR = ';';

    public static final String[] HEADER = {
        "numero_cnj",
        "cliente",
        "consulta_periodica_habilitada",
        "tipo_cadencia",
        "intervalo_minutos",
        "horarios_fixos",
        "periodo",
        "periodo_horario",
        "janela_inicio",
        "janela_fim",
        "apenas_dias_uteis",
        "considerar_feriados",
        "prioridade",
        "motivo",
        "valido_ate",
        "ativo",
        "destinatarios_adicionais"
    };

    public static final List<String> HEADER_LIST = List.of(HEADER);

    private ConsultaPeriodicaBackupCsv() {}
}
