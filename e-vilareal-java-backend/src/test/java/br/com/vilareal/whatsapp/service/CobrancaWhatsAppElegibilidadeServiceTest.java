package br.com.vilareal.whatsapp.service;

import br.com.vilareal.calculo.application.CalculoApplicationService;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.whatsapp.config.CobrancaWhatsAppProperties;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CobrancaWhatsAppElegibilidadeServiceTest {

    private static final String COD8 = "00000928";

    @Mock
    private CalculoApplicationService calculoApplicationService;

    @Mock
    private CalculoRodadaRepository calculoRodadaRepository;

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private PagamentoRepository pagamentoRepository;

    private CobrancaWhatsAppElegibilidadeService service;
    private final ObjectMapper objectMapper = new ObjectMapper();
    private final CobrancaWhatsAppProperties cobrancaWhatsAppProperties = new CobrancaWhatsAppProperties();

    @BeforeEach
    void setUp() {
        service = new CobrancaWhatsAppElegibilidadeService(
                calculoApplicationService,
                calculoRodadaRepository,
                processoRepository,
                pagamentoRepository,
                cobrancaWhatsAppProperties);
    }

    @Test
    void avaliarProcessoEscritorio_semRodada_inelegivel() {
        when(calculoApplicationService.obterRodada(COD8, 13, 0)).thenReturn(Optional.empty());
        when(calculoRodadaRepository.findByCodigoClienteAndNumeroProcessoAndDimensao(COD8, 13, 0))
                .thenReturn(Optional.empty());

        var av = service.avaliarProcessoEscritorio(COD8, 13);

        assertThat(av.elegivelCobranca()).isFalse();
        assertThat(av.motivoInelegivel()).contains("Sem cálculo");
    }

    @Test
    void avaliarProcessoEscritorio_debitosQuitados_inelegivel() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.putObject("meta").put("dataCalculo", "01/06/2026");
        var debito = payload.putArray("debitos").addObject();
        debito.put("valor", "100");
        debito.put("dataPagamento", "10/06/2026");
        mockRodada(10, payload, false);

        var av = service.avaliarProcessoEscritorio(COD8, 10);

        assertThat(av.elegivelCobranca()).isFalse();
        assertThat(av.motivoInelegivel()).contains("Quitado");
    }

    @Test
    void avaliarProcessoEscritorio_debitoAberto_elegivel() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.putObject("meta").put("dataCalculo", "01/06/2026");
        var debito = payload.putArray("debitos").addObject();
        debito.put("valor", "259");
        debito.put("honorarios", "55,78");
        mockRodada(1, payload, true);

        var av = service.avaliarProcessoEscritorio(COD8, 1);

        assertThat(av.elegivelCobranca()).isTrue();
        assertThat(av.debitosAbertos()).isEqualTo(1);
        assertThat(av.valorDebitoAberto()).isEqualByComparingTo(new BigDecimal("314.77"));
        assertThat(av.calculoDesatualizado()).isFalse();
    }

    @Test
    void avaliarProcessoEscritorio_calculoAntigo_marcaDesatualizado() throws Exception {
        ObjectNode payload = objectMapper.createObjectNode();
        payload.putObject("meta").put("dataCalculo", "11/04/2024");
        var debito = payload.putArray("debitos").addObject();
        debito.put("valor", "100");
        mockRodada(1, payload, false);

        var av = service.avaliarProcessoEscritorio(COD8, 1);

        assertThat(av.elegivelCobranca()).isTrue();
        assertThat(av.calculoDesatualizado()).isTrue();
    }

    @Test
    void dataCalculoDesatualizada_anoInvalido() {
        assertThat(service.dataCalculoDesatualizada("14/01/1900")).isTrue();
    }

    @Test
    void parseDataBr_valido() {
        assertThat(CobrancaWhatsAppElegibilidadeService.parseDataBr("09/04/2024"))
                .isEqualTo(LocalDate.of(2024, 4, 9));
    }

    private void mockRodada(int proc, ObjectNode payload, boolean parcelamentoAceito) {
        when(calculoApplicationService.obterRodada(COD8, proc, 0)).thenReturn(Optional.of(payload));
        CalculoRodadaEntity entity = new CalculoRodadaEntity();
        entity.setParcelamentoAceito(parcelamentoAceito);
        when(calculoRodadaRepository.findByCodigoClienteAndNumeroProcessoAndDimensao(COD8, proc, 0))
                .thenReturn(Optional.of(entity));
    }
}
