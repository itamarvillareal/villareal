package br.com.vilareal.whatsapp.service;

import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppVinculoServiceTest {

    private static final String PHONE = "5562999887766";
    private static final long PESSOA_ANDRE_ID = 501L;

    @Mock
    private PessoaRepository pessoaRepository;

    @Mock
    private ClienteRepository clienteRepository;

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProcessoParteRepository parteRepository;

    @Mock
    private ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;

    @Mock
    private ClienteResolverService clienteResolverService;

    private WhatsAppVinculoService service;

    @BeforeEach
    void setUp() {
        service = new WhatsAppVinculoService(
                pessoaRepository,
                clienteRepository,
                processoRepository,
                parteRepository,
                clienteCodigoPessoaResolver,
                clienteResolverService);
        when(pessoaRepository.findIdsByTelefoneIndice(anyList(), anyString(), anyString()))
                .thenReturn(List.of(PESSOA_ANDRE_ID));
    }

    @Test
    void pessoaComProcessoDoCliente728_gravaSetteNaoNomeDaPessoa() {
        PessoaEntity andre = pessoa(PESSOA_ANDRE_ID, "André Silva");
        ClienteEntity cliente728 = cliente("00000728", "Sette", pessoa(1809L, "Titular Sette"));
        ProcessoEntity processo = processoComCliente(andre, cliente728);

        when(pessoaRepository.findById(PESSOA_ANDRE_ID)).thenReturn(Optional.of(andre));
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(PESSOA_ANDRE_ID)).thenReturn(List.of());
        when(processoRepository.findAllDistinctVinculadosPessoa(PESSOA_ANDRE_ID)).thenReturn(List.of(processo));
        when(parteRepository.findDistinctProcessoIdsByNomeLivreSemPessoa("André Silva")).thenReturn(List.of());
        when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(processo)).thenReturn("00000728");
        when(clienteResolverService.encontrarClientePorCodigo("00000728")).thenReturn(Optional.of(cliente728));

        List<WhatsAppVinculoService.ClienteVinculoResumo> result = service.resolverClientesPorTelefone(PHONE);

        assertThat(result).containsExactly(new WhatsAppVinculoService.ClienteVinculoResumo("00000728", "Sette"));
    }

    @Test
    void variosProcessosDoMesmoCliente_geraUmaLinha() {
        PessoaEntity andre = pessoa(PESSOA_ANDRE_ID, "André Silva");
        ClienteEntity cliente728 = cliente("00000728", "Sette", pessoa(1809L, "Titular Sette"));
        ProcessoEntity proc1 = processoComCliente(andre, cliente728);
        proc1.setId(1L);
        proc1.setNumeroInterno(3);
        ProcessoEntity proc2 = processoComCliente(andre, cliente728);
        proc2.setId(2L);
        proc2.setNumeroInterno(7);
        ProcessoEntity proc3 = processoComCliente(andre, cliente728);
        proc3.setId(3L);
        proc3.setNumeroInterno(12);

        when(pessoaRepository.findById(PESSOA_ANDRE_ID)).thenReturn(Optional.of(andre));
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(PESSOA_ANDRE_ID)).thenReturn(List.of());
        when(processoRepository.findAllDistinctVinculadosPessoa(PESSOA_ANDRE_ID))
                .thenReturn(List.of(proc1, proc2, proc3));
        when(parteRepository.findDistinctProcessoIdsByNomeLivreSemPessoa("André Silva")).thenReturn(List.of());
        when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(any(ProcessoEntity.class)))
                .thenReturn("00000728");
        when(clienteResolverService.encontrarClientePorCodigo("00000728")).thenReturn(Optional.of(cliente728));

        List<WhatsAppVinculoService.ClienteVinculoResumo> result = service.resolverClientesPorTelefone(PHONE);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).codigoCliente()).isEqualTo("00000728");
        assertThat(result.get(0).nome()).isEqualTo("Sette");
    }

    @Test
    void processosDeClientesDiferentes_geraUmaLinhaPorCliente() {
        PessoaEntity andre = pessoa(PESSOA_ANDRE_ID, "André Silva");
        ClienteEntity cliente728 = cliente("00000728", "Sette", pessoa(1809L, "Titular Sette"));
        ClienteEntity cliente100 = cliente("00000100", "Farol", pessoa(200L, "Titular Farol"));
        ProcessoEntity proc728 = processoComCliente(andre, cliente728);
        proc728.setId(10L);
        ProcessoEntity proc100 = processoComCliente(andre, cliente100);
        proc100.setId(11L);

        when(pessoaRepository.findById(PESSOA_ANDRE_ID)).thenReturn(Optional.of(andre));
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(PESSOA_ANDRE_ID)).thenReturn(List.of());
        when(processoRepository.findAllDistinctVinculadosPessoa(PESSOA_ANDRE_ID))
                .thenReturn(List.of(proc728, proc100));
        when(parteRepository.findDistinctProcessoIdsByNomeLivreSemPessoa("André Silva")).thenReturn(List.of());
        when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(proc728)).thenReturn("00000728");
        when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(proc100)).thenReturn("00000100");
        when(clienteResolverService.encontrarClientePorCodigo("00000728")).thenReturn(Optional.of(cliente728));
        when(clienteResolverService.encontrarClientePorCodigo("00000100")).thenReturn(Optional.of(cliente100));

        List<WhatsAppVinculoService.ClienteVinculoResumo> result = service.resolverClientesPorTelefone(PHONE);

        assertThat(result)
                .containsExactly(
                        new WhatsAppVinculoService.ClienteVinculoResumo("00000728", "Sette"),
                        new WhatsAppVinculoService.ClienteVinculoResumo("00000100", "Farol"));
    }

    @Test
    void clienteDiretoEProcessoDeOutroCliente_incluiAmbos() {
        PessoaEntity andre = pessoa(PESSOA_ANDRE_ID, "André Silva");
        ClienteEntity clienteDiretoAndre = cliente("00000501", "André", andre);
        ClienteEntity cliente728 = cliente("00000728", "Sette", pessoa(1809L, "Titular Sette"));
        ProcessoEntity proc728 = processoComCliente(andre, cliente728);

        when(pessoaRepository.findById(PESSOA_ANDRE_ID)).thenReturn(Optional.of(andre));
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(PESSOA_ANDRE_ID))
                .thenReturn(List.of(clienteDiretoAndre));
        when(processoRepository.findAllDistinctVinculadosPessoa(PESSOA_ANDRE_ID)).thenReturn(List.of(proc728));
        when(parteRepository.findDistinctProcessoIdsByNomeLivreSemPessoa("André Silva")).thenReturn(List.of());
        when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(proc728)).thenReturn("00000728");
        when(clienteResolverService.encontrarClientePorCodigo("00000728")).thenReturn(Optional.of(cliente728));

        List<WhatsAppVinculoService.ClienteVinculoResumo> result = service.resolverClientesPorTelefone(PHONE);

        assertThat(result)
                .containsExactly(
                        new WhatsAppVinculoService.ClienteVinculoResumo("00000501", "André"),
                        new WhatsAppVinculoService.ClienteVinculoResumo("00000728", "Sette"));
    }

    @Test
    void pessoaSemClienteDireto_soProcesso_entraNoGrupoDoClienteDoProcesso() {
        PessoaEntity juliano = pessoa(PESSOA_ANDRE_ID, "Juliano Costa");
        ClienteEntity cliente728 = cliente("00000728", "Sette", pessoa(1809L, "Titular Sette"));
        ProcessoEntity processo = processoComCliente(juliano, cliente728);

        when(pessoaRepository.findById(PESSOA_ANDRE_ID)).thenReturn(Optional.of(juliano));
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(PESSOA_ANDRE_ID)).thenReturn(List.of());
        when(processoRepository.findAllDistinctVinculadosPessoa(PESSOA_ANDRE_ID)).thenReturn(List.of(processo));
        when(parteRepository.findDistinctProcessoIdsByNomeLivreSemPessoa("Juliano Costa")).thenReturn(List.of());
        when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(processo)).thenReturn("00000728");
        when(clienteResolverService.encontrarClientePorCodigo("00000728")).thenReturn(Optional.of(cliente728));

        List<WhatsAppVinculoService.ClienteVinculoResumo> result = service.resolverClientesPorTelefone(PHONE);

        assertThat(result).containsExactly(new WhatsAppVinculoService.ClienteVinculoResumo("00000728", "Sette"));
    }

    @Test
    void cliente632DiretoEProcesso_formatosDistintos_geraUmaLinhaCanonica() {
        PessoaEntity wesley = pessoa(2068L, "WESLEY");
        ClienteEntity cliente632 = cliente("632", "WESLEY", wesley);
        ProcessoEntity processo = processoComCliente(wesley, cliente632);

        when(pessoaRepository.findIdsByTelefoneIndice(anyList(), anyString(), anyString()))
                .thenReturn(List.of(2068L));
        when(pessoaRepository.findById(2068L)).thenReturn(Optional.of(wesley));
        when(clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(2068L)).thenReturn(List.of(cliente632));
        when(processoRepository.findAllDistinctVinculadosPessoa(2068L)).thenReturn(List.of(processo));
        when(parteRepository.findDistinctProcessoIdsByNomeLivreSemPessoa("WESLEY")).thenReturn(List.of());
        when(clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(processo)).thenReturn("00000632");
        when(clienteResolverService.encontrarClientePorCodigo("00000632")).thenReturn(Optional.of(cliente632));

        List<WhatsAppVinculoService.ClienteVinculoResumo> result = service.resolverClientesPorTelefone(PHONE);

        assertThat(result).hasSize(1);
        assertThat(result.get(0).codigoCliente()).isEqualTo("00000632");
        assertThat(result.get(0).nome()).isEqualTo("WESLEY");
    }

    private static PessoaEntity pessoa(long id, String nome) {
        PessoaEntity p = new PessoaEntity();
        p.setId(id);
        p.setNome(nome);
        return p;
    }

    private static ClienteEntity cliente(String codigo, String nomeReferencia, PessoaEntity titular) {
        ClienteEntity c = new ClienteEntity();
        c.setCodigoCliente(codigo);
        c.setNomeReferencia(nomeReferencia);
        c.setPessoa(titular);
        return c;
    }

    private static ProcessoEntity processoComCliente(PessoaEntity titularProcesso, ClienteEntity cliente) {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setPessoa(titularProcesso);
        processo.setCliente(cliente);
        processo.setNumeroInterno(1);
        return processo;
    }
}
