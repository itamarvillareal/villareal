package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.ParearCompensacaoItemRequest;
import br.com.vilareal.financeiro.api.dto.ParearCompensacaoRequest;
import br.com.vilareal.financeiro.api.dto.ParearCompensacaoResponse;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
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
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroCompensacaoServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;
    @Mock
    private ContaContabilRepository contaContabilRepository;

    @InjectMocks
    private FinanceiroCompensacaoService service;

    private ContaContabilEntity contaE;
    private LancamentoFinanceiroEntity debito;
    private LancamentoFinanceiroEntity credito;

    @BeforeEach
    void setUp() {
        contaE = new ContaContabilEntity();
        contaE.setId(6L);
        contaE.setCodigo("E");
        contaE.setNome("Conta Compensação");

        debito = new LancamentoFinanceiroEntity();
        debito.setId(1L);
        debito.setValor(new BigDecimal("1000.00"));
        debito.setNatureza(NaturezaLancamento.DEBITO);
        debito.setDataLancamento(LocalDate.of(2026, 3, 1));
        debito.setContaContabil(contaN());

        credito = new LancamentoFinanceiroEntity();
        credito.setId(2L);
        credito.setValor(new BigDecimal("1000.00"));
        credito.setNatureza(NaturezaLancamento.CREDITO);
        credito.setDataLancamento(LocalDate.of(2026, 3, 1));
        credito.setContaContabil(contaN());
    }

    private static ContaContabilEntity contaN() {
        ContaContabilEntity n = new ContaContabilEntity();
        n.setId(5L);
        n.setCodigo("N");
        return n;
    }

    @Test
    void parear_parValido_atualizaContaEGrupoECompensado() {
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("E")).thenReturn(Optional.of(contaE));
        when(lancamentoRepository.findById(1L)).thenReturn(Optional.of(debito));
        when(lancamentoRepository.findById(2L)).thenReturn(Optional.of(credito));
        when(lancamentoRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        ParearCompensacaoItemRequest item = new ParearCompensacaoItemRequest();
        item.setLancamentoIdA(1L);
        item.setLancamentoIdB(2L);
        ParearCompensacaoRequest req = new ParearCompensacaoRequest();
        req.setPares(List.of(item));

        ParearCompensacaoResponse r = service.parear(req);

        assertThat(r.getPareados()).isEqualTo(1);
        assertThat(r.getErros()).isEmpty();
        assertThat(r.getGruposGerados()).hasSize(1);

        ArgumentCaptor<List<LancamentoFinanceiroEntity>> cap = ArgumentCaptor.forClass(List.class);
        verify(lancamentoRepository).saveAll(cap.capture());
        for (LancamentoFinanceiroEntity e : cap.getValue()) {
            assertThat(e.getContaContabil().getCodigo()).isEqualTo("E");
            assertThat(e.getGrupoCompensacao()).startsWith("COMP-");
            assertThat(e.getEtapa()).isEqualTo(EtapaLancamento.COMPENSADO);
        }
    }

    @Test
    void parear_somaForaTolerancia_registraErro() {
        when(contaContabilRepository.findFirstByCodigoIgnoreCase("E")).thenReturn(Optional.of(contaE));
        credito.setValor(new BigDecimal("2000.00"));
        when(lancamentoRepository.findById(1L)).thenReturn(Optional.of(debito));
        when(lancamentoRepository.findById(2L)).thenReturn(Optional.of(credito));

        ParearCompensacaoItemRequest item = new ParearCompensacaoItemRequest();
        item.setLancamentoIdA(1L);
        item.setLancamentoIdB(2L);
        ParearCompensacaoRequest req = new ParearCompensacaoRequest();
        req.setPares(List.of(item));

        ParearCompensacaoResponse r = service.parear(req);

        assertThat(r.getPareados()).isZero();
        assertThat(r.getErros()).hasSize(1);
    }
}
