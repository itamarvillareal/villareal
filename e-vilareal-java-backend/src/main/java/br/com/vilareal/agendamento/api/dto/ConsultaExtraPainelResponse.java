package br.com.vilareal.agendamento.api.dto;

import lombok.Builder;
import lombok.Value;

@Value
@Builder
public class ConsultaExtraPainelResponse {

    boolean ocupado;
    int processosConsultados;
    int agendamentosAtualizados;
    int comNovidade;
    int comErro;

    public static ConsultaExtraPainelResponse ocupado() {
        return ConsultaExtraPainelResponse.builder()
                .ocupado(true)
                .processosConsultados(0)
                .agendamentosAtualizados(0)
                .comNovidade(0)
                .comErro(0)
                .build();
    }

    public static ConsultaExtraPainelResponse vazio() {
        return ConsultaExtraPainelResponse.builder()
                .ocupado(false)
                .processosConsultados(0)
                .agendamentosAtualizados(0)
                .comNovidade(0)
                .comErro(0)
                .build();
    }
}
