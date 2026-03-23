package br.com.vilareal.api.monitoring.datajud;

import java.util.Map;

public record DatajudSearchResult(
        boolean ok,
        String motivo,
        int httpStatus,
        String apiIndex,
        Map<String, Object> responseJson,
        String rawBodyPreview
) {
    public static DatajudSearchResult failure(String motivo, int http, String preview) {
        return new DatajudSearchResult(false, motivo, http, null, null, preview);
    }

    public static DatajudSearchResult success(String apiIndex, Map<String, Object> json) {
        return new DatajudSearchResult(true, "ok", 200, apiIndex, json, null);
    }
}
