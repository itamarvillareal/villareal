package br.com.vilareal.acoes.application;

import br.com.vilareal.documento.api.dto.RepassePendenteHonorarioCarteiraResponse;
import br.com.vilareal.calculo.api.dto.CalculoParcelamentosConsolidadoResponse;
import br.com.vilareal.calculo.application.CalculoParcelamentosConsolidadoApplicationService;
import br.com.vilareal.documento.application.HonorarioRepasseService;
import br.com.vilareal.imovel.api.dto.CreditoCandidatoAluguelItem;
import br.com.vilareal.imovel.api.dto.RepassePendenteCarteiraResponse;
import br.com.vilareal.imovel.api.dto.RepassePendenteItemResponse;
import br.com.vilareal.imovel.application.LocacaoReconciliacaoService;
import br.com.vilareal.documento.domain.StatusRepasseHonorario;
import br.com.vilareal.imovel.domain.StatusRepasse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroItemResponse;
import br.com.vilareal.recebivel.api.dto.RecebivelQuadroResponse;
import br.com.vilareal.recebivel.application.RecebivelQuadroApplicationService;
import br.com.vilareal.recebivel.domain.RecebivelQuadroStatus;
import br.com.vilareal.recebivel.domain.RecebivelQuadroTipo;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AcoesDoDiaApplicationServiceTest {

    private static final Clock CLOCK =
            Clock.fixed(Instant.parse("2026-06-21T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));

    @Mock
    private RecebivelQuadroApplicationService quadroService;
    @Mock
    private LocacaoReconciliacaoService locacaoReconciliacaoService;
    @Mock
    private HonorarioRepasseService honorarioRepasseService;
    @Mock
    private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock
    private PagamentoRepository pagamentoRepository;
    @Mock
    private CalculoParcelamentosConsolidadoApplicationService parcelamentosConsolidadoService;

    @InjectMocks
    private AcoesDoDiaApplicationService service;

    private ContratoLocacaoEntity contrato;

    @BeforeEach
    void setUp() {
        service = new AcoesDoDiaApplicationService(
                quadroService,
                locacaoReconciliacaoService,
                honorarioRepasseService,
                contratoLocacaoRepository,
                pagamentoRepository,
                parcelamentosConsolidadoService,
                CLOCK);
        contrato = new ContratoLocacaoEntity();
        contrato.setId(10L);
        contrato.setValorAluguel(new BigDecimal("1700.00"));
        contrato.setDiaVencimentoAluguel(5);
        PessoaEntity locador = new PessoaEntity();
        locador.setNome("Maria Locadora");
        contrato.setLocadorPessoa(locador);
        ImovelEntity imovel = new ImovelEntity();
        imovel.setNumeroPlanilha(42);
        imovel.setEnderecoCompleto("Rua Teste, 1");
        contrato.setImovel(imovel);
        when(parcelamentosConsolidadoService.listarConsolidado(
                        any(), any(), eq("vencidas"), any(), any(), any(), eq(false), eq(0), eq(50)))
                .thenReturn(new CalculoParcelamentosConsolidadoResponse(List.of(), 0, new br.com.vilareal.calculo.api.dto.CalculoParcelamentosConsolidadoResumo(0, 0, 0, 0, 0, 0, 0, 0)));
    }

    @Test
    void obterSeparaConciliarECobrarAluguel() {
        when(contratoLocacaoRepository.findVigentesSemAluguelNaCompetencia(
                        eq("2026-06"), any(), any()))
                .thenReturn(List.of(contrato));
        when(locacaoReconciliacaoService.creditosCandidatosAluguelSemClassificar(10L, "2026-06"))
                .thenReturn(List.of(new CreditoCandidatoAluguelItem(
                        99L, LocalDate.of(2026, 6, 10), new BigDecimal("1700.00"), "PIX MARIA")));
        when(honorarioRepasseService.candidatosAlvara()).thenReturn(List.of());
        when(quadroService.quadro(any(), any(), any()))
                .thenReturn(new RecebivelQuadroResponse(
                        LocalDate.of(2026, 6, 1),
                        LocalDate.of(2026, 6, 30),
                        BigDecimal.ZERO,
                        BigDecimal.ZERO,
                        List.of(),
                        List.of()));
        when(locacaoReconciliacaoService.repassesPendentes(null))
                .thenReturn(new RepassePendenteCarteiraResponse(
                        new BigDecimal("3570.00"),
                        List.of(
                                new RepassePendenteItemResponse(
                                        4L,
                                        4,
                                        "End",
                                        "Locador",
                                        "{}",
                                        "2026-05",
                                        new BigDecimal("1700"),
                                        null,
                                        null,
                                        new BigDecimal("1530"),
                                        BigDecimal.ZERO,
                                        new BigDecimal("1530"),
                                        StatusRepasse.PENDENTE),
                                new RepassePendenteItemResponse(
                                        4L,
                                        4,
                                        "End",
                                        "Locador",
                                        "{}",
                                        "2026-06",
                                        new BigDecimal("2300"),
                                        null,
                                        null,
                                        new BigDecimal("2070"),
                                        BigDecimal.ZERO,
                                        new BigDecimal("2070"),
                                        StatusRepasse.PENDENTE))));
        when(honorarioRepasseService.repassesPendentesHonorario())
                .thenReturn(new RepassePendenteHonorarioCarteiraResponse(
                        new BigDecimal("6500.00"),
                        List.of(new br.com.vilareal.documento.api.dto.RepassePendenteHonorarioItemResponse(
                                1L,
                                9L,
                                500L,
                                "00000966",
                                12,
                                100L,
                                LocalDate.of(2026, 6, 12),
                                1L,
                                "Cliente Contratante",
                                new BigDecimal("10000.00"),
                                new BigDecimal("35.00"),
                                new BigDecimal("3500.00"),
                                new BigDecimal("6500.00"),
                                BigDecimal.ZERO,
                                new BigDecimal("6500.00"),
                                StatusRepasseHonorario.PENDENTE,
                                false))));
        when(contratoLocacaoRepository.findVigentesComDataFimEntre(any(), any())).thenReturn(List.of());
        when(pagamentoRepository.findPagarAbertosAteVencimento(any())).thenReturn(List.of());

        var resp = service.obter("2026-06");

        assertThat(resp.conciliar().quantidade()).isEqualTo(1);
        assertThat(resp.conciliar().itens().get(0).candidatos()).hasSize(1);
        assertThat(resp.cobrar().quantidade()).isZero();
        assertThat(resp.repassar().quantidade()).isEqualTo(3);
        assertThat(resp.repassar().itens().stream().filter(i -> "PROCESSO".equals(i.origem())).count())
                .isEqualTo(1);
        assertThat(resp.repassar().itens().stream().filter(i -> "IMOVEL".equals(i.origem())).count())
                .isEqualTo(2);
        assertThat(resp.repassar().itens().get(0).competencia()).isEqualTo("2026-05");
        assertThat(resp.repassar().itens().get(1).competencia()).isEqualTo("2026-06");
        assertThat(resp.pagar().quantidade()).isZero();
    }
}
