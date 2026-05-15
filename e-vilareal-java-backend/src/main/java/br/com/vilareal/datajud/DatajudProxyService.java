package br.com.vilareal.datajud;

import br.com.vilareal.common.exception.BusinessRuleException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.regex.Pattern;

/**
 * Encaminha pedidos de pesquisa à API pública DataJud (CNJ), usando API key só no servidor.
 * Evita expor chave no bundle e dispensa rota <code>/datajud-proxy</code> no nginx de produção.
 */
@Service
public class DatajudProxyService {

    private static final Pattern INDEX_PATTERN = Pattern.compile("^[a-z0-9_]{1,100}$");

    private final HttpClient httpClient = HttpClient.newBuilder()
            .connectTimeout(Duration.ofSeconds(15))
            .build();

    @Value("${vilareal.datajud.base-url:https://api-publica.datajud.cnj.jus.br}")
    private String baseUrl;

    /** Variável de ambiente típica: DATAJUD_API_KEY */
    @Value("${vilareal.datajud.api-key:}")
    private String apiKey;

    public HttpResponse<byte[]> proxySearch(String index, byte[] body) throws IOException, InterruptedException {
        validateIndex(index);
        String base = baseUrl == null ? "" : baseUrl.trim();
        if (base.endsWith("/")) {
            base = base.substring(0, base.length() - 1);
        }
        URI uri = URI.create(base + "/" + index + "/_search");

        HttpRequest.Builder b = HttpRequest.newBuilder(uri)
                .timeout(Duration.ofSeconds(55))
                .POST(HttpRequest.BodyPublishers.ofByteArray(body == null ? new byte[0] : body))
                .header("Content-Type", "application/json");
        if (apiKey != null && !apiKey.isBlank()) {
            b.header("Authorization", "APIKey " + apiKey.trim());
        }
        return httpClient.send(b.build(), HttpResponse.BodyHandlers.ofByteArray());
    }

    private void validateIndex(String index) {
        if (index == null || !INDEX_PATTERN.matcher(index).matches()) {
            throw new BusinessRuleException("Índice DataJud inválido.");
        }
    }

    public static HttpStatus mapStatus(int code) {
        HttpStatus s = HttpStatus.resolve(code);
        return s != null ? s : HttpStatus.BAD_GATEWAY;
    }
}
