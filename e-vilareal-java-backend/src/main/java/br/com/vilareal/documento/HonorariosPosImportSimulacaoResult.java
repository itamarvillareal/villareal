package br.com.vilareal.documento;

import java.time.LocalDate;
import java.util.List;

public record HonorariosPosImportSimulacaoResult(
        LocalDate desde,
        List<Integer> bancos,
        int creditosOrfaos,
        int autoConciliariam,
        int ambiguos,
        List<HonorariosPosImportSimulacaoItem> itens) {

    public static HonorariosPosImportSimulacaoResult vazio(LocalDate desde, List<Integer> bancos) {
        return new HonorariosPosImportSimulacaoResult(desde, bancos, 0, 0, 0, List.of());
    }
}
