package br.com.vilareal.calculo.application;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.calculo.api.dto.AcordoDescumpridoProporRequest;
import br.com.vilareal.calculo.api.dto.AcordoDescumpridoProporResponse;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

class AcordoDescumpridoApplicationServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private AcordoDescumpridoApplicationService service;

    @Autowired
    private CalculoRodadaRepository rodadaRepository;

    @Autowired
    private ObjectMapper objectMapper;

    @BeforeEach
    void limpar() {
        rodadaRepository.deleteAll();
    }

    @Test
    @Transactional
    void propor_criaDimensaoComTitulosDasParcelasAbertas() throws Exception {
        CalculoRodadaEntity e = new CalculoRodadaEntity();
        e.setCodigoCliente("00000088");
        e.setNumeroProcesso(3);
        e.setDimensao(0);
        e.setParcelamentoAceito(true);
        e.setPayloadJson(objectMapper.readTree(
                """
                {
                  "parcelamentoAceito": true,
                  "quantidadeParcelasInformada": "02",
                  "cabecalho": { "reu": "Maria" },
                  "parcelas": [
                    { "dataVencimento": "01/01/2025", "valorParcela": "R$ 200,00", "dataPagamento": "01/01/2025" },
                    { "dataVencimento": "01/02/2025", "valorParcela": "R$ 200,00", "dataPagamento": "" }
                  ]
                }
                """));
        rodadaRepository.save(e);
        rodadaRepository.flush();

        AcordoDescumpridoProporResponse resp = service.propor(new AcordoDescumpridoProporRequest("88", 3, 0, false));

        assertThat(resp.dimensaoNova()).isEqualTo(1);
        assertThat(resp.parcelasConvertidas()).hasSize(1);
        JsonNode saved = rodadaRepository
                .findByCodigoClienteAndNumeroProcessoAndDimensao("00000088", 3, 1)
                .map(CalculoRodadaEntity::getPayloadJson)
                .orElseThrow();
        assertThat(saved.path("parcelamentoAceito").asBoolean()).isFalse();
        assertThat(saved.path("titulos").size()).isEqualTo(1);
    }
}
