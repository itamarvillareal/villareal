package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.api.dto.ImovelVinculoPrincipalWriteRequest;
import br.com.vilareal.imovel.api.dto.ImovelVinculosProcessoResponse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelVinculoProcessoPrincipalEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelVinculoProcessoPrincipalRepository;
import br.com.vilareal.localidade.application.MunicipioApplicationService;
import br.com.vilareal.localidade.application.MunicipioDerivacaoService;
import br.com.vilareal.localidade.application.MunicipioUsoService;
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
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ImovelApplicationServiceVinculoPrincipalTest {

    private static final int NUMERO_PLANILHA = 15;

    @Mock private ImovelRepository imovelRepository;
    @Mock private ContratoLocacaoRepository contratoLocacaoRepository;
    @Mock private PessoaRepository pessoaRepository;
    @Mock private ClienteRepository clienteRepository;
    @Mock private ProcessoRepository processoRepository;
    @Mock private ApplicationEventPublisher applicationEventPublisher;
    @Mock private ClienteResolverService clienteResolverService;
    @Mock private ImovelProcessoLinkService imovelProcessoLinkService;
    @Mock private ImovelProcessoRepository imovelProcessoRepository;
    @Mock private ImovelVinculoProcessoPrincipalRepository imovelVinculoProcessoPrincipalRepository;
    @Mock private ImovelVinculoLocatarioService imovelVinculoLocatarioService;
    @Mock private MunicipioUsoService municipioUsoService;
    @Mock private MunicipioDerivacaoService municipioDerivacaoService;
    @Mock private MunicipioApplicationService municipioApplicationService;

    private ImovelApplicationService service;

    @BeforeEach
    void setUp() {
        service = new ImovelApplicationService(
                imovelRepository,
                contratoLocacaoRepository,
                pessoaRepository,
                clienteRepository,
                processoRepository,
                applicationEventPublisher,
                new ObjectMapper(),
                clienteResolverService,
                imovelProcessoLinkService,
                imovelProcessoRepository,
                imovelVinculoProcessoPrincipalRepository,
                imovelVinculoLocatarioService,
                municipioUsoService,
                municipioDerivacaoService,
                municipioApplicationService);
    }

    @Test
    void listarUsaPrincipalPersistidoQuandoExistir() {
        ClienteEntity c938 = cliente("00000938");
        ClienteEntity c149 = cliente("00000149");
        ImovelEntity im1 = imovel(101L, c938, processo(8801L, 34, c938));
        ImovelEntity im2 = imovel(102L, c149, processo(8802L, 64, c149));

        when(imovelRepository.findAllPorNumeroPlanilhaLegado(NUMERO_PLANILHA)).thenReturn(List.of(im1, im2));
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(any())).thenReturn(Optional.empty());

        ImovelVinculoProcessoPrincipalEntity pref = new ImovelVinculoProcessoPrincipalEntity();
        pref.setNumeroPlanilha(NUMERO_PLANILHA);
        pref.setCodigoCliente("00000938");
        pref.setNumeroInterno(34);
        when(imovelVinculoProcessoPrincipalRepository.findById(NUMERO_PLANILHA)).thenReturn(Optional.of(pref));

        ImovelVinculosProcessoResponse out = service.listarVinculosProcessoPorNumeroPlanilha(NUMERO_PLANILHA);

        assertThat(out.getVinculos()).hasSize(2);
        assertThat(out.getVinculos().stream().filter(v -> v.isPrincipal()).count()).isEqualTo(1);
        assertThat(out.getVinculos().stream().filter(v -> v.isPrincipal()).findFirst().orElseThrow().getNumeroInterno())
                .isEqualTo(34);
    }

    @Test
    void definirPrincipalPersisteEscolhaDoUsuario() {
        ClienteEntity c938 = cliente("00000938");
        ClienteEntity c149 = cliente("00000149");
        ImovelEntity im1 = imovel(101L, c938, processo(8801L, 34, c938));
        im1.setSituacao("OCUPADO");
        ImovelEntity im2 = imovel(102L, c149, processo(8802L, 64, c149));

        when(imovelRepository.findAllPorNumeroPlanilhaLegado(NUMERO_PLANILHA)).thenReturn(List.of(im1, im2));
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(any())).thenReturn(Optional.empty());
        ContratoLocacaoEntity vigente = new ContratoLocacaoEntity();
        vigente.setStatus("VIGENTE");
        when(contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(101L)).thenReturn(List.of(vigente));
        when(contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(102L)).thenReturn(List.of());
        when(clienteRepository.findByCodigoCliente("00000938")).thenReturn(Optional.of(c938));
        when(processoRepository.findByPessoa_IdAndNumeroInterno(100L, 34))
                .thenReturn(Optional.of(processo(8801L, 34, c938)));
        when(imovelVinculoProcessoPrincipalRepository.save(any())).thenAnswer(inv -> {
            ImovelVinculoProcessoPrincipalEntity row = inv.getArgument(0);
            ImovelVinculoProcessoPrincipalEntity saved = new ImovelVinculoProcessoPrincipalEntity();
            saved.setNumeroPlanilha(row.getNumeroPlanilha());
            saved.setCodigoCliente(row.getCodigoCliente());
            saved.setNumeroInterno(row.getNumeroInterno());
            when(imovelVinculoProcessoPrincipalRepository.findById(NUMERO_PLANILHA)).thenReturn(Optional.of(saved));
            return saved;
        });

        ImovelVinculoPrincipalWriteRequest req = new ImovelVinculoPrincipalWriteRequest();
        req.setCodigoCliente("00000938");
        req.setNumeroInterno(34);

        ImovelVinculosProcessoResponse out = service.definirVinculoProcessoPrincipal(NUMERO_PLANILHA, req);

        ArgumentCaptor<ImovelVinculoProcessoPrincipalEntity> cap =
                ArgumentCaptor.forClass(ImovelVinculoProcessoPrincipalEntity.class);
        verify(imovelVinculoProcessoPrincipalRepository).save(cap.capture());
        assertThat(cap.getValue().getCodigoCliente()).isEqualTo("00000938");
        assertThat(cap.getValue().getNumeroInterno()).isEqualTo(34);
        assertThat(out.getVinculos().stream().filter(v -> v.isPrincipal()).findFirst().orElseThrow().getNumeroInterno())
                .isEqualTo(34);
        verify(imovelProcessoLinkService).sincronizarProcessoAtivoAdministrativo(101L, 8801L);
    }

    private static ImovelEntity imovel(Long id, ClienteEntity cliente, ProcessoEntity proc) {
        ImovelEntity im = new ImovelEntity();
        im.setId(id);
        im.setNumeroPlanilha(NUMERO_PLANILHA);
        im.setPessoa(cliente.getPessoa());
        im.setProcesso(proc);
        return im;
    }

    private static ClienteEntity cliente(String codigo) {
        ClienteEntity c = new ClienteEntity();
        c.setId(1L);
        c.setCodigoCliente(codigo);
        PessoaEntity p = new PessoaEntity();
        p.setId(100L);
        c.setPessoa(p);
        return c;
    }

    private static ProcessoEntity processo(Long id, int numeroInterno, ClienteEntity cliente) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        p.setNumeroInterno(numeroInterno);
        p.setCliente(cliente);
        p.setPessoa(cliente.getPessoa());
        return p;
    }
}
