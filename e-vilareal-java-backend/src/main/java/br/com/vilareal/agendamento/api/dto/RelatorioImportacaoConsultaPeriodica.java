package br.com.vilareal.agendamento.api.dto;

import lombok.Builder;
import lombok.Value;

import java.util.List;

@Value
@Builder
public class RelatorioImportacaoConsultaPeriodica {

    int linhasLidas;
    int processosAtualizados;
    int agendamentosCriados;
    int destinatariosCriados;
    List<String> puladosCnjInexistente;
    List<LinhaInvalida> linhasInvalidas;

    @Value
    @Builder
    public static class LinhaInvalida {
        int linha;
        String motivo;
    }
}
