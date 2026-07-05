package br.com.vilareal.assinador.local.loop;

import com.sun.net.httpserver.HttpExchange;
import com.sun.net.httpserver.HttpServer;

import java.io.IOException;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicLong;

/** Servidor HTTP mínimo que simula a API /api/assinador/v1 para testes no Mac. */
final class MockAssinadorHttpServer implements AutoCloseable {

    private final HttpServer server;
    private final AtomicLong loteClaimado = new AtomicLong();
    private final AtomicBoolean concluido = new AtomicBoolean();
    private final AtomicInteger p7sRecebidos = new AtomicInteger();
    private final byte[] pdf;

    private MockAssinadorHttpServer(HttpServer server, byte[] pdf) {
        this.server = server;
        this.pdf = pdf;
    }

    static MockAssinadorHttpServer iniciar(String segredo, byte[] pdf) throws IOException {
        HttpServer server = HttpServer.create(new InetSocketAddress("localhost", 0), 0);
        MockAssinadorHttpServer mock = new MockAssinadorHttpServer(server, pdf);
        AtomicBoolean loteJaEntregue = new AtomicBoolean();

        server.createContext("/api/assinador/v1/lotes/pendente", exchange -> {
            if (!mock.autenticado(exchange, segredo)) {
                mock.responder(exchange, 401, "");
                return;
            }
            if (loteJaEntregue.getAndSet(true)) {
                mock.responder(exchange, 204, "");
                return;
            }
            String json =
                    """
                    {"loteId":42,"credencialId":9,"arquivos":[{"arquivoId":7,"peticaoId":100,"ordem":1,\
                    "nomeCanonicoPdf":"100_1_abcd.pdf","nomeCanonicoP7s":"100_1_abcd.pdf.p7s","pdfSha256":"sha"}]}\
                    """;
            mock.loteClaimado.set(42L);
            mock.responder(exchange, 200, json);
        });

        server.createContext("/api/assinador/v1/lotes/42/pdfs/7", exchange -> {
            if (!mock.autenticado(exchange, segredo)) {
                mock.responder(exchange, 401, "");
                return;
            }
            exchange.getResponseHeaders().add("Content-Type", "application/pdf");
            exchange.sendResponseHeaders(200, pdf.length);
            exchange.getResponseBody().write(pdf);
            exchange.close();
        });

        server.createContext("/api/assinador/v1/lotes/42/concluir", exchange -> {
            if (!mock.autenticado(exchange, segredo)) {
                mock.responder(exchange, 401, "");
                return;
            }
            if ("POST".equalsIgnoreCase(exchange.getRequestMethod())) {
                String contentType = exchange.getRequestHeaders().getFirst("Content-Type");
                if (contentType != null && contentType.startsWith("multipart/form-data")) {
                    byte[] body = exchange.getRequestBody().readAllBytes();
                    if (body.length > 0) {
                        mock.p7sRecebidos.incrementAndGet();
                    }
                }
                mock.concluido.set(true);
                mock.responder(exchange, 200, "{\"loteId\":42,\"status\":\"CONCLUIDO\",\"pareadas\":1}");
                return;
            }
            mock.responder(exchange, 405, "");
        });

        server.createContext("/api/assinador/v1/lotes/42/falha", exchange -> {
            if (!mock.autenticado(exchange, segredo)) {
                mock.responder(exchange, 401, "");
                return;
            }
            exchange.getRequestBody().readAllBytes();
            mock.responder(exchange, 204, "");
        });

        server.setExecutor(null);
        server.start();
        return mock;
    }

    int porta() {
        return server.getAddress().getPort();
    }

    long loteClaimado() {
        return loteClaimado.get();
    }

    boolean concluido() {
        return concluido.get();
    }

    int p7sRecebidos() {
        return p7sRecebidos.get();
    }

    @Override
    public void close() {
        server.stop(0);
    }

    private boolean autenticado(HttpExchange exchange, String segredo) {
        String secret = exchange.getRequestHeaders().getFirst("X-Assinador-Secret");
        String id = exchange.getRequestHeaders().getFirst("X-Assinador-Id");
        return segredo.equals(secret) && id != null && !id.isBlank();
    }

    private void responder(HttpExchange exchange, int status, String body) throws IOException {
        byte[] bytes = body.getBytes(StandardCharsets.UTF_8);
        exchange.getResponseHeaders().add("Content-Type", "application/json");
        exchange.sendResponseHeaders(status, bytes.length);
        if (bytes.length > 0) {
            exchange.getResponseBody().write(bytes);
        }
        exchange.close();
    }
}
