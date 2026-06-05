package br.com.vilareal.agendamento.api.dto;

import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class PainelItemResponse {

    Long agendamentoId;
    Long processoId;
    String numeroCnj;
    String cliente;
    TipoCadencia tipoCadencia;
    String cadenciaResumida;
    LocalDateTime proximaExecucao;
    LocalDateTime ultimaExecucao;
    StatusExecucao statusUltimaExecucao;
    int falhasConsecutivas;
    String ultimoErro;
    LocalDateTime ultimaFalhaEm;
    boolean emAtraso;
    boolean semNunca;
}
