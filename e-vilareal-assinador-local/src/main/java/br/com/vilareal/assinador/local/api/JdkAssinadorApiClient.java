package br.com.vilareal.assinador.local.api;

import br.com.vilareal.assinador.local.config.AssinadorLocalConfig;
import br.com.vilareal.assinador.local.util.MultipartBodyBuilder;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

public final class JdkAssinadorApiClient implements AssinadorApiClient {

    static final String HEADER_SECRET = "X-Assinador-Secret";
    static final String HEADER_ASSINADOR_ID = "X-Assinador-Id";

    private final AssinadorLocalConfig config;
    private final HttpClient httpClient;
    private final ObjectMapper objectMapper;

    public JdkAssinadorApiClient(AssinadorLocalConfig config) {
        this(config, HttpClient.newBuilder().connectTimeout(Duration.ofSeconds(30)).build(), new ObjectMapper());
    }

    JdkAssinadorApiClient(AssinadorLocalConfig config, HttpClient httpClient, ObjectMapper objectMapper) {
        this.config = config;
        this.httpClient = httpClient;
        this.objectMapper = objectMapper;
    }

    @Override
    public Optional<LotePendente> longPollProximoLote(int timeoutSegundos) throws AssinadorApiException {
        URI uri = URI.create(config.apiPrefix() + "/lotes/pendente?timeout=" + timeoutSegundos);
        HttpRequest request = baseRequest(uri)
                .timeout(Duration.ofSeconds(timeoutSegundos + 15L))
                .GET()
                .build();

        HttpResponse<String> response = enviar(request);
        if (response.statusCode() == 204) {
            return Optional.empty();
        }
        if (response.statusCode() == 200) {
            return Optional.of(parseLote(response.body()));
        }
        throw new AssinadorApiException(
                "Long-poll retornou HTTP " + response.statusCode() + ": " + resumirCorpo(response.body()), false);
    }

    @Override
    public byte[] baixarPdf(long loteId, long arquivoId) throws AssinadorApiException {
        URI uri = URI.create(config.apiPrefix() + "/lotes/" + loteId + "/pdfs/" + arquivoId);
        HttpRequest request = baseRequest(uri).timeout(Duration.ofMinutes(5)).GET().build();

        HttpResponse<byte[]> response = enviarBytes(request);
        if (response.statusCode() == 200) {
            return response.body();
        }
        throw new AssinadorApiException(
                "Download PDF " + arquivoId + " retornou HTTP " + response.statusCode(), false);
    }

    @Override
    public void concluirLote(long loteId, List<ArquivoAssinado> arquivosP7s) throws AssinadorApiException {
        URI uri = URI.create(config.apiPrefix() + "/lotes/" + loteId + "/concluir");
        MultipartBodyBuilder multipart = new MultipartBodyBuilder();
        for (ArquivoAssinado arquivo : arquivosP7s) {
            multipart.addFile("arquivosP7s", arquivo.nomeCanonicoP7s(), "application/pkcs7-signature", arquivo.conteudoP7s());
        }

        HttpRequest request = baseRequest(uri)
                .timeout(Duration.ofMinutes(10))
                .header("Content-Type", multipart.contentType())
                .POST(HttpRequest.BodyPublishers.ofByteArray(multipart.body()))
                .build();

        HttpResponse<String> response = enviar(request);
        if (response.statusCode() == 200) {
            return;
        }
        throw new AssinadorApiException(
                "Concluir lote " + loteId + " retornou HTTP " + response.statusCode() + ": "
                        + resumirCorpo(response.body()),
                false);
    }

    @Override
    public void registrarFalha(long loteId, String codigo, String mensagem) throws AssinadorApiException {
        URI uri = URI.create(config.apiPrefix() + "/lotes/" + loteId + "/falha");
        String json;
        try {
            json = objectMapper.writeValueAsString(new FalhaPayload(codigo, mensagem));
        } catch (IOException e) {
            throw new AssinadorApiException("Falha ao serializar JSON de erro", e, false);
        }

        HttpRequest request = baseRequest(uri)
                .timeout(Duration.ofSeconds(30))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(json))
                .build();

        HttpResponse<String> response = enviar(request);
        if (response.statusCode() == 204) {
            return;
        }
        throw new AssinadorApiException(
                "Registrar falha lote " + loteId + " retornou HTTP " + response.statusCode(), false);
    }

    private HttpRequest.Builder baseRequest(URI uri) {
        return HttpRequest.newBuilder(uri)
                .header(HEADER_SECRET, config.apiSecret())
                .header(HEADER_ASSINADOR_ID, config.assinadorId());
    }

    private HttpResponse<String> enviar(HttpRequest request) throws AssinadorApiException {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofString());
        } catch (IOException e) {
            throw new AssinadorApiException("API inacessível: " + e.getMessage(), e, true);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssinadorApiException("Long-poll interrompido", e, true);
        }
    }

    private HttpResponse<byte[]> enviarBytes(HttpRequest request) throws AssinadorApiException {
        try {
            return httpClient.send(request, HttpResponse.BodyHandlers.ofByteArray());
        } catch (IOException e) {
            throw new AssinadorApiException("API inacessível: " + e.getMessage(), e, true);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
            throw new AssinadorApiException("Download interrompido", e, true);
        }
    }

    private LotePendente parseLote(String json) throws AssinadorApiException {
        try {
            JsonNode root = objectMapper.readTree(json);
            long loteId = root.path("loteId").asLong();
            long credencialId = root.path("credencialId").asLong();
            List<LotePendente.ArquivoPendente> arquivos = new ArrayList<>();
            for (JsonNode node : root.path("arquivos")) {
                arquivos.add(new LotePendente.ArquivoPendente(
                        node.path("arquivoId").asLong(),
                        node.path("peticaoId").asLong(),
                        node.path("ordem").asInt(),
                        node.path("nomeCanonicoPdf").asText(),
                        node.path("nomeCanonicoP7s").asText()));
            }
            return new LotePendente(loteId, credencialId, List.copyOf(arquivos));
        } catch (IOException e) {
            throw new AssinadorApiException("Resposta JSON inválida no long-poll", e, false);
        }
    }

    private static String resumirCorpo(String corpo) {
        if (corpo == null || corpo.isBlank()) {
            return "";
        }
        return corpo.length() > 200 ? corpo.substring(0, 200) + "…" : corpo;
    }

    private record FalhaPayload(String codigo, String mensagem) {}
}
