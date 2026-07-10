package br.com.vilareal.processo.application;

import br.com.vilareal.agenda.application.ProcessoAudienciaAgendaSyncService;
import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.importacao.infrastructure.persistence.repository.PlanilhaPasta1ClienteRepository;
import br.com.vilareal.pessoa.api.dto.ClienteCreateRequest;
import br.com.vilareal.pessoa.api.dto.ClienteCreateResult;
import br.com.vilareal.localidade.application.MunicipioApplicationService;
import br.com.vilareal.localidade.application.MunicipioDerivacaoService;
import br.com.vilareal.localidade.application.MunicipioUsoService;
import br.com.vilareal.orgaojulgador.application.OrgaoJulgadorApplicationService;
import br.com.vilareal.orgaojulgador.application.OrgaoJulgadorDerivacaoService;
import br.com.vilareal.orgaojulgador.application.OrgaoJulgadorUsoService;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteAdvogadoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoPrazoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.usuario.application.UsuarioDestinatarioGuard;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ClienteCadastroUpsertServiceTest {

    @Mock
    private ProcessoRepository processoRepository;
    @Mock
    private ProcessoParteRepository parteRepository;
    @Mock
    private ProcessoParteAdvogadoRepository parteAdvogadoRepository;
    @Mock
    private ProcessoAndamentoRepository andamentoRepository;
    @Mock
    private ProcessoPrazoRepository prazoRepository;
    @Mock
    private PessoaRepository pessoaRepository;
    @Mock
    private UsuarioRepository usuarioRepository;
    @Mock
    private UsuarioDestinatarioGuard usuarioDestinatarioGuard;
    @Mock
    private PlanilhaPasta1ClienteRepository planilhaPasta1ClienteRepository;
    @Mock
    private ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    @Mock
    private ClienteRepository clienteRepository;
    @Mock
    private ClienteResolverService clienteResolverService;
    @Mock
    private DocumentoDrivePastaService documentoDrivePastaService;
    @Mock
    private MunicipioUsoService municipioUsoService;
    @Mock
    private MunicipioDerivacaoService municipioDerivacaoService;
    @Mock
    private MunicipioApplicationService municipioApplicationService;
    @Mock
    private OrgaoJulgadorUsoService orgaoJulgadorUsoService;
    @Mock
    private OrgaoJulgadorDerivacaoService orgaoJulgadorDerivacaoService;
    @Mock
    private OrgaoJulgadorApplicationService orgaoJulgadorApplicationService;
    @Mock
    private ProcessoExclusaoService processoExclusaoService;
    @Mock
    private ProcessoAudienciaAgendaSyncService processoAudienciaAgendaSyncService;

    private ProcessoApplicationService service;

    @BeforeEach
    void setUp() {
        service =
                new ProcessoApplicationService(
                        processoRepository,
                        parteRepository,
                        parteAdvogadoRepository,
                        andamentoRepository,
                        prazoRepository,
                        pessoaRepository,
                        usuarioRepository,
                        usuarioDestinatarioGuard,
                        planilhaPasta1ClienteRepository,
                        clienteCodigoPessoaResolver,
                        clienteRepository,
                        clienteResolverService,
                        documentoDrivePastaService,
                        municipioUsoService,
                        municipioDerivacaoService,
                        municipioApplicationService,
                        orgaoJulgadorUsoService,
                        orgaoJulgadorDerivacaoService,
                        orgaoJulgadorApplicationService,
                        processoExclusaoService,
                        processoAudienciaAgendaSyncService);
    }

    @Test
    void criarClienteMinimo_atualizaPessoaQuandoCodigoJaExiste() {
        PessoaEntity pessoaAntiga = new PessoaEntity();
        pessoaAntiga.setId(1201L);
        pessoaAntiga.setNome("LUCIANA ANTIGA");
        pessoaAntiga.setCpf("12345678901");

        PessoaEntity pessoaNova = new PessoaEntity();
        pessoaNova.setId(999L);
        pessoaNova.setNome("PESSOA NOVA");
        pessoaNova.setCpf("98765432100");

        ClienteEntity existente = new ClienteEntity();
        existente.setId(59L);
        existente.setCodigoCliente("00000059");
        existente.setPessoa(pessoaAntiga);
        existente.setInativo(false);

        when(pessoaRepository.findById(999L)).thenReturn(Optional.of(pessoaNova));
        when(clienteRepository.findByCodigoClienteFetchPessoa("00000059")).thenReturn(Optional.of(existente));
        when(clienteRepository.save(any(ClienteEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        ClienteCreateRequest req = new ClienteCreateRequest();
        req.setCodigoCliente("00000059");
        req.setPessoaId(999L);
        req.setNomeReferencia("LUCIANA NOVA");
        req.setObservacao("Obs teste");

        ClienteCreateResult result = service.criarClienteMinimo(req);

        assertThat(result.criadoNovo()).isFalse();
        assertThat(result.cliente().getPessoaId()).isEqualTo(999L);
        assertThat(result.cliente().getNome()).isEqualTo("LUCIANA NOVA");
        assertThat(result.cliente().getObservacao()).isEqualTo("Obs teste");

        ArgumentCaptor<ClienteEntity> cap = ArgumentCaptor.forClass(ClienteEntity.class);
        verify(clienteRepository).save(cap.capture());
        assertThat(cap.getValue().getPessoa().getId()).isEqualTo(999L);
        assertThat(cap.getValue().getNomeReferencia()).isEqualTo("LUCIANA NOVA");
    }
}
