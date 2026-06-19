package br.com.vilareal.publicacao.application;

import br.com.vilareal.agenda.application.PrazoAgendaLembreteService;
import br.com.vilareal.documento.DocumentoPastaAssinarService;
import br.com.vilareal.julia.api.dto.JuliaCaixaPatchRequest;
import br.com.vilareal.julia.application.JuliaCaixaApplicationService;
import br.com.vilareal.julia.domain.JuliaPrazoDateUtil;
import br.com.vilareal.julia.infrastructure.persistence.entity.JuliaTriagemEntity;
import br.com.vilareal.julia.infrastructure.persistence.repository.JuliaTriagemRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.processo.api.dto.ProcessoAndamentoResponse;
import br.com.vilareal.processo.api.dto.ProcessoAndamentoWriteRequest;
import br.com.vilareal.processo.api.dto.ProcessoPrazoResponse;
import br.com.vilareal.processo.api.dto.ProcessoPrazoWriteRequest;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoPrazoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.api.dto.PublicacaoStatusPatchRequest;
import br.com.vilareal.publicacao.api.dto.TratarPublicacaoRequest;
import br.com.vilareal.publicacao.api.dto.TratarPublicacaoResponse;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import br.com.vilareal.tarefa.api.dto.TarefaOperacionalResponse;
import br.com.vilareal.tarefa.api.dto.TarefaOperacionalWriteRequest;
import br.com.vilareal.tarefa.application.TarefaOperacionalApplicationService;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.model.TipoUsuario;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;

