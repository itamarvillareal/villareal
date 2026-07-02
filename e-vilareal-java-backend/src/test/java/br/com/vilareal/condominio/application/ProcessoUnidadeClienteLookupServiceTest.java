package br.com.vilareal.condominio.application;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, "QD12-LT03")).thenReturn(Optional.empty());
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, "QD12LT03")).thenReturn(Optional.of(proc));

        Optional<ProcessoEntity> found = service.buscarPorCodigoUnidade(CLIENTE_ID, "qd12lt03");

        assertThat(found).contains(proc);
    }
}
