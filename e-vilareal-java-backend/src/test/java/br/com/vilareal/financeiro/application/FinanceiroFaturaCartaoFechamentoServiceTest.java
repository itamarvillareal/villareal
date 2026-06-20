package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FaturaCartaoFechamentoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoCartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.PagamentoFaturaVinculoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroFaturaCartaoFechamentoServiceTest {

    @Mock
    private LancamentoCartaoRepository lancamentoCartaoRepository;
    @Mock
    private CartaoRepository cartaoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;
    @Mock
    private FaturaCartaoFechamentoRepository fechamentoRepository;
    @Mock
    private PagamentoFaturaVinculoRepository pagamentoFaturaVinculoRepository;
    @Mock
    private FinanceiroSaudeService financeiroSaudeService;

    @InjectMocks
    private FinanceiroFaturaCartaoFechamentoService service;

    private ContaContabilEntity contaE;
    private CartaoEntity cartao;

    @BeforeEach
    void setUp() {
        contaE = new ContaContabilEntity();
        contaE.setId(6L);
        contaE.setCodigo("N");
        contaE.setNome("Conta Não Identificados");

        cartao = new CartaoEntity();
        cartao.setId(8L);
        cartao.setNome("Visa");
        cartao.setAtivo(true);
    }

    @Test
    void aplicarFechamentosAutomaticos_criaAutoFatNoVencimento() {
        LocalDate vencimento = LocalDate.of(2026, 5, 10);
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("N")).thenReturn(Optional.of(contaE));
        when(lancamentoCartaoRepository.findCiclosVencidosParaFechamento(any()))
                .thenReturn(List.<Object[]>of(new Object[] {8L, vencimento}));
        when(lancamentoCartaoRepository.somaComprasCiclo(8L, vencimento))
                .thenReturn(new BigDecimal("1234.56"));
        when(cartaoRepository.findById(8L)).thenReturn(Optional.of(cartao));
        when(fechamentoRepository.findByCartaoIdAndDataVencimento(8L, vencimento)).thenReturn(Optional.empty());
        when(lancamentoCartaoRepository.findByCartaoIdAndNumeroLancamento(8L, "AUTO-FAT-8-2026-05-10"))
                .thenReturn(Optional.empty());
        when(lancamentoCartaoRepository.save(any())).thenAnswer(inv -> {
            LancamentoCartaoEntity e = inv.getArgument(0);
            e.setId(999L);
            return e;
        });

        int n = service.aplicarFechamentosAutomaticos();

        assertThat(n).isEqualTo(1);
        ArgumentCaptor<LancamentoCartaoEntity> cap = ArgumentCaptor.forClass(LancamentoCartaoEntity.class);
        verify(lancamentoCartaoRepository).save(cap.capture());
        LancamentoCartaoEntity salvo = cap.getValue();
        assertThat(salvo.getNumeroLancamento()).isEqualTo("AUTO-FAT-8-2026-05-10");
        assertThat(salvo.getValor()).isEqualByComparingTo("-1234.56");
        assertThat(salvo.getOrigem()).isEqualTo("AUTO");
        assertThat(salvo.getContaContabil().getCodigo()).isEqualTo("N");
        assertThat(salvo.getEtapa()).isEqualTo(EtapaLancamento.IMPORTADO);
        assertThat(salvo.getDataLancamento()).isEqualTo(vencimento);
        verify(fechamentoRepository).save(any());
        verify(financeiroSaudeService).invalidarCacheSaude();
    }

    @Test
    void aplicarFechamentosAutomaticos_naoRecriaSeJaVinculadoAoBanco() {
        LocalDate vencimento = LocalDate.of(2026, 5, 10);
        LancamentoCartaoEntity existente = new LancamentoCartaoEntity();
        existente.setId(50L);
        existente.setValor(new BigDecimal("-1234.56"));
        existente.setContaContabil(contaE);

        var fechamento = new br.com.vilareal.financeiro.infrastructure.persistence.entity.FaturaCartaoFechamentoEntity();
        fechamento.setLancamentoCartao(existente);

        when(contaContabilRepository.findFirstByCodigoIgnoreCase("N")).thenReturn(Optional.of(contaE));
        when(lancamentoCartaoRepository.findCiclosVencidosParaFechamento(any()))
                .thenReturn(List.<Object[]>of(new Object[] {8L, vencimento}));
        when(lancamentoCartaoRepository.somaComprasCiclo(8L, vencimento))
                .thenReturn(new BigDecimal("1234.56"));
        when(cartaoRepository.findById(8L)).thenReturn(Optional.of(cartao));
        when(fechamentoRepository.findByCartaoIdAndDataVencimento(8L, vencimento))
                .thenReturn(Optional.of(fechamento));
        when(pagamentoFaturaVinculoRepository.findByLancamentoCartaoId(50L)).thenReturn(Optional.of(new br.com.vilareal.financeiro.infrastructure.persistence.entity.PagamentoFaturaVinculoEntity()));

        int n = service.aplicarFechamentosAutomaticos();

        assertThat(n).isEqualTo(0);
        verify(lancamentoCartaoRepository, never()).save(any());
    }

    @Test
    void ehLancamentoFechamentoAutomatico_reconhecePrefixo() {
        LancamentoCartaoEntity l = new LancamentoCartaoEntity();
        l.setNumeroLancamento("AUTO-FAT-8-2026-05-10");
        assertThat(FinanceiroFaturaCartaoFechamentoService.ehLancamentoFechamentoAutomatico(l)).isTrue();
    }
}
