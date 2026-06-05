package br.com.vilareal.agendamento.application;

import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.agendamento.infrastructure.persistence.entity.AgendamentoConsultaEntity;

import java.time.LocalDateTime;

/**
 * Regras pós-execução do monitor agendado (passo 4.1): sucesso → cadência; falha → backoff curto.
 */
public final class AgendamentoConsultaReagendamento {

    private AgendamentoConsultaReagendamento() {}

    public static boolean isStatusSucesso(StatusExecucao status) {
        return status == StatusExecucao.SUCESSO_COM_NOVIDADE || status == StatusExecucao.SUCESSO_SEM_NOVIDADE;
    }

    public static void aplicarSucesso(AgendamentoConsultaEntity agendamento, LocalDateTime agora) {
        agendamento.setUltimaExecucao(agora);
        agendamento.setProximaExecucao(AgendamentoProximaExecucaoCalculo.calcularProximaAposSucesso(agendamento, agora));
        agendamento.setFalhasConsecutivas(0);
        agendamento.setUltimoErro(null);
        agendamento.setUltimaFalhaEm(null);
    }

    public static void aplicarFalha(
            AgendamentoConsultaEntity agendamento,
            LocalDateTime agora,
            String mensagemErro,
            int retryBaseMin,
            int retryMaxMin) {
        int falhasAtuais = agendamento.getFalhasConsecutivas() != null ? agendamento.getFalhasConsecutivas() : 0;
        int falhas = falhasAtuais + 1;
        agendamento.setUltimaExecucao(agora);
        agendamento.setFalhasConsecutivas(falhas);
        agendamento.setUltimoErro(mensagemErro);
        agendamento.setUltimaFalhaEm(agora);
        agendamento.setProximaExecucao(calcularProximaRetry(agora, falhas, retryBaseMin, retryMaxMin));
    }

    /**
     * {@code agora + min(retryBaseMin * falhasConsecutivas, retryMaxMin)}.
     */
    public static LocalDateTime calcularProximaRetry(
            LocalDateTime agora, int falhasConsecutivas, int retryBaseMin, int retryMaxMin) {
        int base = Math.max(1, retryBaseMin);
        int teto = Math.max(base, retryMaxMin);
        int falhas = Math.max(1, falhasConsecutivas);
        int minutos = Math.min(base * falhas, teto);
        return agora.plusMinutes(minutos);
    }
}
