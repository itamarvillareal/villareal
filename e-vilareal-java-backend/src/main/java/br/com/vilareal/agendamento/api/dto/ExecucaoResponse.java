package br.com.vilareal.agendamento.api.dto;

import br.com.vilareal.agendamento.domain.OrigemConsulta;
import br.com.vilareal.agendamento.domain.StatusExecucao;
import br.com.vilareal.notificacao.domain.NotificacaoEnvioStatus;
import lombok.Builder;
import lombok.Value;

import java.time.LocalDateTime;

@Value
@Builder
public class ExecucaoResponse {

    Long id;
    Long processoId;
    Long agendamentoId;
    OrigemConsulta origem;
    LocalDateTime iniciadaEm;
    LocalDateTime finalizadaEm;
    Long duracaoMs;
    StatusExecucao status;
    int teoresNovos;
    int teoresJaExistentes;
    int arquivosBaixados;
    String erro;
    String detalhes;
    NotificacaoEnvioStatus notificacaoStatus;
    String notificacaoDestinatarios;
    String notificacaoErro;
    LocalDateTime notificacaoEm;
}
