package br.com.vilareal.condominio.application;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessoUnidadeClienteLookupServiceTest {

    private static final long CLIENTE_ID = 928L;

    @Mock
    private br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository processoRepository;

    @InjectMocks
    private ProcessoUnidadeClienteLookupService service;

    @Test
    void buscarPorCodigoUnidade_encontraVarianteCondoIdSemHifen() {
        ProcessoEntity proc = new ProcessoEntity();
        proc.setId(1L);
        proc.setNumeroInterno(41);
        when(processoRepository.findAllByCliente_IdAndUnidade(CLIENTE_ID, "QD12-LT03")).thenReturn(List.of());
        when(processoRepository.findAllByCliente_IdAndUnidade(CLIENTE_ID, "QD12LT03")).thenReturn(List.of(proc));

        Optional<ProcessoEntity> found = service.buscarPorCodigoUnidade(CLIENTE_ID, "qd12lt03");

        assertThat(found).contains(proc);
    }

    @Test
    void buscarPorCodigoUnidade_retornaMenorNumeroInternoQuandoHaVarios() {
        ProcessoEntity legado = new ProcessoEntity();
        legado.setId(1L);
        legado.setNumeroInterno(10);
        ProcessoEntity novo = new ProcessoEntity();
        novo.setId(2L);
        novo.setNumeroInterno(200);
        when(processoRepository.findAllByCliente_IdAndUnidade(CLIENTE_ID, "QD01-LT01"))
                .thenReturn(List.of(novo, legado));

        Optional<ProcessoEntity> found = service.buscarPorCodigoUnidade(CLIENTE_ID, "QD01-LT01");

        assertThat(found).contains(legado);
    }
}
