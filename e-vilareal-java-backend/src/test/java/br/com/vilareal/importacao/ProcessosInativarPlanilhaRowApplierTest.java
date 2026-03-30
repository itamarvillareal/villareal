package br.com.vilareal.importacao;

import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessosInativarPlanilhaRowApplierTest {

    @Mock
    private ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProcessoApplicationService processoApplicationService;

    @InjectMocks
    private ProcessosInativarPlanilhaRowApplier applier;

    @Test
    void inativa_quandoEncontrado() {
        when(clienteCodigoPessoaResolver.resolverPessoaId("00000024")).thenReturn(24L);
        ProcessoEntity e = new ProcessoEntity();
        e.setId(77L);
        when(processoRepository.findByPessoa_IdAndNumeroInterno(24L, 3)).thenReturn(Optional.of(e));

        ProcessosInativarPlanilhaRowApplier.Resultado r = applier.aplicar("00000024", 3);

        assertThat(r.inativado()).isTrue();
        assertThat(r.processoId()).isEqualTo(77L);
        verify(processoApplicationService).patchAtivo(77L, false);
    }

    @Test
    void naoEncontrado_quandoSemProcesso() {
        when(clienteCodigoPessoaResolver.resolverPessoaId("7")).thenReturn(7L);
        when(processoRepository.findByPessoa_IdAndNumeroInterno(7L, 99)).thenReturn(Optional.empty());

        ProcessosInativarPlanilhaRowApplier.Resultado r = applier.aplicar("7", 99);

        assertThat(r.inativado()).isFalse();
        assertThat(r.processoId()).isNull();
    }
}
