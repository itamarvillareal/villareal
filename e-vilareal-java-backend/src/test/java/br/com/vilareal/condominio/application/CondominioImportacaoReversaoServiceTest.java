package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.condominio.api.dto.InadimplenciaReversaoResponse;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaContatoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaEnderecoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CondominioImportacaoReversaoServiceTest {

    @Mock
    private CalculoRodadaRepository calculoRodadaRepository;

    @Mock
    private ProcessoAndamentoRepository processoAndamentoRepository;

    @Mock
    private ProcessoParteRepository processoParteRepository;

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private PessoaContatoRepository pessoaContatoRepository;

    @Mock
    private PessoaEnderecoRepository pessoaEnderecoRepository;

    @Mock
    private PessoaRepository pessoaRepository;

    private CondominioImportacaoReversaoService service;

    @BeforeEach
    void setUp() {
        service = new CondominioImportacaoReversaoService(
                calculoRodadaRepository,
                processoAndamentoRepository,
                processoParteRepository,
                processoRepository,
                pessoaContatoRepository,
                pessoaEnderecoRepository,
                pessoaRepository);
    }

    @Test
    void reverter_importacaoIdVazio_lanca422() {
        assertThatThrownBy(() -> service.reverter("   "))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("importacaoId");
        verify(processoAndamentoRepository, never()).deleteByImportacaoId(anyString());
        verify(calculoRodadaRepository, never()).deleteByImportacaoId(anyString());
    }

    @Test
    void reverter_nenhumRegistro_lanca404() {
        String id = "00000000-0000-0000-0000-000000000001";
        stubCountsAllZero(id);

        assertThatThrownBy(() -> service.reverter(id))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessage("Importação não encontrada ou já revertida");

        verify(calculoRodadaRepository, never()).deleteByImportacaoId(anyString());
    }

    @Test
    void reverter_apenasAndamentos_encontraImportacaoEReverte() {
        String id = "00000000-0000-0000-0000-000000000099";
        when(processoAndamentoRepository.countByImportacaoId(id)).thenReturn(2L);
        when(calculoRodadaRepository.countByImportacaoId(id)).thenReturn(0L);
        when(processoParteRepository.countByImportacaoId(id)).thenReturn(0L);
        when(processoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaContatoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaEnderecoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaRepository.countByImportacaoId(id)).thenReturn(0L);

        when(processoAndamentoRepository.deleteByImportacaoId(id)).thenReturn(2L);
        when(calculoRodadaRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(processoParteRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(processoRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(pessoaContatoRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(pessoaEnderecoRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(pessoaRepository.deleteByImportacaoId(id)).thenReturn(0L);

        InadimplenciaReversaoResponse res = service.reverter(id);

        assertThat(res.importacaoId()).isEqualTo(id);
        assertThat(res.andamentosRemovidos()).isEqualTo(2L);
        assertThat(res.calculosRemovidos()).isZero();
        verify(processoAndamentoRepository).deleteByImportacaoId(eq(id));
    }

    @Test
    void reverter_executaDeletesNaOrdemERetornaContagens() {
        String id = "00000000-0000-0000-0000-000000000002";
        when(processoAndamentoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(calculoRodadaRepository.countByImportacaoId(id)).thenReturn(1L);
        when(processoParteRepository.countByImportacaoId(id)).thenReturn(0L);
        when(processoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaContatoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaEnderecoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaRepository.countByImportacaoId(id)).thenReturn(0L);

        when(processoAndamentoRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(calculoRodadaRepository.deleteByImportacaoId(id)).thenReturn(3L);
        when(processoParteRepository.deleteByImportacaoId(id)).thenReturn(2L);
        when(processoRepository.deleteByImportacaoId(id)).thenReturn(1L);
        when(pessoaContatoRepository.deleteByImportacaoId(id)).thenReturn(10L);
        when(pessoaEnderecoRepository.deleteByImportacaoId(id)).thenReturn(4L);
        when(pessoaRepository.deleteByImportacaoId(id)).thenReturn(5L);

        InadimplenciaReversaoResponse res = service.reverter(id);

        assertThat(res.importacaoId()).isEqualTo(id);
        assertThat(res.andamentosRemovidos()).isZero();
        assertThat(res.calculosRemovidos()).isEqualTo(3L);
        assertThat(res.partesRemovidas()).isEqualTo(2L);
        assertThat(res.processosRemovidos()).isEqualTo(1L);
        assertThat(res.contatosRemovidos()).isEqualTo(10L);
        assertThat(res.enderecosRemovidos()).isEqualTo(4L);
        assertThat(res.pessoasRemovidas()).isEqualTo(5L);

        InOrder ord =
                inOrder(
                        processoAndamentoRepository,
                        calculoRodadaRepository,
                        processoParteRepository,
                        processoRepository,
                        pessoaContatoRepository,
                        pessoaEnderecoRepository,
                        pessoaRepository);
        ord.verify(processoAndamentoRepository).deleteByImportacaoId(eq(id));
        ord.verify(calculoRodadaRepository).deleteByImportacaoId(eq(id));
        ord.verify(processoParteRepository).deleteByImportacaoId(eq(id));
        ord.verify(processoRepository).deleteByImportacaoId(eq(id));
        ord.verify(pessoaContatoRepository).deleteByImportacaoId(eq(id));
        ord.verify(pessoaEnderecoRepository).deleteByImportacaoId(eq(id));
        ord.verify(pessoaRepository).deleteByImportacaoId(eq(id));
    }

    /**
     * Pessoas (e demais entidades) existentes antes da importação não têm {@code importacao_id}; o serviço só invoca
     * {@code deleteByImportacaoId}, portanto não há apagamento global por CPF ou por cliente.
     */
    @Test
    void reverter_apenasDeletePorImportacaoId_naoUsaOutrosCriterios() {
        String id = "00000000-0000-0000-0000-000000000003";
        when(processoAndamentoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(calculoRodadaRepository.countByImportacaoId(id)).thenReturn(0L);
        when(processoParteRepository.countByImportacaoId(id)).thenReturn(0L);
        when(processoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaContatoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaEnderecoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaRepository.countByImportacaoId(id)).thenReturn(1L);

        when(processoAndamentoRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(calculoRodadaRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(processoParteRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(processoRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(pessoaContatoRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(pessoaEnderecoRepository.deleteByImportacaoId(id)).thenReturn(0L);
        when(pessoaRepository.deleteByImportacaoId(id)).thenReturn(1L);

        service.reverter(id);

        verify(pessoaRepository).deleteByImportacaoId(eq(id));
        verify(pessoaRepository, never()).deleteAll();
    }

    private void stubCountsAllZero(String id) {
        when(processoAndamentoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(calculoRodadaRepository.countByImportacaoId(id)).thenReturn(0L);
        when(processoParteRepository.countByImportacaoId(id)).thenReturn(0L);
        when(processoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaContatoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaEnderecoRepository.countByImportacaoId(id)).thenReturn(0L);
        when(pessoaRepository.countByImportacaoId(id)).thenReturn(0L);
    }
}
