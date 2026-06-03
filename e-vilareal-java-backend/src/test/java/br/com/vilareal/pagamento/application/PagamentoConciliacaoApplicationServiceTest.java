package br.com.vilareal.pagamento.application;

import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoHistoricoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
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
import java.util.Set;

import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PagamentoConciliacaoApplicationServiceTest {

    private static final LocalDate INI = LocalDate.of(2026, 6, 1);
    private static final LocalDate FIM = LocalDate.of(2026, 6, 30);

    @Mock
    private PagamentoRepository pagamentoRepository;
    @Mock
    private PagamentoHistoricoRepository historicoRepository;
    @Mock
    private LancamentoFinanceiroRepository lancamentoFinanceiroRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private PagamentoApplicationService pagamentoApplicationService;

    @InjectMocks
    private PagamentoConciliacaoApplicationService service;

    @Test
    void sugestoesConciliacao_receberUsaCreditos() {
        service = new PagamentoConciliacaoApplicationService(
                pagamentoRepository,
                historicoRepository,
                lancamentoFinanceiroRepository,
                usuarioRepository,
                pagamentoApplicationService,
                Clock.fixed(Instant.parse("2026-06-02T12:00:00Z"), ZoneId.of("America/Sao_Paulo")));

        when(pagamentoRepository.findCandidatosConciliacao(
                        eq(PagamentoDominio.TIPO_PAGAR), eq(Set.of(
                                PagamentoDominio.ST_AGENDADO,
                                PagamentoDominio.ST_PAGO_CONFIRMADO,
                                PagamentoDominio.ST_PAGO_SEM_COMPROVANTE,
                                PagamentoDominio.ST_CONFERENCIA_PENDENTE)),
                        eq(INI),
                        eq(FIM)))
                .thenReturn(List.of());
        when(pagamentoRepository.findCandidatosConciliacao(
                        eq(PagamentoDominio.TIPO_RECEBER),
                        eq(Set.of(
                                PagamentoDominio.ST_EMITIDO,
                                PagamentoDominio.ST_VENCIDO,
                                PagamentoDominio.ST_RECEBIDO)),
                        eq(INI),
                        eq(FIM)))
                .thenReturn(List.of(recebivel(1L)));
        when(lancamentoFinanceiroRepository.findDebitosNaoVinculadosPagamento(
                        eq(NaturezaLancamento.DEBITO), eq(INI), eq(FIM.plusDays(5)), eq(null)))
                .thenReturn(List.of());
        when(lancamentoFinanceiroRepository.findDebitosNaoVinculadosPagamento(
                        eq(NaturezaLancamento.CREDITO), eq(INI), eq(FIM.plusDays(5)), eq(null)))
                .thenReturn(List.of(credito(99L)));

        service.sugestoesConciliacao(INI, FIM, null);

        verify(lancamentoFinanceiroRepository)
                .findDebitosNaoVinculadosPagamento(eq(NaturezaLancamento.CREDITO), eq(INI), eq(FIM.plusDays(5)), eq(null));
        verify(lancamentoFinanceiroRepository)
                .findDebitosNaoVinculadosPagamento(eq(NaturezaLancamento.DEBITO), eq(INI), eq(FIM.plusDays(5)), eq(null));
    }

    private static PagamentoEntity recebivel(Long id) {
        PagamentoEntity e = new PagamentoEntity();
        e.setId(id);
        e.setTipo(PagamentoDominio.TIPO_RECEBER);
        e.setStatus(PagamentoDominio.ST_RECEBIDO);
        e.setDataVencimento(LocalDate.of(2026, 6, 10));
        e.setValor(new BigDecimal("200.00"));
        e.setDescricao("Cobrança cliente");
        e.setCategoria("CLIENTE");
        e.setFormaPagamento("BOLETO");
        e.setPrioridade("NORMAL");
        return e;
    }

    private static LancamentoFinanceiroEntity credito(Long id) {
        LancamentoFinanceiroEntity l = new LancamentoFinanceiroEntity();
        l.setId(id);
        l.setNatureza(NaturezaLancamento.CREDITO);
        l.setDataLancamento(LocalDate.of(2026, 6, 11));
        l.setValor(new BigDecimal("200.00"));
        l.setDescricao("Recebimento boleto");
        return l;
    }
}
