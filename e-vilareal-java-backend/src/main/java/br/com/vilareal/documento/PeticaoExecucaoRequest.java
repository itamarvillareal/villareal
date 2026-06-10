package br.com.vilareal.documento;

import java.time.LocalDate;
import java.util.List;

/** Request da geração da petição de Execução de Taxa Condominial. */
public record PeticaoExecucaoRequest(
        Long processoId,
        String enderecamento,
        String modo,
        LocalDate data,
        ConfigCalculoDto config,
        List<TituloDto> titulos,
        /** Total geral exatamente como exibido na tela de cálculos (INV1). Opcional. */
        String totalGeral) {

    public record ConfigCalculoDto(String indice, String multa, String juros, String periodicidade) {
    }

    /** Valores como strings monetárias BRL ("R$ 1.234,56") ou decimais ("1234.56"). */
    public record TituloDto(
            String descricao,
            String vencimento,
            Integer diasAtraso,
            String valorPrincipal,
            String atualizacaoMonetaria,
            String juros,
            String multa,
            String honorarios,
            /** Total do título exatamente como exibido na grade (INV1). Opcional. */
            String total) {
    }
}
