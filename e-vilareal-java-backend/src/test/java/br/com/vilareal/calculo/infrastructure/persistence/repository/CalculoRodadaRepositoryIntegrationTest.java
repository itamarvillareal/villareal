package br.com.vilareal.calculo.infrastructure.persistence.repository;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.hibernate.cfg.AvailableSettings;
import org.hibernate.resource.jdbc.spi.StatementInspector;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.boot.test.context.TestConfiguration;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.Locale;

import static org.assertj.core.api.Assertions.assertThat;

@Import(CalculoRodadaRepositoryIntegrationTest.HibernateSqlCaptureConfiguration.class)
class CalculoRodadaRepositoryIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private CalculoRodadaRepository calculoRodadaRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @PersistenceContext
    private EntityManager entityManager;

    @BeforeEach
    void limparRodadasESql() {
        HibernateSqlCapture.clear();
        calculoRodadaRepository.deleteAll();
    }

    /**
     * {@code JpaRepository.findAll()} em entidade completa inclui {@code payload_json} mesmo sem acessar o campo:
     * {@code @Basic(LAZY)} não funciona sem bytecode enhancement. Em produção, listagens sem payload usam
     * {@link CalculoRodadaRepository#findAllResumo()} (ver {@code findAllResumo_naoCarregaPayloadJson}).
     * O único {@code findAll()} remanescente ({@code CalculoApplicationService#listarRodadas}) lê o payload de propósito.
     */
    @Test
    @Transactional
    void findAll_cruIncluiPayloadJson_semEnhancement() throws Exception {
        CalculoRodadaEntity e = new CalculoRodadaEntity();
        e.setCodigoCliente("00000001");
        e.setNumeroProcesso(1);
        e.setDimensao(0);
        e.setPayloadJson(objectMapper.readTree("{\"parcelamentoAceito\":false}"));
        calculoRodadaRepository.save(e);
        calculoRodadaRepository.flush();
        HibernateSqlCapture.clear();

        for (CalculoRodadaEntity row : calculoRodadaRepository.findAll()) {
            row.getId();
            row.getCodigoCliente();
            row.getNumeroProcesso();
            row.getDimensao();
        }

        assertThat(HibernateSqlCapture.statementsReferencingCalculoRodada()).anyMatch(CalculoRodadaRepositoryIntegrationTest::containsPayloadJsonColumn);
    }

    @Test
    @Transactional
    void findAllResumo_naoCarregaPayloadJson() throws Exception {
        CalculoRodadaEntity e = new CalculoRodadaEntity();
        e.setCodigoCliente("00000003");
        e.setNumeroProcesso(1);
        e.setDimensao(0);
        e.setParcelamentoAceito(true);
        e.setPayloadJson(objectMapper.readTree("{\"parcelamentoAceito\":true,\"k\":\"v\"}"));
        calculoRodadaRepository.save(e);
        calculoRodadaRepository.flush();
        HibernateSqlCapture.clear();

        var rows = calculoRodadaRepository.findAllResumo();
        assertThat(rows).hasSize(1);
        assertThat(rows.get(0).parcelamentoAceito()).isTrue();

        assertThat(HibernateSqlCapture.statementsReferencingCalculoRodada()).noneMatch(s -> containsPayloadJsonColumn(s));
    }

    @Test
    @Transactional
    void findById_comAcessoAoPayload_carregaJson() throws Exception {
        CalculoRodadaEntity inserted = new CalculoRodadaEntity();
        inserted.setCodigoCliente("00000002");
        inserted.setNumeroProcesso(7);
        inserted.setDimensao(0);
        JsonNode expected = objectMapper.readTree("{\"parcelamentoAceito\":true,\"k\":\"v\"}");
        inserted.setPayloadJson(expected);
        Long id = calculoRodadaRepository.save(inserted).getId();
        calculoRodadaRepository.flush();
        HibernateSqlCapture.clear();
        entityManager.clear();

        CalculoRodadaEntity loaded = calculoRodadaRepository.findById(id).orElseThrow();
        JsonNode payload = loaded.getPayloadJson();

        assertThat(payload).isNotNull();
        assertThat(payload.get("k").asText()).isEqualTo("v");
        assertThat(payload.get("parcelamentoAceito").asBoolean()).isTrue();
        assertThat(HibernateSqlCapture.statementsReferencingCalculoRodada()).anyMatch(CalculoRodadaRepositoryIntegrationTest::containsPayloadJsonColumn);
    }

    private static boolean containsPayloadJsonColumn(String sql) {
        return sql.toLowerCase(Locale.ROOT).contains("payload_json");
    }

    @TestConfiguration
    static class HibernateSqlCaptureConfiguration {

        @Bean
        HibernatePropertiesCustomizer calculoRodadaSqlStatementCapture() {
            return hibernateProperties ->
                    hibernateProperties.put(AvailableSettings.STATEMENT_INSPECTOR, (StatementInspector) sql -> {
                        HibernateSqlCapture.record(sql);
                        return sql;
                    });
        }
    }

    static final class HibernateSqlCapture {

        private static final List<String> STATEMENTS = Collections.synchronizedList(new ArrayList<>());

        static void clear() {
            STATEMENTS.clear();
        }

        static void record(String sql) {
            if (sql != null) {
                STATEMENTS.add(sql);
            }
        }

        static List<String> statementsReferencingCalculoRodada() {
            synchronized (STATEMENTS) {
                return STATEMENTS.stream()
                        .filter(s -> s.toLowerCase(Locale.ROOT).contains("calculo_rodada"))
                        .toList();
            }
        }
    }
}
