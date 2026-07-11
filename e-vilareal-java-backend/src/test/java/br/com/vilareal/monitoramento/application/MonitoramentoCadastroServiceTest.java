package br.com.vilareal.monitoramento.application;

import br.com.vilareal.monitoramento.api.dto.CadastroDescobertoResponse;
import br.com.vilareal.monitoramento.domain.PoloDaPessoa;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.api.dto.ProcessoResponse;
import br.com.vilareal.processo.api.dto.ProcessoWriteRequest;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

class MonitoramentoCadastroServiceTest {

    private ProcessoDescobertoRepository descobertoRepo;
    private ProcessoRepository processoRepo;
    private ClienteRepository clienteRepo;
    private ProcessoApplicationService processoService;
    private MonitoramentoTriagemService triagem;
    private MonitoramentoCadastroService service;

    private PessoaEntity pessoa;
    private ProcessoDescobertoEntity descoberto;
    private ClienteEntity cliente;

    @BeforeEach
    void setUp() {
        descobertoRepo = mock(ProcessoDescobertoRepository.class);
        processoRepo = mock(ProcessoRepository.class);
        clienteRepo = mock(ClienteRepository.class);
        processoService = mock(ProcessoApplicationService.class);
        triagem = mock(MonitoramentoTriagemService.class);
        service = new MonitoramentoCadastroService(
                descobertoRepo, processoRepo, clienteRepo, processoService, triagem);

        pessoa = new PessoaEntity();
        pessoa.setId(6613L);
        pessoa.setNome("D J BONAN AUTOPECAS E SERVICOS LTDA");
        pessoa.setCpf("42800038000199");

        cliente = new ClienteEntity();
        cliente.setId(77L);
        cliente.setCodigoCliente("00000077");
        cliente.setPessoa(pessoa);
        cliente.setInativo(false);

        descoberto = new ProcessoDescobertoEntity();
        descoberto.setId(3L);
        descoberto.setPessoa(pessoa);
        descoberto.setNumeroReduzido("5606575-35");
        descoberto.setAnoDistribuicao(2026);
        descoberto.setDataDistribuicao(LocalDateTime.of(2026, 7, 2, 16, 33));
        descoberto.setNumeroCnj("5606575-35.2026.8.09.0006");
        descoberto.setClasse("Agravo de Instrumento");
        descoberto.setServentia("7ª Câmara Cível");
        descoberto.setPoloDaPessoa(PoloDaPessoa.PASSIVO);
        descoberto.setPartesAtivo("Cooperativa Celeiro; Outro Autor");
        descoberto.setPartesPassivo("D J Bonan Autopecas E Servicos Ltda");
        descoberto.setSituacao(SituacaoProcessoDescoberto.BASELINE);

        when(descobertoRepo.findByIdComPessoa(3L)).thenReturn(Optional.of(descoberto));
        when(descobertoRepo.save(any())).thenAnswer(inv -> inv.getArgument(0));
        when(clienteRepo.findByPessoa_IdOrderByCodigoClienteAsc(6613L)).thenReturn(List.of(cliente));
    }

    @Test
    void jaExisteNoAcervoVinculaSemCriar() {
        ProcessoEntity existente = new ProcessoEntity();
        existente.setId(183L);
        existente.setNumeroInterno(12);
        existente.setNumeroCnj("5606575-35.2026.8.09.0006");
        when(processoRepo.findByNumeroCnjDigitos("56065753520268090006")).thenReturn(List.of(existente));

        CadastroDescobertoResponse r = service.cadastrar(3L, null, null);

        assertEquals("JA_CADASTRADO", r.resultado());
        assertTrue(r.mensagem().contains("numeroInterno 12"));
        assertEquals(183L, r.processoId());
        assertEquals(SituacaoProcessoDescoberto.VINCULADO, descoberto.getSituacao());
        assertSame(existente, descoberto.getProcesso());
        verify(processoService, never()).criar(any());
    }

    @Test
    void semNumeroInternoDevolveSugestaoSemCriar() {
        when(processoRepo.findByNumeroCnjDigitos(anyString())).thenReturn(List.of());
        when(processoRepo.findMaxNumeroInternoDoCliente(77L)).thenReturn(41);

        CadastroDescobertoResponse r = service.cadastrar(3L, null, null);

        assertEquals("PENDENTE_CONFIRMACAO", r.resultado());
        assertEquals(42, r.numeroInternoSugerido());
        assertEquals(77L, r.clienteIdUsado());
        verify(processoService, never()).criar(any());
    }

    @Test
    void criaNovoComTramitacaoProjudiEPapelCliente() {
        when(processoRepo.findByNumeroCnjDigitos(anyString())).thenReturn(List.of());
        ProcessoResponse resp = new ProcessoResponse();
        resp.setId(9001L);
        when(processoService.criar(any())).thenReturn(resp);
        ProcessoEntity ref = new ProcessoEntity();
        ref.setId(9001L);
        when(processoRepo.getReferenceById(9001L)).thenReturn(ref);

        CadastroDescobertoResponse r = service.cadastrar(3L, null, 42);

        assertEquals("CRIADO", r.resultado());
        assertEquals(9001L, r.processoId());
        ArgumentCaptor<ProcessoWriteRequest> cap = ArgumentCaptor.forClass(ProcessoWriteRequest.class);
        verify(processoService).criar(cap.capture());
        assertEquals("Projudi", cap.getValue().getTramitacao());
        assertEquals("REQUERIDO", cap.getValue().getPapelCliente());
        assertEquals(42, cap.getValue().getNumeroInterno());
        assertEquals("5606575-35.2026.8.09.0006", cap.getValue().getNumeroCnj());
        // Partes opostas (polo AUTOR, pois a pessoa é PASSIVO) criadas via serviço canônico.
        verify(processoService, times(2)).criarParte(eq(9001L), any());
        assertEquals(SituacaoProcessoDescoberto.VINCULADO, descoberto.getSituacao());
    }

    @Test
    void idempotenteSegundaChamadaNaoCriaSegundoProcesso() {
        ProcessoEntity ja = new ProcessoEntity();
        ja.setId(9001L);
        ja.setNumeroInterno(42);
        descoberto.setProcesso(ja);
        descoberto.setSituacao(SituacaoProcessoDescoberto.VINCULADO);
        when(processoRepo.findById(9001L)).thenReturn(Optional.of(ja));

        CadastroDescobertoResponse r = service.cadastrar(3L, null, 42);

        assertEquals("JA_CADASTRADO", r.resultado());
        verify(processoService, never()).criar(any());
    }

    @Test
    void variosClientesDevolveCandidatosSemAdivinhar() {
        ClienteEntity c2 = new ClienteEntity();
        c2.setId(88L);
        c2.setCodigoCliente("00000088");
        c2.setPessoa(pessoa);
        c2.setInativo(false);
        when(clienteRepo.findByPessoa_IdOrderByCodigoClienteAsc(6613L)).thenReturn(List.of(cliente, c2));
        when(processoRepo.findByNumeroCnjDigitos(anyString())).thenReturn(List.of());

        CadastroDescobertoResponse r = service.cadastrar(3L, null, null);

        assertEquals("PENDENTE_CONFIRMACAO", r.resultado());
        assertEquals(2, r.clientesCandidatos().size());
        verify(processoService, never()).criar(any());
    }
}
