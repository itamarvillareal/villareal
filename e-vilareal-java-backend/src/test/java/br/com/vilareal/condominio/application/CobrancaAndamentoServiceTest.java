package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.DebitoNovo;
import br.com.vilareal.calculo.application.ResultadoMerge;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CobrancaAndamentoServiceTest {

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProcessoAndamentoRepository andamentoRepository;

    private CobrancaAndamentoService service;

    @BeforeEach
    void setUp() {
        service = new CobrancaAndamentoService(processoRepository, andamentoRepository);
    }

    @Test
    void registrarAndamentosCobranca_semRevisao_umAndamentoComImportacaoId() {
        ProcessoEntity proc = new ProcessoEntity();
        proc.setId(10L);
        when(processoRepository.findById(10L)).thenReturn(Optional.of(proc));
        when(andamentoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResolucaoUnidade res = new ResolucaoUnidade(1L, false, null, 10L, 5, false, true, false, null);
        ResultadoMerge merge = new ResultadoMerge(
                List.of(new ResultadoMerge.DimensaoTocada(
                        0, false, List.of(new ResultadoMerge.InsercaoDebito(0, 0, new DebitoNovo("10/04/2026", 10000L, "Taxa"))))),
                List.of());

        service.registrarAndamentosCobranca(10L, "imp-uuid", res, merge);

        ArgumentCaptor<ProcessoAndamentoEntity> cap = ArgumentCaptor.forClass(ProcessoAndamentoEntity.class);
        verify(andamentoRepository, times(1)).save(cap.capture());
        ProcessoAndamentoEntity a = cap.getValue();
        assertThat(a.getOrigem()).isEqualTo(CobrancaAndamentoService.ORIGEM_COBRANCA_AUTOMATICA);
        assertThat(a.getImportacaoId()).isEqualTo("imp-uuid");
        assertThat(a.getOrigemAutomatica()).isTrue();
        assertThat(a.getDetalhe()).contains("Débitos inseridos: 1");
    }

    @Test
    void registrarAndamentosCobranca_comRevisao_doisAndamentos() {
        ProcessoEntity proc = new ProcessoEntity();
        proc.setId(11L);
        when(processoRepository.findById(11L)).thenReturn(Optional.of(proc));
        when(andamentoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        ResolucaoUnidade res = new ResolucaoUnidade(2L, true, "F", 11L, 7, true, true, true, 99L);
        ResultadoMerge merge = new ResultadoMerge(List.of(), List.of());

        service.registrarAndamentosCobranca(11L, "imp-2", res, merge);

        ArgumentCaptor<ProcessoAndamentoEntity> cap = ArgumentCaptor.forClass(ProcessoAndamentoEntity.class);
        verify(andamentoRepository, times(2)).save(cap.capture());
        assertThat(cap.getAllValues().get(0).getOrigem()).isEqualTo(CobrancaAndamentoService.ORIGEM_COBRANCA_AUTOMATICA);
        assertThat(cap.getAllValues().get(1).getOrigem()).isEqualTo(CobrancaAndamentoService.ORIGEM_REVISAO_TROCA_DONO);
        assertThat(cap.getAllValues().get(1).getDetalhe()).contains("RÉU anterior");
    }
}
