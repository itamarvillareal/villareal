package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoIndiceMensalEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoIndiceMensalRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import com.sun.net.httpserver.HttpServer;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.web.client.RestClient;

import java.io.OutputStream;
import java.math.BigDecimal;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicReference;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class CalculoIndicesBcbServiceTest {

    /** 2026-07-22 em São Paulo (dia ≥ 10 → mês anterior já esperado). */
    private static final Clock CLOCK_FIXO =
            Clock.fixed(Instant.parse("2026-07-22T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));

    private HttpServer httpServer;
    private final CopyOnWriteArrayList<String> requisicoes = new CopyOnWriteArrayList<>();
    private final AtomicReference<String> respostaJson = new AtomicReference<>("[]");

    private CalculoIndiceMensalRepository repository;
    private CalculoIndicesBcbService service;

    @BeforeEach
    void setUp() throws Exception {
        httpServer = HttpServer.create(new InetSocketAddress(0), 0);
        httpServer.createContext("/", exchange -> {
            requisicoes.add(exchange.getRequestURI().getPath() + "?" + exchange.getRequestURI().getRawQuery());
            byte[] body = respostaJson.get().getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(200, body.length);
            try (OutputStream os = exchange.getResponseBody()) {
                os.write(body);
            }
        });
        httpServer.start();

        repository = mock(CalculoIndiceMensalRepository.class);
        when(repository.findByIndiceAndCompetenciaBetween(anyString(), anyString(), anyString()))
                .thenReturn(List.of());

        RestClient restClient = RestClient.builder()
                .baseUrl("http://localhost:" + httpServer.getAddress().getPort())
                .build();
        service = new CalculoIndicesBcbService(restClient, repository, CLOCK_FIXO);
    }

    @AfterEach
    void tearDown() {
        httpServer.stop(0);
    }

    @Test
    void nomeCanonicoNormalizaVariantes() {
        assertThat(CalculoIndicesBcbService.nomeCanonico("POUPANÇA")).isEqualTo("POUPANCA");
        assertThat(CalculoIndicesBcbService.nomeCanonico("igp-m")).isEqualTo("IGPM");
        assertThat(CalculoIndicesBcbService.nomeCanonico("ipcae")).isEqualTo("IPCA-E");
        assertThat(CalculoIndicesBcbService.nomeCanonico("selic")).isEqualTo("SELIC");
        assertThatThrownBy(() -> CalculoIndicesBcbService.nomeCanonico("NENHUM"))
                .isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void buscaNoBcbPersisteERetornaSomenteCompetenciasPublicadas() {
        respostaJson.set("[{\"data\":\"01/01/2024\",\"valor\":\"0.07\"},{\"data\":\"01/02/2024\",\"valor\":\"-0.52\"}]");

        Map<String, BigDecimal> serie =
                service.obterIndicesMensais("IGPM", LocalDate.of(2024, 1, 5), LocalDate.of(2024, 3, 20));

        assertThat(serie).containsOnlyKeys("2024-01", "2024-02");
        assertThat(serie.get("2024-01")).isEqualByComparingTo("0.07");
        assertThat(serie.get("2024-02")).isEqualByComparingTo("-0.52");

        @SuppressWarnings("unchecked")
        ArgumentCaptor<List<CalculoIndiceMensalEntity>> captor = ArgumentCaptor.forClass(List.class);
        verify(repository).saveAll(captor.capture());
        assertThat(captor.getValue()).hasSize(2);
        assertThat(captor.getValue().get(0).getIndice()).isEqualTo("IGPM");
        assertThat(captor.getValue().get(0).getCompetencia()).isEqualTo("2024-01");

        assertThat(requisicoes).hasSize(1);
        assertThat(requisicoes.get(0)).contains("bcdata.sgs.189");
    }

    @Test
    void competenciasJaPersistidasNaoVoltamAoBcb() {
        CalculoIndiceMensalEntity jan = new CalculoIndiceMensalEntity();
        jan.setIndice("IGPM");
        jan.setCompetencia("2024-01");
        jan.setValor(new BigDecimal("0.070000"));
        CalculoIndiceMensalEntity fev = new CalculoIndiceMensalEntity();
        fev.setIndice("IGPM");
        fev.setCompetencia("2024-02");
        fev.setValor(new BigDecimal("-0.520000"));
        when(repository.findByIndiceAndCompetenciaBetween("IGPM", "2024-01", "2024-02"))
                .thenReturn(List.of(jan, fev));

        Map<String, BigDecimal> serie =
                service.obterIndicesMensais("IGPM", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 2, 28));

        assertThat(serie.get("2024-01")).isEqualByComparingTo("0.07");
        assertThat(serie.get("2024-02")).isEqualByComparingTo("-0.52");
        assertThat(requisicoes).isEmpty();
        verify(repository, never()).saveAll(anyList());
    }

    @Test
    void ipcaEUsaSerieIpca15DoLegado() {
        respostaJson.set("[{\"data\":\"01/01/2024\",\"valor\":\"0.31\"}]");

        Map<String, BigDecimal> serie =
                service.obterIndicesMensais("IPCA-E", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 31));

        assertThat(serie.get("2024-01")).isEqualByComparingTo("0.31");
        assertThat(requisicoes.get(0)).contains("bcdata.sgs.7478");
    }

    @Test
    void poupancaAplicaDefasagemDeUmMes() {
        // Rendimento SGS 196 de dez/2023 vale para a competência jan/2024 (regra do legado).
        respostaJson.set("[{\"data\":\"01/12/2023\",\"valor\":\"0.6576\"}]");

        Map<String, BigDecimal> serie =
                service.obterIndicesMensais("POUPANÇA", LocalDate.of(2024, 1, 1), LocalDate.of(2024, 1, 31));

        assertThat(serie).containsOnlyKeys("2024-01");
        assertThat(serie.get("2024-01")).isEqualByComparingTo("0.6576");
        assertThat(requisicoes.get(0)).contains("bcdata.sgs.196");
        // Janela SGS deslocada: pede dezembro/2023.
        assertThat(requisicoes.get(0)).contains("dataInicial=01/12/2023");
    }

    @Test
    void competenciaAindaNaoEsperadaNaoEBuscada() {
        // Clock fixo em 22/07/2026 → última competência esperada = jun/2026. Julho não deve ir ao BCB.
        respostaJson.set("[{\"data\":\"01/06/2026\",\"valor\":\"0.23\"}]");

        Map<String, BigDecimal> serie =
                service.obterIndicesMensais("INPC", LocalDate.of(2026, 6, 1), LocalDate.of(2026, 7, 31));

        assertThat(serie).containsOnlyKeys("2026-06");
        assertThat(requisicoes).hasSize(1);
        assertThat(requisicoes.get(0)).contains("dataFinal=30/06/2026");
    }

    private static List<CalculoIndiceMensalEntity> anyList() {
        return org.mockito.ArgumentMatchers.anyList();
    }
}
