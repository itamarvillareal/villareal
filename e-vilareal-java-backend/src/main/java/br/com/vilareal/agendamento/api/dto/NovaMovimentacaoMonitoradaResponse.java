package br.com.vilareal.agendamento.api.dto;

import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class NovaMovimentacaoMonitoradaResponse {

    String numero;
    String legenda;
    LocalDateTime dataMovimentacao;
    String idMovi;
}
