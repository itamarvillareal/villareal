package br.com.vilareal.mensalista.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.mensalista.infrastructure.persistence.entity.MensalistaEntity;
import br.com.vilareal.mensalista.infrastructure.persistence.repository.MensalistaRepository;
import br.com.vilareal.pagamento.api.dto.PagamentoResponse;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class MensalistaApplicationServiceTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 6, 15);

    @Mock
    private MensalistaRepository mensalistaRepository;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private PagamentoRepository pagamentoRepository;
    @Mock
    private PagamentoApplicationService pagamentoApplicationService;

    private MensalistaApplicationService service;

    @BeforeEach
    void setUp() {
        Clock clock = Clock.fixed(Instant.parse("2026-06-15T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));
        service = new MensalistaApplicationService(
                mensalistaRepository, clienteRepository, pagamentoRepository, pagamentoApplicationService, clock);
    }

    @Test
    void vigenteNoMesRespeitaAtivoEIntervalo() {
        MensalistaEntity m = mensalistaAtivo(10, LocalDate.of(2026, 1, 1), null);
        assertThat(MensalistaApplicationService.vigenteNoMes(m, java.time.YearMonth.of(2026, 6))).isTrue();

        m.setAtivo(false);
        assertThat(MensalistaApplicationService.vigenteNoMes(m, java.time.YearMonth.of(2026, 6))).isFalse();

        m.setAtivo(true);
        m.setDataInicio(LocalDate.of(2026, 7, 1));
        assertThat(MensalistaApplicationService.vigenteNoMes(m, java.time.YearMonth.of(2026, 6))).isFalse();

        m.setDataInicio(LocalDate.of(2026, 1, 1));
        m.setDataFim(LocalDate.of(2026, 5, 31));
        assertThat(MensalistaApplicationService.vigenteNoMes(m, java.time.YearMonth.of(2026, 6))).isFalse();
    }

    @Test
    void gerarRecebivelSeNecessarioIdempotente() {
        MensalistaEntity m = mensalistaAtivo(10, LocalDate.of(2026, 1, 1), null);
        m.setId(7L);
        ClienteEntity c = new ClienteEntity();
        c.setId(42L);
        m.setCliente(c);

        PagamentoEntity existente = new PagamentoEntity();
        existente.setId(99L);
        when(pagamentoRepository.findFirstByOrigemAndMesReferencia("MENSALISTA:7", "2026-06"))
                .thenReturn(Optional.of(existente));

        var r = service.gerarRecebivelSeNecessario(m, "2026-06", java.time.YearMonth.of(2026, 6));
        assertThat(r.resultado()).isEqualTo("JA_EXISTIA");
        assertThat(r.pagamentoId()).isEqualTo(99L);
        verify(pagamentoApplicationService, never()).criar(any());
    }

    @Test
    void gerarRecebivelSeNecessarioCriaPagamento() {
        MensalistaEntity m = mensalistaAtivo(31, LocalDate.of(2026, 1, 1), null);
        m.setId(3L);
        m.setValor(new BigDecimal("1500.00"));
        ClienteEntity c = new ClienteEntity();
        c.setId(5L);
        c.setNomeReferencia("Cliente Teste");
        m.setCliente(c);

        when(pagamentoRepository.findFirstByOrigemAndMesReferencia("MENSALISTA:3", "2026-06"))
                .thenReturn(Optional.empty());
        PagamentoResponse resp = new PagamentoResponse();
        resp.setId(200L);
        when(pagamentoApplicationService.criar(any())).thenReturn(resp);

        var r = service.gerarRecebivelSeNecessario(m, "2026-06", java.time.YearMonth.of(2026, 6));
        assertThat(r.resultado()).isEqualTo("GERADO");
        assertThat(r.pagamentoId()).isEqualTo(200L);

        ArgumentCaptor<br.com.vilareal.pagamento.api.dto.PagamentoWriteRequest> cap =
                ArgumentCaptor.forClass(br.com.vilareal.pagamento.api.dto.PagamentoWriteRequest.class);
        verify(pagamentoApplicationService).criar(cap.capture());
        assertThat(cap.getValue().getTipo()).isEqualTo("RECEBER");
        assertThat(cap.getValue().getCategoria()).isEqualTo("MENSALIDADE");
        assertThat(cap.getValue().getOrigem()).isEqualTo("MENSALISTA:3");
        assertThat(cap.getValue().getMesReferencia()).isEqualTo("2026-06");
        assertThat(cap.getValue().getDataVencimento()).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(cap.getValue().getClienteId()).isEqualTo(5L);
    }

    @Test
    void gerarMesContaGeradosIgnoradosEJaExistiam() {
        MensalistaEntity vigente = mensalistaAtivo(5, LocalDate.of(2026, 1, 1), null);
        vigente.setId(1L);
        vigente.setCliente(cliente(10L));
        MensalistaEntity fora = mensalistaAtivo(5, LocalDate.of(2027, 1, 1), null);
        fora.setId(2L);
        fora.setCliente(cliente(11L));

        when(mensalistaRepository.findAtivosComCliente()).thenReturn(List.of(vigente, fora));
        when(pagamentoRepository.findFirstByOrigemAndMesReferencia("MENSALISTA:1", "2026-06"))
                .thenReturn(Optional.empty());
        PagamentoResponse resp = new PagamentoResponse();
        resp.setId(50L);
        when(pagamentoApplicationService.criar(any())).thenReturn(resp);

        var resultado = service.gerarMes("2026-06");
        assertThat(resultado.getMesReferencia()).isEqualTo("2026-06");
        assertThat(resultado.getTotalMensalistas()).isEqualTo(2);
        assertThat(resultado.getGerados()).isEqualTo(1);
        assertThat(resultado.getIgnorados()).isEqualTo(1);
        assertThat(resultado.getJaExistiam()).isZero();
    }

    @Test
    void parseMesReferenciaRejeitaFormatoInvalido() {
        assertThatThrownBy(() -> MensalistaApplicationService.parseMesReferencia("06/2026"))
                .isInstanceOf(BusinessRuleException.class);
    }

    private static MensalistaEntity mensalistaAtivo(int dia, LocalDate inicio, LocalDate fim) {
        MensalistaEntity m = new MensalistaEntity();
        m.setDiaVencimento(dia);
        m.setDataInicio(inicio);
        m.setDataFim(fim);
        m.setAtivo(true);
        m.setValor(new BigDecimal("100.00"));
        return m;
    }

    private static ClienteEntity cliente(Long id) {
        ClienteEntity c = new ClienteEntity();
        c.setId(id);
        return c;
    }
}
