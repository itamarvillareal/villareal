package br.com.vilareal.assinador.local.loop;

import br.com.vilareal.assinador.local.api.AssinadorApiClient;
import br.com.vilareal.assinador.local.api.AssinadorApiException;
import br.com.vilareal.assinador.local.api.LotePendente;
import br.com.vilareal.assinador.local.config.AssinadorLocalConfig;
import br.com.vilareal.assinador.local.signing.Pkcs12TokenSigningSessionFactory;
import br.com.vilareal.assinador.local.signing.TokenSigningSession;
import br.com.vilareal.assinador.local.signing.TokenSigningSessionFactory;
import br.com.vilareal.assinatura.keystore.Pkcs11TokenException;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.InputStream;
import java.net.URI;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;

class AssinadorPullLoopTest {

    private static final char[] P12_PASSWORD = "test-fixture".toCharArray();
    private static final String SEGREDO = "test-assinador-secret-min-32-chars-long!!";

    @TempDir
    Path tempDir;

    @Test
    void processarLote_assinaEConclui_comPkcs12() throws Exception {
        byte[] pdf = carregarPdf();
        Path p12 = materializarP12();
        LotePendente lote = loteExemplo();

        RecordingApiClient api = new RecordingApiClient(pdf);
        AssinadorPullLoop loop = new AssinadorPullLoop(
                configTeste(),
                api,
                new Pkcs12TokenSigningSessionFactory(p12, P12_PASSWORD),
                ms -> {});

        loop.processarLote(lote);

        assertThat(api.concluido).isTrue();
        assertThat(api.falhaRegistrada).isNull();
        assertThat(api.assinadosEnviados).hasSize(1);
        assertThat(api.assinadosEnviados.get(0).nomeCanonicoP7s()).isEqualTo("100_1_abcd.pdf.p7s");
        assertThat(api.assinadosEnviados.get(0).conteudoP7s()).isNotEmpty();
    }

    @Test
    void processarLote_tokenOcupado_registraFalha() {
        LotePendente lote = loteExemplo();
        RecordingApiClient api = new RecordingApiClient(new byte[] {1, 2, 3});

        TokenSigningSessionFactory factory = () -> {
            throw new Pkcs11TokenException(
                    Pkcs11TokenException.Codigo.TOKEN_OCUPADO, Pkcs11TokenException.MENSAGEM_TOKEN_OCUPADO);
        };

        AssinadorPullLoop loop = new AssinadorPullLoop(configTeste(), api, factory, ms -> {});
        loop.processarLote(lote);

        assertThat(api.concluido).isFalse();
        assertThat(api.falhaRegistrada).isEqualTo("TOKEN_OCUPADO");
        assertThat(api.falhaMensagem).contains("sai.jar");
    }

    @Test
    void executar_apiInacessivel_fazBackoffSemMorrer() throws InterruptedException {
        AtomicInteger tentativas = new AtomicInteger();
        List<Long> sleeps = new ArrayList<>();

        AssinadorApiClient api = new AssinadorApiClient() {
            @Override
            public Optional<LotePendente> longPollProximoLote(int timeoutSegundos) throws AssinadorApiException {
                tentativas.incrementAndGet();
                if (tentativas.get() >= 3) {
                    throw new AssinadorApiException("connection refused", true);
                }
                throw new AssinadorApiException("timeout", true);
            }

            @Override
            public byte[] baixarPdf(long loteId, long arquivoId) {
                throw new UnsupportedOperationException();
            }

            @Override
            public void concluirLote(long loteId, List<ArquivoAssinado> arquivosP7s) {
                throw new UnsupportedOperationException();
            }

            @Override
            public void registrarFalha(long loteId, String codigo, String mensagem) {
                throw new UnsupportedOperationException();
            }
        };

        AssinadorPullLoop loop = new AssinadorPullLoop(
                configTeste(),
                api,
                () -> {
                    throw new UnsupportedOperationException();
                },
                sleeps::add);

        Thread t = new Thread(loop::executar);
        t.start();

        await(() -> tentativas.get() >= 3, 5_000);
        loop.parar();
        t.join(2_000);

        assertThat(tentativas.get()).isGreaterThanOrEqualTo(3);
        assertThat(sleeps).isNotEmpty();
        assertThat(sleeps.get(0)).isEqualTo(10L);
    }

