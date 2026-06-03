package br.com.vilareal.integracao.cora;

import java.util.Map;

/** Resposta HTTP bruta da API Cora. */
public record CoraHttpResponse(int statusCode, String body, Map<String, String> headers) {

    public boolean isSuccess() {
        return statusCode >= 200 && statusCode < 300;
    }
}
