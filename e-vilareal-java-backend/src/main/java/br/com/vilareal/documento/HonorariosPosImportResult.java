package br.com.vilareal.documento;

import java.util.ArrayList;
import java.util.List;

public record HonorariosPosImportResult(int autoConciliados, int ambiguos, List<String> erros) {

    public static HonorariosPosImportResult vazio() {
        return new HonorariosPosImportResult(0, 0, List.of());
    }

    public static HonorariosPosImportResult of(int auto, int amb, List<String> erros) {
        return new HonorariosPosImportResult(auto, amb, erros != null ? List.copyOf(erros) : List.of());
    }

    public HonorariosPosImportResult withErros(List<String> extra) {
        if (extra == null || extra.isEmpty()) {
            return this;
        }
        List<String> merged = new ArrayList<>(erros);
        merged.addAll(extra);
        return new HonorariosPosImportResult(autoConciliados, ambiguos, merged);
    }
}
