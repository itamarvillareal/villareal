package br.com.vilareal.agendamento.api.dto;

import br.com.vilareal.agendamento.domain.PeriodoCadencia;
import br.com.vilareal.agendamento.domain.TipoCadencia;
import jakarta.validation.constraints.NotNull;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDateTime;
import java.time.LocalTime;

@Getter
@Setter
public class AgendamentoRequest {

    @NotNull(message = "tipoCadencia é obrigatório.")
    private TipoCadencia tipoCadencia;

    private Integer intervaloMinutos;

    /** Horários fixos em CSV {@code HH:mm} (ex.: {@code 08:00,14:30}). */
    private String horariosFixos;

    /** Período da cadência {@code PERIODICO} (ex.: {@code SEMANAL}). */
    private PeriodoCadencia periodo;

    /** Hora do dia da execução periódica (ex.: {@code 08:00}). */
    private LocalTime periodoHorario;

    private LocalTime janelaInicio;

    private LocalTime janelaFim;

    private Boolean apenasDiasUteis;

    private Boolean considerarFeriados;

    private LocalDateTime validoAte;

    private Integer prioridade;

    private String motivo;
}