    @Test
    void executar_cicloCompleto_comMockHttp() throws Exception {
        byte[] pdf = carregarPdf();
        Path p12 = materializarP12();
        MockAssinadorHttpServer servidor = MockAssinadorHttpServer.iniciar(SEGREDO, pdf);
        try {
            AssinadorLocalConfig config = AssinadorLocalConfig.paraTeste(
                    URI.create("http://localhost:" + servidor.porta()), SEGREDO, "win-test", "pin-test".toCharArray());

            AssinadorPullLoop loop = new AssinadorPullLoop(
                    config,
                    new br.com.vilareal.assinador.local.api.JdkAssinadorApiClient(config),
                    new Pkcs12TokenSigningSessionFactory(p12, P12_PASSWORD),
                    ms -> {});

            Thread t = new Thread(loop::executar);
            t.start();

            await(servidor::concluido, 10_000);
            loop.parar();
            t.join(3_000);

            assertThat(servidor.loteClaimado()).isEqualTo(42L);
            assertThat(servidor.concluido()).isTrue();
            assertThat(servidor.p7sRecebidos()).isEqualTo(1);
        } finally {
            servidor.close();
        }
    }

    private static LotePendente loteExemplo() {
        return new LotePendente(
                42L,
                9L,
                List.of(new LotePendente.ArquivoPendente(7L, 100L, 1, "100_1_abcd.pdf", "100_1_abcd.pdf.p7s")));
    }

    private static AssinadorLocalConfig configTeste() {
        return AssinadorLocalConfig.paraTeste(
                URI.create("http://localhost:9999"), SEGREDO, "win-test", "pin-test".toCharArray());
    }

    private byte[] carregarPdf() throws Exception {
        try (InputStream in = getClass().getResourceAsStream("/assinatura/referencia-sintetica.pdf")) {
            if (in == null) {
                throw new IllegalStateException("Fixture PDF ausente");
            }
            return in.readAllBytes();
        }
    }

    private Path materializarP12() throws Exception {
        Path destino = tempDir.resolve("test-signer.p12");
        try (InputStream in = getClass().getResourceAsStream("/assinatura/test-signer.p12")) {
            if (in == null) {
                throw new IllegalStateException("Fixture P12 ausente");
            }
            Files.copy(in, destino);
        }
        return destino;
    }

    private static void await(java.util.function.BooleanSupplier condicao, long timeoutMs) throws InterruptedException {
        long deadline = System.currentTimeMillis() + timeoutMs;
        while (!condicao.getAsBoolean() && System.currentTimeMillis() < deadline) {
            Thread.sleep(50);
        }
    }

    private static final class RecordingApiClient implements AssinadorApiClient {

        private final byte[] pdf;
        private boolean concluido;
        private String falhaRegistrada;
        private String falhaMensagem;
        private List<ArquivoAssinado> assinadosEnviados = List.of();

        RecordingApiClient(byte[] pdf) {
            this.pdf = pdf;
        }

        @Override
        public Optional<LotePendente> longPollProximoLote(int timeoutSegundos) {
            return Optional.empty();
        }

        @Override
        public byte[] baixarPdf(long loteId, long arquivoId) {
            return pdf;
        }

        @Override
        public void concluirLote(long loteId, List<ArquivoAssinado> arquivosP7s) {
            concluido = true;
            assinadosEnviados = List.copyOf(arquivosP7s);
        }

        @Override
        public void registrarFalha(long loteId, String codigo, String mensagem) {
            falhaRegistrada = codigo;
            falhaMensagem = mensagem;
        }
    }
}
