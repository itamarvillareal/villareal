package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.imovel.api.dto.ImovelResponse;
import br.com.vilareal.imovel.api.dto.ImovelWriteRequest;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImovelApplicationServiceNumeroPlanilhaDuplicataTest {

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

    @Test
    void buscarPorNumeroPlanilha_prefereRegistroComMaisDadosQuandoHaDuplicata() {
        ImovelEntity completo = new ImovelEntity();
        completo.setId(28L);
        completo.setNumeroPlanilha(2);
        completo.setUnidade("Unidade 105 A");
        completo.setCondominio("Avenida Parque");
        completo.setEnderecoCompleto("Av. Universitaria 1257");
        completo.setSituacao("DESOCUPADO");

        ImovelEntity fantasma = new ImovelEntity();
        fantasma.setId(91L);
        fantasma.setNumeroPlanilha(2);
        fantasma.setSituacao("DESOCUPADO");

        when(imovelRepository.findAllByOrderByIdAsc()).thenReturn(List.of(completo, fantasma));

        ImovelResponse resp = service.buscarImovelPorNumeroPlanilha(2, null, null);

        assertThat(resp.getId()).isEqualTo(28L);
        assertThat(resp.getUnidade()).isEqualTo("Unidade 105 A");
    }

    @Test
    void scoreImovelCadastroPlanilha_priorizaUnidadeECondominio() {
        ImovelEntity rico = new ImovelEntity();
        rico.setUnidade("105 A");
        rico.setCondominio("Parque");

        ImovelEntity vazio = new ImovelEntity();

        assertThat(ImovelApplicationService.scoreImovelCadastroPlanilha(rico))
                .isGreaterThan(ImovelApplicationService.scoreImovelCadastroPlanilha(vazio));
    }

    @Test
    void atualizarImovel_rejeitaClienteNovoQuandoPlanilhaJaExisteParaOutroRegistro() {
        ClienteEntity cliente693 = new ClienteEntity();
        cliente693.setId(693L);
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(692L);
        cliente693.setPessoa(pessoa);

        ImovelEntity canonico = new ImovelEntity();
        canonico.setId(28L);
        canonico.setCliente(cliente693);
        canonico.setNumeroPlanilha(24);

        ImovelEntity fantasma = new ImovelEntity();
        fantasma.setId(91L);
        fantasma.setNumeroPlanilha(24);

        when(imovelRepository.findById(91L)).thenReturn(Optional.of(fantasma));
        when(clienteResolverService.buscarPorId(693L)).thenReturn(cliente693);
        when(imovelRepository.findByCliente_IdAndNumeroPlanilha(693L, 24)).thenReturn(Optional.of(canonico));

        ImovelWriteRequest req = new ImovelWriteRequest();
        req.setClienteId(693L);
        req.setSituacao("OCUPADO");

        assertThatThrownBy(() -> service.atualizarImovel(91L, req))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("já vinculado");
    }
}
