package br.com.vilareal.agendamento.api.dto;

import br.com.vilareal.agendamento.domain.StatusExecucao;
import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class ResultadoMonitoramentoResponse {

    Long processoId;
    String numeroCnj;
    int totalListadas;
    boolean baseline;
    int novas;
    List<NovaMovimentacaoMonitoradaResponse> novasMovimentacoes;
    StatusExecucao status;
    Long execucaoId;
    String erro;
}
