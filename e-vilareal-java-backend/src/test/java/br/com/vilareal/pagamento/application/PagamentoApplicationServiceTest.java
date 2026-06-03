package br.com.vilareal.pagamento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pagamento.api.dto.*;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoHistoricoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoHistoricoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.usuario.application.UsuarioDestinatarioGuard;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

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
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class PagamentoApplicationServiceTest {

    private static final LocalDate HOJE = LocalDate.of(2026, 6, 2);
    private static final Clock CLOCK = Clock.fixed(Instant.parse("2026-06-02T12:00:00Z"), ZoneId.of("America/Sao_Paulo"));

    @Mock
    private PagamentoRepository pagamentoRepository;
    @Mock
    private PagamentoHistoricoRepository historicoRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private UsuarioDestinatarioGuard usuarioDestinatarioGuard;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private ProcessoRepository processoRepository;
    @Mock
    private ImovelRepository imovelRepository;
    @Mock
    private ContratoLocacaoRepository contratoLocacaoRepository;

    private PagamentoApplicationService service;

    private UsuarioEntity usuario;

    @BeforeEach
    void setUp() {
        service = new PagamentoApplicationService(
                pagamentoRepository,
                historicoRepository,
                usuarioRepository,
                usuarioDestinatarioGuard,
                clienteRepository,
                processoRepository,
                imovelRepository,
                contratoLocacaoRepository,
                System.getProperty("java.io.tmpdir") + "/vilareal-pagamentos-test",
                CLOCK);
        usuario = new UsuarioEntity();
        usuario.setId(1L);
        usuario.setLogin("admin");
        usuario.setNome("Admin");
        UsernamePasswordAuthenticationToken auth = new UsernamePasswordAuthenticationToken("admin", "x", List.of());
        SecurityContextHolder.getContext().setAuthentication(auth);
        lenient().when(usuarioRepository.findWithPerfilByLoginIgnoreCase("admin")).thenReturn(Optional.of(usuario));
    }

    @Test
    void criar_semTipo_nascePagarPendente() {
        when(pagamentoRepository.save(any())).thenAnswer(inv -> {
            PagamentoEntity e = inv.getArgument(0);
            e.setId(10L);
            return e;
        });
        when(historicoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PagamentoWriteRequest req = baseWrite();
        req.setStatus(null);

        PagamentoResponse r = service.criar(req);

        assertThat(r.getTipo()).isEqualTo(PagamentoDominio.TIPO_PAGAR);
        assertThat(r.getStatus()).isEqualTo(PagamentoDominio.ST_PENDENTE);

        ArgumentCaptor<PagamentoEntity> cap = ArgumentCaptor.forClass(PagamentoEntity.class);
        verify(pagamentoRepository).save(cap.capture());
        assertThat(cap.getValue().getTipo()).isEqualTo(PagamentoDominio.TIPO_PAGAR);
    }

    @Test
    void regressaoPagar_fluxoCompleto() {
        PagamentoEntity e = pagarBase(1L, PagamentoDominio.ST_PENDENTE);
        when(pagamentoRepository.findById(1L)).thenReturn(Optional.of(e));
        when(pagamentoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(historicoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service.marcarAgendado(1L);
        assertThat(e.getStatus()).isEqualTo(PagamentoDominio.ST_AGENDADO);

        PagamentoMarcarPagoRequest pagoReq = new PagamentoMarcarPagoRequest();
        pagoReq.setDataPagamentoEfetivo(HOJE);
        service.marcarPago(1L, pagoReq);
        assertThat(e.getStatus()).isEqualTo(PagamentoDominio.ST_PAGO_CONFIRMADO);
    }

    @Test
    void criarReceber_nasceEmitido() {
        when(pagamentoRepository.save(any())).thenAnswer(inv -> {
            PagamentoEntity ent = inv.getArgument(0);
            ent.setId(20L);
            return ent;
        });
        when(historicoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PagamentoWriteRequest req = baseWrite();
        req.setTipo(PagamentoDominio.TIPO_RECEBER);

        PagamentoResponse r = service.criar(req);

        assertThat(r.getTipo()).isEqualTo(PagamentoDominio.TIPO_RECEBER);
        assertThat(r.getStatus()).isEqualTo(PagamentoDominio.ST_EMITIDO);
    }

    @Test
    void marcarRecebido_transicaoInvalida_lanca422() {
        PagamentoEntity e = receberBase(2L, PagamentoDominio.ST_EMITIDO);
        when(pagamentoRepository.findById(2L)).thenReturn(Optional.of(e));

        PagamentoMarcarRecebidoRequest req = new PagamentoMarcarRecebidoRequest();
        req.setDataRecebimento(HOJE);
        req.setValorRecebido(new BigDecimal("100.00"));

        e.setStatus(PagamentoDominio.ST_CONCILIADO);
        assertThatThrownBy(() -> service.marcarRecebido(2L, req)).isInstanceOf(BusinessRuleException.class);
    }

    @Test
    void marcarRecebido_emitidoParaRecebido() {
        PagamentoEntity e = receberBase(3L, PagamentoDominio.ST_EMITIDO);
        when(pagamentoRepository.findById(3L)).thenReturn(Optional.of(e));
        when(pagamentoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(historicoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        PagamentoMarcarRecebidoRequest req = new PagamentoMarcarRecebidoRequest();
        req.setDataRecebimento(HOJE);

        PagamentoResponse r = service.marcarRecebido(3L, req);

        assertThat(r.getStatus()).isEqualTo(PagamentoDominio.ST_RECEBIDO);
        assertThat(r.getDataRecebimento()).isEqualTo(HOJE);
    }

    @Test
    void dashboard_receberNaoEntraNoTotalAPagar() {
        PagamentoEntity pagar = pagarBase(1L, PagamentoDominio.ST_PENDENTE);
        pagar.setDataVencimento(HOJE);
        pagar.setValor(new BigDecimal("500.00"));

        PagamentoEntity receber = receberBase(2L, PagamentoDominio.ST_EMITIDO);
        receber.setDataVencimento(HOJE);
        receber.setValor(new BigDecimal("900.00"));

        when(pagamentoRepository.findAll()).thenReturn(List.of(pagar, receber));

        PagamentoDashboardResponse d = service.dashboard(2026, 6);

        assertThat(d.getTotalAPagarMes()).isEqualByComparingTo("500.00");
        assertThat(d.getaReceber()).isNotNull();
        assertThat(d.getaReceber().getTotalAReceber()).isEqualByComparingTo("900.00");
        assertThat(d.getaReceber().getCountAReceber()).isEqualTo(1);
    }

    private static PagamentoWriteRequest baseWrite() {
        PagamentoWriteRequest req = new PagamentoWriteRequest();
        req.setDataVencimento(HOJE);
        req.setValor(new BigDecimal("150.00"));
        req.setDescricao("Teste");
        req.setCategoria("OUTROS");
        req.setFormaPagamento("BOLETO");
        return req;
    }

    private static PagamentoEntity pagarBase(Long id, String status) {
        PagamentoEntity e = new PagamentoEntity();
        e.setId(id);
        e.setTipo(PagamentoDominio.TIPO_PAGAR);
        e.setDataCadastro(HOJE);
        e.setDataVencimento(HOJE.plusDays(5));
        e.setValor(new BigDecimal("150.00"));
        e.setDescricao("Conta");
        e.setCategoria("OUTROS");
        e.setFormaPagamento("BOLETO");
        e.setStatus(status);
        e.setPrioridade("NORMAL");
        return e;
    }

    private static PagamentoEntity receberBase(Long id, String status) {
        PagamentoEntity e = pagarBase(id, status);
        e.setTipo(PagamentoDominio.TIPO_RECEBER);
        e.setDataEmissao(HOJE);
        return e;
    }
}
