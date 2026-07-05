package br.com.vilareal.calculo.application;

import br.com.vilareal.AbstractIntegrationTest;
import br.com.vilareal.calculo.api.dto.CalculoParcelamentosConsolidadoResponse;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.transaction.annotation.Transactional;

import static org.assertj.core.api.Assertions.assertThat;

class CalculoParcelamentosConsolidadoApplicationServiceIntegrationTest extends AbstractIntegrationTest {

    @Autowired
    private CalculoParcelamentosConsolidadoApplicationService service;

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
    void listarConsolidado_parcelamentoAceitoComParcelaVencida() throws Exception {
        CalculoRodadaEntity e = new CalculoRodadaEntity();
        e.setCodigoCliente("00000099");
        e.setNumeroProcesso(7);
        e.setDimensao(1);
        e.setParcelamentoAceito(true);
        e.setPayloadJson(objectMapper.readTree(
                """
                {
                  "parcelamentoAceito": true,
                  "quantidadeParcelasInformada": "02",
                  "cabecalho": { "reu": "João Teste" },
                  "parcelas": [
                    { "dataVencimento": "01/01/2020", "valorParcela": "R$ 100,00", "honorariosParcela": "R$ 10,00", "dataPagamento": "" },
                    { "dataVencimento": "01/02/2020", "valorParcela": "R$ 100,00", "honorariosParcela": "", "dataPagamento": "01/02/2020" }
                  ]
                }
                """));
        rodadaRepository.save(e);
        rodadaRepository.flush();

        CalculoParcelamentosConsolidadoResponse resp =
                service.listarConsolidado(null, null, "vencidas", null, null, "diasAtraso", false, 0, 50);

        assertThat(resp.total()).isGreaterThanOrEqualTo(1);
        assertThat(resp.itens()).anyMatch(i -> i.numeroProcesso() == 7 && i.dimensao() == 1 && "VENCIDA".equals(i.situacao()));
        assertThat(resp.resumo().vencidas()).isGreaterThanOrEqualTo(1);
    }
}
