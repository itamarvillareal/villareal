package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.api.dto.ImovelNumeroPlanilhaResponse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * A1/item 4: {@code resolverNumeroPlanilhaPorVinculo} deve resolver o imóvel APENAS pelo vínculo
 * imovel_processo ATIVO — nunca por um vínculo desativado (soft-delete do N:N).
 */
@ExtendWith(MockitoExtension.class)
class ImovelApplicationServiceResolverVinculoTest {

    private static final Long PROCESSO_ID = 500L;

    @Mock private ImovelRepository imovelRepository;
    @Mock private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock private PessoaRepository pessoaRepository;
    @Mock private ClienteRepository clienteRepository;
    @Mock private ProcessoRepository processoRepository;
    @Mock private ApplicationEventPublisher applicationEventPublisher;
    @Mock private ObjectMapper objectMapper;
    @Mock private ClienteResolverService clienteResolverService;
    @Mock private ImovelProcessoLinkService imovelProcessoLinkService;
    @Mock private ImovelProcessoRepository imovelProcessoRepository;

    @InjectMocks private ImovelApplicationService service;

    private ProcessoEntity processo;

    @BeforeEach
    void setUp() {
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(123L);

        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(77L);
        cliente.setCodigoCliente("00012345");
        cliente.setPessoa(pessoa);

        processo = new ProcessoEntity();
        processo.setId(PROCESSO_ID);
        processo.setPessoa(pessoa);

        when(clienteRepository.findByCodigoCliente(anyString())).thenReturn(Optional.of(cliente));
        when(processoRepository.findAllByCliente_IdAndNumeroInternoOrderByIdDesc(anyLong(), anyInt()))
                .thenReturn(List.of());
        when(processoRepository.findByPessoa_IdAndNumeroInterno(anyLong(), anyInt()))
                .thenReturn(Optional.of(processo));
    }

    @Test
    void resolvePeloVinculoAtivo() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setNumeroPlanilha(42);
        ImovelProcessoEntity ativo = new ImovelProcessoEntity();
        ativo.setImovel(imovel);
        ativo.setAtivo(true);
        when(imovelProcessoRepository.findFirstByProcesso_IdAndAtivoTrueOrderByIdDesc(PROCESSO_ID))
                .thenReturn(Optional.of(ativo));

        ImovelNumeroPlanilhaResponse r = service.resolverNumeroPlanilhaPorVinculo("00012345", 1);

        assertThat(r.getNumeroPlanilha()).isEqualTo(42);
        verify(imovelProcessoRepository).findFirstByProcesso_IdAndAtivoTrueOrderByIdDesc(PROCESSO_ID);
    }

    @Test
    void naoResolvePorVinculoInativo() {
        // Só existe vínculo desativado: a query AtivoTrue devolve vazio e não há espelho escalar.
        when(imovelProcessoRepository.findFirstByProcesso_IdAndAtivoTrueOrderByIdDesc(PROCESSO_ID))
                .thenReturn(Optional.empty());
        when(imovelRepository.findFirstByProcesso_IdOrderByIdAsc(eq(PROCESSO_ID)))
                .thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.resolverNumeroPlanilhaPorVinculo("00012345", 1))
                .isInstanceOf(ResourceNotFoundException.class);

        verify(imovelProcessoRepository).findFirstByProcesso_IdAndAtivoTrueOrderByIdDesc(PROCESSO_ID);
    }
}
