package br.com.vilareal.agendamento.api.dto;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Value
@Builder
public class AgendamentoResponse {

    Long id;
    Long processoId;
    String numeroCnj;
    boolean ativo;
    TipoCadencia tipoCadencia;
    Integer intervaloMinutos;
    String horariosFixos;
    PeriodoCadencia periodo;
    LocalTime periodoHorario;
    LocalTime janelaInicio;
    LocalTime janelaFim;
    boolean apenasDiasUteis;
    boolean considerarFeriados;
    LocalDateTime proximaExecucao;
    LocalDateTime ultimaExecucao;
    int falhasConsecutivas;
    String ultimoErro;
    LocalDateTime ultimaFalhaEm;
    LocalDateTime validoAte;
    int prioridade;
    String motivo;
    String criadoPor;
    LocalDateTime criadoEm;
    LocalDateTime atualizadoEm;
}
