package br.com.vilareal.whatsapp.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotBlank;

import java.util.List;

/**
 * Regra de recorrência para agendamento WhatsApp em lote.
 * Campos usados dependem de {@link #tipo()}: {@code MENSAL}, {@code SEMANAL}, {@code INTERVALO_DIA}.
 */
public record RecorrenciaAgendamentoRequest(
        @NotBlank String tipo,
        /** MENSAL: dia 1–31 (último dia do mês se inexistente). */
        @Min(1) @Max(31) Integer diaDoMes,
        @Min(0) @Max(23) Integer hora,
        @Min(0) @Max(59) Integer minuto,
        /** MENSAL: yyyy-MM — mês inicial. */
        String mesInicio,
        /** MENSAL: yyyy-MM — mês final (alternativa a {@code quantidadeMeses}). */
        String mesFim,
        /** MENSAL: quantidade de meses a partir de {@code mesInicio}. */
        @Min(1) @Max(120) Integer quantidadeMeses,
        /** SEMANAL: SEGUNDA, TERCA, QUARTA, QUINTA, SEXTA, SABADO, DOMINGO. */
        List<String> diasSemana,
        /** SEMANAL: yyyy-MM-dd — primeira data considerada. */
        String dataInicio,
        /** SEMANAL: quantas semanas de calendário a partir de {@code dataInicio}. */
        @Min(1) @Max(104) Integer quantidadeSemanas,
        /** INTERVALO_DIA: yyyy-MM-dd. */
        String data,
        @Min(0) @Max(23) Integer horaInicio,
        @Min(0) @Max(59) Integer minutoInicio,
        @Min(0) @Max(23) Integer horaFim,
        @Min(0) @Max(59) Integer minutoFim,
        /** INTERVALO_DIA: intervalo entre envios (minutos). */
        @Min(1) @Max(1440) Integer intervaloMinutos) {}
