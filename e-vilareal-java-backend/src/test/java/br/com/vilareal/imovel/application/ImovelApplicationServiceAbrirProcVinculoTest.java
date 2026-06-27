package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.api.dto.ImovelVinculosProcessoResponse;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelVinculoProcessoPrincipalRepository;
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
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationEventPublisher;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

/**
 * Fase 5a: "Abrir Proc." ({@code montarVinculoProcessoDeImovel}) prioriza N:N ativo antes de escalar/extras.
 */
@ExtendWith(MockitoExtension.class)
class ImovelApplicationServiceAbrirProcVinculoTest {

    private static final Long IMOVEL_ID = 35L;
    private static final int NUMERO_PLANILHA = 36;

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

    private ImovelApplicationService service;

    private PessoaEntity pessoa;
    private ClienteEntity cliente;

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
                imovelVinculoLocatarioService);

        pessoa = new PessoaEntity();
        pessoa.setId(929L);

        cliente = new ClienteEntity();
        cliente.setId(10L);
        cliente.setCodigoCliente("00000929");
        cliente.setPessoa(pessoa);
    }

    @Test
    void abrirProcPriorizaNnQuandoEscalarNuloEExtrasDiverge() {
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoa.getId())).thenReturn(List.of(cliente));
        ProcessoEntity procNn = processo(15971L, 1);
        ImovelEntity im = imovelBase();
        im.setProcesso(null);
        im.setCamposExtrasJson("{\"codigo\":\"00000929\",\"proc\":\"2\"}");

        stubImovelCadastro(im);
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(IMOVEL_ID))
                .thenReturn(Optional.of(vinculoAtivo(im, procNn)));

        ImovelVinculosProcessoResponse out = service.listarVinculosProcessoPorImovelId(IMOVEL_ID);

        assertThat(out.getVinculos()).hasSize(1);
        assertThat(out.getVinculos().get(0).getNumeroInterno()).isEqualTo(1);
        assertThat(out.getVinculos().get(0).getProcessoId()).isEqualTo(15971L);
        assertThat(out.getVinculos().get(0).getCodigoCliente()).isEqualTo("00000929");
    }

    @Test
    void abrirProcResolveComNnQuandoEscalarNuloSemExtras() {
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoa.getId())).thenReturn(List.of(cliente));
        ProcessoEntity procNn = processo(1957L, 143);
        ImovelEntity im = imovelBase();
        im.setId(11L);
        im.setNumeroPlanilha(1);
        im.setProcesso(null);
        im.setCamposExtrasJson(null);

        when(imovelRepository.findById(11L)).thenReturn(Optional.of(im));
        when(imovelRepository.findAllPorNumeroPlanilhaLegado(1)).thenReturn(List.of(im));
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(11L))
                .thenReturn(Optional.of(vinculoAtivo(im, procNn)));

        ImovelVinculosProcessoResponse out = service.listarVinculosProcessoPorImovelId(11L);

        assertThat(out.getVinculos()).hasSize(1);
        assertThat(out.getVinculos().get(0).getNumeroInterno()).isEqualTo(143);
        assertThat(out.getVinculos().get(0).getProcessoId()).isEqualTo(1957L);
    }

    @Test
    void abrirProcCaiNoEscalarQuandoSemNn() {
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoa.getId())).thenReturn(List.of(cliente));
        ProcessoEntity procEscalar = processo(5005L, 5);
        ImovelEntity im = imovelBase();
        im.setProcesso(procEscalar);

        stubImovelCadastro(im);
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(IMOVEL_ID))
                .thenReturn(Optional.empty());

        ImovelVinculosProcessoResponse out = service.listarVinculosProcessoPorImovelId(IMOVEL_ID);

        assertThat(out.getVinculos()).hasSize(1);
        assertThat(out.getVinculos().get(0).getNumeroInterno()).isEqualTo(5);
        assertThat(out.getVinculos().get(0).getProcessoId()).isEqualTo(5005L);
    }

    @Test
    void abrirProcUsaCodigoDoProcessoQuandoPessoaDoImovelEDeOutroCliente() {
        ClienteEntity cliente938 = clienteComCodigo("00000938");
        PessoaEntity pessoa149 = new PessoaEntity();
        pessoa149.setId(149L);

        ProcessoEntity proc938 = processo(88034L, 34);
        proc938.setCliente(cliente938);

        ImovelEntity im = imovelBase();
        im.setPessoa(pessoa149);
        im.setProcesso(null);
        im.setCamposExtrasJson("{\"codigo\":\"00000149\",\"proc\":\"34\"}");

        stubImovelCadastro(im);
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(IMOVEL_ID))
                .thenReturn(Optional.of(vinculoAtivo(im, proc938)));

        ImovelVinculosProcessoResponse out = service.listarVinculosProcessoPorImovelId(IMOVEL_ID);

        assertThat(out.getVinculos()).hasSize(1);
        assertThat(out.getVinculos().get(0).getCodigoCliente()).isEqualTo("00000938");
        assertThat(out.getVinculos().get(0).getNumeroInterno()).isEqualTo(34);
    }

    @Test
    void abrirProcCaiNosExtrasQuandoSemNnNemEscalar() {
        ProcessoEntity procExtras = processo(1904L, 90);
        ImovelEntity im = imovelBase();
        im.setProcesso(null);
        im.setCamposExtrasJson("{\"codigo\":\"00000149\",\"proc\":\"90\"}");

        stubImovelCadastro(im);
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(IMOVEL_ID))
                .thenReturn(Optional.empty());
        when(clienteRepository.findByCodigoCliente("00000149")).thenReturn(Optional.of(clienteComCodigo("00000149")));
        when(processoRepository.findByPessoa_IdAndNumeroInterno(anyLong(), anyInt()))
                .thenReturn(Optional.of(procExtras));

        ImovelVinculosProcessoResponse out = service.listarVinculosProcessoPorImovelId(IMOVEL_ID);

        assertThat(out.getVinculos()).hasSize(1);
        assertThat(out.getVinculos().get(0).getNumeroInterno()).isEqualTo(90);
        assertThat(out.getVinculos().get(0).getProcessoId()).isEqualTo(1904L);
    }

    private void stubImovelCadastro(ImovelEntity im) {
        when(imovelRepository.findById(im.getId())).thenReturn(Optional.of(im));
        when(imovelRepository.findAllPorNumeroPlanilhaLegado(im.getNumeroPlanilha())).thenReturn(List.of(im));
    }

    private ImovelEntity imovelBase() {
        ImovelEntity im = new ImovelEntity();
        im.setId(IMOVEL_ID);
        im.setNumeroPlanilha(NUMERO_PLANILHA);
        im.setPessoa(pessoa);
        return im;
    }

    private static ProcessoEntity processo(Long id, int numeroInterno) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        p.setNumeroInterno(numeroInterno);
        p.setPessoa(new PessoaEntity());
        p.getPessoa().setId(929L);
        return p;
    }

    private static ImovelProcessoEntity vinculoAtivo(ImovelEntity im, ProcessoEntity proc) {
        ImovelProcessoEntity row = new ImovelProcessoEntity();
        row.setImovel(im);
        row.setProcesso(proc);
        row.setAtivo(true);
        return row;
    }

    private ClienteEntity clienteComCodigo(String codigo) {
        ClienteEntity c = new ClienteEntity();
        c.setId(99L);
        c.setCodigoCliente(codigo);
        PessoaEntity p = new PessoaEntity();
        p.setId(149L);
        c.setPessoa(p);
        return c;
    }
}