import java.time.LocalDate;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class TratarPublicacaoServiceTest {

    private static final Long PUBLICACAO_ID = 10L;
    private static final Long PROCESSO_ID = 100L;
    private static final Long ANDAMENTO_ID = 501L;
    private static final Long PRAZO_ID = 601L;
    private static final Long AGENDA_ID = 701L;
    private static final Long TAREFA_ID = 801L;
    private static final Long TRIAGEM_ID = 901L;
    private static final Long CLIENTE_ID = 50L;
    private static final LocalDate DATA_FATAL = LocalDate.of(2026, 7, 1);

    @Mock
    private PublicacaoRepository publicacaoRepository;
    @Mock
    private PublicacaoApplicationService publicacaoApplicationService;
    @Mock
    private ProcessoRepository processoRepository;
    @Mock
    private ProcessoApplicationService processoApplicationService;
    @Mock
    private ProcessoPrazoRepository processoPrazoRepository;
    @Mock
    private PrazoSugestaoService prazoSugestaoService;
    @Mock
    private PrazoAgendaLembreteService prazoAgendaLembreteService;
    @Mock
    private JuliaTriagemRepository juliaTriagemRepository;
    @Mock
    private JuliaCaixaApplicationService juliaCaixaApplicationService;
    @Mock
    private TarefaOperacionalApplicationService tarefaOperacionalApplicationService;

    private TratarPublicacaoService service;
    private ProcessoEntity processo;
    private PublicacaoEntity publicacao;
    private UsuarioEntity responsavel;

    @BeforeEach
    void setUp() {
        service = new TratarPublicacaoService(
                publicacaoRepository,
                publicacaoApplicationService,
                processoRepository,
                processoApplicationService,
                processoPrazoRepository,
                prazoSugestaoService,
                prazoAgendaLembreteService,
                juliaTriagemRepository,
                juliaCaixaApplicationService,
                tarefaOperacionalApplicationService,
                new ObjectMapper());

        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(CLIENTE_ID);
        cliente.setCodigoCliente("00000042");

        responsavel = new UsuarioEntity();
        responsavel.setId(7L);
        responsavel.setTipo(TipoUsuario.HUMANO);
        responsavel.setAtivo(true);

        processo = new ProcessoEntity();
        processo.setId(PROCESSO_ID);
        processo.setNumeroInterno(3);
        processo.setCliente(cliente);
        processo.setUsuarioResponsavel(responsavel);

        ProcessoEntity processoRef = new ProcessoEntity();
        processoRef.setId(PROCESSO_ID);

        publicacao = new PublicacaoEntity();
        publicacao.setId(PUBLICACAO_ID);
        publicacao.setResumo("Intimação para manifestação.");
        publicacao.setTeor("Teor integral da publicação.");
        publicacao.setProcesso(processoRef);

        when(publicacaoRepository.findById(PUBLICACAO_ID)).thenReturn(Optional.of(publicacao));
        when(processoRepository.findByIdForJuliaEnactment(PROCESSO_ID)).thenReturn(Optional.of(processo));

        ProcessoAndamentoResponse andamentoResp = new ProcessoAndamentoResponse();
        andamentoResp.setId(ANDAMENTO_ID);
        when(processoApplicationService.criarAndamento(eq(PROCESSO_ID), any(ProcessoAndamentoWriteRequest.class)))
                .thenReturn(andamentoResp);

        ProcessoPrazoResponse prazoResp = new ProcessoPrazoResponse();
        prazoResp.setId(PRAZO_ID);
        when(processoApplicationService.criarPrazo(eq(PROCESSO_ID), any(ProcessoPrazoWriteRequest.class)))
                .thenReturn(prazoResp);

        lenient()
                .when(processoPrazoRepository.countPrazoFatalNaData(eq(PROCESSO_ID), any(LocalDate.class)))
                .thenReturn(0L);
        lenient()
                .when(prazoAgendaLembreteService.resolverDestinatarioHumanoAgenda(processo))
                .thenReturn(Optional.of(responsavel));
        lenient()
                .when(prazoAgendaLembreteService.criarLembreteAgendaPrazo(
                        eq(processo),
                        any(String.class),
                        any(LocalDate.class),
                        any(LocalDate.class),
                        eq(responsavel),
                        eq(TratarPublicacaoService.ORIGEM_AGENDA_PRAZO)))
                .thenReturn(AGENDA_ID);

        TarefaOperacionalResponse tarefaResp = new TarefaOperacionalResponse();
        tarefaResp.setId(TAREFA_ID);
        when(tarefaOperacionalApplicationService.criar(any(TarefaOperacionalWriteRequest.class)))
                .thenReturn(tarefaResp);
    }

    private void comTriagemJulia() {
        JuliaTriagemEntity triagem = new JuliaTriagemEntity();
        triagem.setId(TRIAGEM_ID);
        when(juliaTriagemRepository.findByPublicacao_Id(PUBLICACAO_ID)).thenReturn(Optional.of(triagem));
    }

    private void semTriagemJulia() {
        when(juliaTriagemRepository.findByPublicacao_Id(PUBLICACAO_ID)).thenReturn(Optional.empty());
    }

    @Test
    void tratar_informativo_marcaTratadaCriaAndamentoConcluiCardSemPrazoAgendaTarefa() {
        comTriagemJulia();

        TratarPublicacaoResponse resp = service.tratar(
                PUBLICACAO_ID, new TratarPublicacaoRequest("INFORMATIVO", null, "Apenas informativo.", null));

        assertThat(resp.andamentoId()).isEqualTo(ANDAMENTO_ID);
        assertThat(resp.prazoId()).isNull();
        assertThat(resp.agendaEventoId()).isNull();
        assertThat(resp.tarefaId()).isNull();
        assertThat(resp.cardConcluido()).isTrue();
        assertThat(resp.avisoDedup()).isNull();

        ArgumentCaptor<PublicacaoStatusPatchRequest> statusCap =
                ArgumentCaptor.forClass(PublicacaoStatusPatchRequest.class);
        verify(publicacaoApplicationService).patchStatus(eq(PUBLICACAO_ID), statusCap.capture());
        assertThat(statusCap.getValue().getStatus()).isEqualTo("TRATADA");

        ArgumentCaptor<ProcessoAndamentoWriteRequest> andamentoCap =
                ArgumentCaptor.forClass(ProcessoAndamentoWriteRequest.class);
        verify(processoApplicationService).criarAndamento(eq(PROCESSO_ID), andamentoCap.capture());
        assertThat(andamentoCap.getValue().getOrigem()).isEqualTo(TratarPublicacaoService.ORIGEM_ANDAMENTO);
        assertThat(andamentoCap.getValue().getOrigemAutomatica()).isFalse();
        assertThat(andamentoCap.getValue().getTitulo()).isEqualTo("Apenas informativo.");

        verify(juliaCaixaApplicationService)
                .atualizarCaixa(eq(TRIAGEM_ID), eq(new JuliaCaixaPatchRequest("CONCLUIDO", null, null)));
        verify(processoApplicationService, never()).criarPrazo(any(), any());
        verify(prazoAgendaLembreteService, never())
                .criarLembreteAgendaPrazo(
                        any(ProcessoEntity.class),
                        any(String.class),
                        any(LocalDate.class),
                        any(LocalDate.class),
                        any(UsuarioEntity.class),
                        any(String.class));
        verify(tarefaOperacionalApplicationService, never()).criar(any());
        ArgumentCaptor<ProcessoEntity> processoCap = ArgumentCaptor.forClass(ProcessoEntity.class);
        verify(processoRepository).save(processoCap.capture());
        assertThat(processoCap.getValue().getObservacaoFase()).isEqualTo("Apenas informativo.");
    }

    @Test
    void tratar_terceiro_comDataFatal_criaPrazoEAgendaTresDiasUteisAntes() {
        semTriagemJulia();
        LocalDate dataFatalAjustada = JuliaPrazoDateUtil.avancarParaProximoDiaUtil(DATA_FATAL);
        LocalDate dataTrabalhoEsperada = JuliaPrazoDateUtil.subtrairDiasUteis(dataFatalAjustada, 3);

        TratarPublicacaoResponse resp = service.tratar(
                PUBLICACAO_ID,
                new TratarPublicacaoRequest("TERCEIRO", DATA_FATAL, "Acompanhar perito.", null));

        assertThat(resp.andamentoId()).isEqualTo(ANDAMENTO_ID);
        assertThat(resp.prazoId()).isEqualTo(PRAZO_ID);
        assertThat(resp.agendaEventoId()).isEqualTo(AGENDA_ID);
        assertThat(resp.tarefaId()).isNull();
        assertThat(resp.cardConcluido()).isFalse();
        assertThat(resp.avisoDedup()).isNull();

        ArgumentCaptor<ProcessoPrazoWriteRequest> prazoCap = ArgumentCaptor.forClass(ProcessoPrazoWriteRequest.class);
        verify(processoApplicationService).criarPrazo(eq(PROCESSO_ID), prazoCap.capture());
        assertThat(prazoCap.getValue().getAndamentoId()).isEqualTo(ANDAMENTO_ID);
        assertThat(prazoCap.getValue().getDataFim()).isEqualTo(dataFatalAjustada);
        assertThat(prazoCap.getValue().getPrazoFatal()).isTrue();
        assertThat(prazoCap.getValue().getStatus()).isEqualTo("PENDENTE");
        assertThat(prazoCap.getValue().getDescricao()).isEqualTo("Acompanhar perito.");

        verify(processoPrazoRepository).countPrazoFatalNaData(PROCESSO_ID, dataFatalAjustada);

        ArgumentCaptor<LocalDate> dataRealCap = ArgumentCaptor.forClass(LocalDate.class);
        ArgumentCaptor<LocalDate> dataTrabalhoCap = ArgumentCaptor.forClass(LocalDate.class);
        verify(prazoAgendaLembreteService)
                .criarLembreteAgendaPrazo(
                        eq(processo),
                        eq("Acompanhar perito."),
                        dataRealCap.capture(),
                        dataTrabalhoCap.capture(),
                        eq(responsavel),
                        eq(TratarPublicacaoService.ORIGEM_AGENDA_PRAZO));
        assertThat(dataRealCap.getValue()).isEqualTo(dataFatalAjustada);
        assertThat(dataTrabalhoCap.getValue()).isEqualTo(dataTrabalhoEsperada);

        verify(juliaCaixaApplicationService, never()).atualizarCaixa(any(), any());
        verify(tarefaOperacionalApplicationService, never()).criar(any());

        ArgumentCaptor<ProcessoEntity> processoCap = ArgumentCaptor.forClass(ProcessoEntity.class);
        verify(processoRepository).save(processoCap.capture());
        assertThat(processoCap.getValue().getPrazoFatal()).isEqualTo(dataFatalAjustada);
        assertThat(processoCap.getValue().getObservacaoFase()).isEqualTo("Acompanhar perito.");
    }

    @Test
    void tratar_cumprirAgora_setaFaseProtocoloSemPrazoAgenda() {
        semTriagemJulia();

        TratarPublicacaoResponse resp = service.tratar(
                PUBLICACAO_ID, new TratarPublicacaoRequest("CUMPRIR_AGORA", null, "Protocolar petição.", null));

        assertThat(resp.andamentoId()).isEqualTo(ANDAMENTO_ID);
        assertThat(resp.prazoId()).isNull();
        assertThat(resp.agendaEventoId()).isNull();
        assertThat(resp.tarefaId()).isNull();
        assertThat(resp.cardConcluido()).isFalse();
        assertThat(resp.avisoDedup()).isNull();

        ArgumentCaptor<ProcessoEntity> processoCap = ArgumentCaptor.forClass(ProcessoEntity.class);
        verify(processoRepository).save(processoCap.capture());
        assertThat(processoCap.getValue().getFase())
                .isEqualTo(DocumentoPastaAssinarService.FASE_AGUARDANDO_PROTOCOLO);
        assertThat(processoCap.getValue().getObservacaoFase()).isEqualTo("Protocolar petição.");

        verify(processoApplicationService, never()).criarPrazo(any(), any());
        verify(prazoAgendaLembreteService, never())
                .criarLembreteAgendaPrazo(
                        any(ProcessoEntity.class),
                        any(String.class),
                        any(LocalDate.class),
                        any(LocalDate.class),
                        any(UsuarioEntity.class),
                        any(String.class));
        verify(tarefaOperacionalApplicationService, never()).criar(any());
    }

    @Test
    void tratar_cumprirDepoisComContatarCliente_criaPrazoAgendaETarefaComPublicacaoId() {
        semTriagemJulia();

        TratarPublicacaoResponse resp = service.tratar(
                PUBLICACAO_ID,
                new TratarPublicacaoRequest("CUMPRIR_DEPOIS", DATA_FATAL, "Manifestar no prazo.", true));

        assertThat(resp.andamentoId()).isEqualTo(ANDAMENTO_ID);
        assertThat(resp.prazoId()).isEqualTo(PRAZO_ID);
        assertThat(resp.agendaEventoId()).isEqualTo(AGENDA_ID);
        assertThat(resp.tarefaId()).isEqualTo(TAREFA_ID);
        assertThat(resp.cardConcluido()).isFalse();
        assertThat(resp.avisoDedup()).isNull();

        ArgumentCaptor<TarefaOperacionalWriteRequest> tarefaCap =
                ArgumentCaptor.forClass(TarefaOperacionalWriteRequest.class);
        verify(tarefaOperacionalApplicationService).criar(tarefaCap.capture());
        assertThat(tarefaCap.getValue().getPublicacaoId()).isEqualTo(PUBLICACAO_ID);
        assertThat(tarefaCap.getValue().getProcessoId()).isEqualTo(PROCESSO_ID);
        assertThat(tarefaCap.getValue().getClienteId()).isEqualTo(CLIENTE_ID);
        assertThat(tarefaCap.getValue().getProcessoPrazoId()).isEqualTo(PRAZO_ID);
        assertThat(tarefaCap.getValue().getOrigem()).isEqualTo(TratarPublicacaoService.ORIGEM_TAREFA);
        assertThat(tarefaCap.getValue().getTitulo()).isEqualTo("Contatar cliente sobre publicação");

        ArgumentCaptor<ProcessoEntity> processoCap = ArgumentCaptor.forClass(ProcessoEntity.class);
        verify(processoRepository).save(processoCap.capture());
        assertThat(processoCap.getValue().getPrazoFatal()).isEqualTo(JuliaPrazoDateUtil.avancarParaProximoDiaUtil(DATA_FATAL));
        assertThat(processoCap.getValue().getObservacaoFase()).isEqualTo("Manifestar no prazo.");
    }

    @Test
    void tratar_dedupPrazoFatal_naoCriaPrazoNemAgendaRetornaAviso() {
        semTriagemJulia();
        LocalDate dataFatalAjustada = JuliaPrazoDateUtil.avancarParaProximoDiaUtil(DATA_FATAL);
        when(processoPrazoRepository.countPrazoFatalNaData(PROCESSO_ID, dataFatalAjustada))
                .thenReturn(1L);

        TratarPublicacaoResponse resp = service.tratar(
                PUBLICACAO_ID,
                new TratarPublicacaoRequest("TERCEIRO", DATA_FATAL, "Prazo de terceiro.", null));

        assertThat(resp.andamentoId()).isEqualTo(ANDAMENTO_ID);
        assertThat(resp.prazoId()).isNull();
        assertThat(resp.agendaEventoId()).isNull();
        assertThat(resp.tarefaId()).isNull();
        assertThat(resp.cardConcluido()).isFalse();
        assertThat(resp.avisoDedup()).contains("Já existe prazo fatal").contains("01/07/2026");

        verify(publicacaoApplicationService).patchStatus(eq(PUBLICACAO_ID), any(PublicacaoStatusPatchRequest.class));
        verify(processoApplicationService).criarAndamento(eq(PROCESSO_ID), any(ProcessoAndamentoWriteRequest.class));
        verify(processoApplicationService, never()).criarPrazo(any(), any());
        verify(prazoAgendaLembreteService, never())
                .criarLembreteAgendaPrazo(
                        any(ProcessoEntity.class),
                        any(String.class),
                        any(LocalDate.class),
                        any(LocalDate.class),
                        any(UsuarioEntity.class),
                        any(String.class));

        ArgumentCaptor<ProcessoEntity> processoCap = ArgumentCaptor.forClass(ProcessoEntity.class);
        verify(processoRepository).save(processoCap.capture());
        assertThat(processoCap.getValue().getPrazoFatal()).isEqualTo(dataFatalAjustada);
        assertThat(processoCap.getValue().getObservacaoFase()).isEqualTo("Prazo de terceiro.");
    }

    @Test
    void tratar_semTriagemJulia_naoTentaConcluirCard() {
        semTriagemJulia();

        TratarPublicacaoResponse resp = service.tratar(
                PUBLICACAO_ID, new TratarPublicacaoRequest("INFORMATIVO", null, null, null));

        assertThat(resp.andamentoId()).isEqualTo(ANDAMENTO_ID);
        assertThat(resp.prazoId()).isNull();
        assertThat(resp.agendaEventoId()).isNull();
        assertThat(resp.tarefaId()).isNull();
        assertThat(resp.cardConcluido()).isFalse();
        assertThat(resp.avisoDedup()).isNull();

        verify(juliaCaixaApplicationService, never()).atualizarCaixa(any(), any());
    }
}
