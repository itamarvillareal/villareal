package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.FecharMesRequest;
import br.com.vilareal.financeiro.api.dto.FecharMesResponse;
import br.com.vilareal.financeiro.api.dto.ReabrirMesResponse;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class FinanceiroMesApplicationServiceTest {

    @Mock
    private LancamentoFinanceiroRepository lancamentoRepository;

    @InjectMocks
    private FinanceiroMesApplicationService service;

    @Test
    void fecharMes_comImportado_retornaErroSemFechar() {
        LancamentoFinanceiroEntity pendente = lancamento(EtapaLancamento.IMPORTADO);
        when(lancamentoRepository.findByNumeroBancoAndMes(any(), any(), any())).thenReturn(List.of(pendente));

        FecharMesRequest req = new FecharMesRequest();
        req.setAno(2026);
        req.setMes(3);
        req.setNumeroBanco(1);

        FecharMesResponse r = service.fecharMes(req);

        assertThat(r.getFechados()).isZero();
        assertThat(r.getPendentes()).isEqualTo(1);
        assertThat(r.getErros()).hasSize(1);
    }

    @Test
    void fecharMes_semPendentes_fechaTodos() {
        LancamentoFinanceiroEntity ok = lancamento(EtapaLancamento.CLASSIFICADO);
        when(lancamentoRepository.findByNumeroBancoAndMes(any(), any(), any())).thenReturn(List.of(ok));
        when(lancamentoRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        FecharMesRequest req = new FecharMesRequest();
        req.setAno(2026);
        req.setMes(3);
        req.setNumeroBanco(1);

        FecharMesResponse r = service.fecharMes(req);

        assertThat(r.getFechados()).isEqualTo(1);
        assertThat(ok.getEtapa()).isEqualTo(EtapaLancamento.FECHADO);
        verify(lancamentoRepository).saveAll(any());
    }

    @Test
    void reabrirMes_recalculaEtapa() {
        LancamentoFinanceiroEntity fechado = lancamento(EtapaLancamento.FECHADO);
        fechado.getContaContabil().setCodigo("A");
        when(lancamentoRepository.findByNumeroBancoAndMes(any(), any(), any())).thenReturn(List.of(fechado));
        when(lancamentoRepository.saveAll(any())).thenAnswer(inv -> inv.getArgument(0));

        FecharMesRequest req = new FecharMesRequest();
        req.setAno(2026);
        req.setMes(3);
        req.setNumeroBanco(1);

        ReabrirMesResponse r = service.reabrirMes(req);

        assertThat(r.getReabertos()).isEqualTo(1);
        assertThat(fechado.getEtapa()).isEqualTo(EtapaLancamento.CLASSIFICADO);
    }

    private static LancamentoFinanceiroEntity lancamento(EtapaLancamento etapa) {
        ContaContabilEntity conta = new ContaContabilEntity();
        conta.setId(5L);
        conta.setCodigo("N");
        LancamentoFinanceiroEntity e = new LancamentoFinanceiroEntity();
        e.setId(10L);
        e.setEtapa(etapa);
        e.setContaContabil(conta);
        e.setDataLancamento(LocalDate.of(2026, 3, 5));
        e.setDescricao("TESTE");
        return e;
    }
}
