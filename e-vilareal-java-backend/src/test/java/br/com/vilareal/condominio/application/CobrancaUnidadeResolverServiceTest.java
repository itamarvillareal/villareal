package br.com.vilareal.condominio.application;

import br.com.vilareal.documento.ClaudeApiService;
import br.com.vilareal.pessoa.api.dto.PessoaCadastroRequest;
import br.com.vilareal.pessoa.api.dto.PessoaCadastroResponse;
import br.com.vilareal.pessoa.api.dto.PessoaComplementarPayload;
import br.com.vilareal.pessoa.application.PessoaApplicationService;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.api.dto.ProcessoParteWriteRequest;
import br.com.vilareal.processo.api.dto.ProcessoResponse;
import br.com.vilareal.processo.api.dto.ProcessoWriteRequest;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CobrancaUnidadeResolverServiceTest {

    private static final long CLIENTE_ID = 50L;
    private static final long CLIENTE_PESSOA_ID = 100L;
    private static final String COD8 = "00000299";
    private static final String UNIDADE = "A-0103";

    @Mock
    private PessoaRepository pessoaRepository;

    @Mock
    private PessoaApplicationService pessoaApplicationService;

    @Mock
    private ProcessoUnidadeClienteLookupService processoUnidadeLookup;

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProcessoParteRepository processoParteRepository;

    @Mock
    private ProcessoApplicationService processoApplicationService;

    @Mock
    private ClaudeApiService claudeApiService;

    private CobrancaUnidadeResolverService service;

    @BeforeEach
    void setUp() {
        service = new CobrancaUnidadeResolverService(
                pessoaRepository,
                pessoaApplicationService,
                processoUnidadeLookup,
                processoRepository,
                processoParteRepository,
                processoApplicationService,
                claudeApiService);
    }

    @Test
    void resolverUnidade_procNovo_preencheNaturezaAcaoEParteCliente() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID)).thenReturn(List.of());
        ProcessoResponse criado = new ProcessoResponse();
        criado.setId(701L);
        criado.setNumeroInterno(1);
        when(processoApplicationService.criar(any())).thenReturn(criado);
        when(processoRepository.findById(701L)).thenReturn(Optional.of(processo(701L, 1, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "AUTOR", CLIENTE_PESSOA_ID))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(701L)).thenReturn(List.of());

        service.resolverUnidade(input("João", "12345678901"));

        ArgumentCaptor<ProcessoWriteRequest> procReq = ArgumentCaptor.forClass(ProcessoWriteRequest.class);
        verify(processoApplicationService).criar(procReq.capture());
        assertThat(procReq.getValue().getNaturezaAcao())
                .isEqualTo(CobrancaUnidadeResolverService.NATUREZA_ACAO_COBRANCA_XLS);
        assertThat(procReq.getValue().getPapelCliente()).isEqualTo("REQUERENTE");

        ArgumentCaptor<ProcessoParteWriteRequest> parteReq = ArgumentCaptor.forClass(ProcessoParteWriteRequest.class);
        verify(processoApplicationService, times(2)).criarParte(eq(701L), parteReq.capture());
        assertThat(parteReq.getAllValues())
                .anySatisfy(p -> {
                    assertThat(p.getPolo()).isEqualTo("AUTOR");
                    assertThat(p.getPessoaId()).isEqualTo(CLIENTE_PESSOA_ID);
                    assertThat(p.getQualificacao()).isEqualTo("Parte cliente");
                })
                .anySatisfy(p -> {
                    assertThat(p.getPolo()).isEqualTo("REU");
                    assertThat(p.getPessoaId()).isEqualTo(888L);
                });
    }

    @Test
    void resolverUnidade_pfNova_criaPessoaComGeneroInferido() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.empty());
        PessoaCadastroResponse criada = new PessoaCadastroResponse();
        criada.setId(9001L);
        when(pessoaApplicationService.criar(any(PessoaCadastroRequest.class))).thenReturn(criada);
        when(claudeApiService.enviarMensagem(any(), eq("Maria"))).thenReturn("F");
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID)).thenReturn(List.of());
        ProcessoResponse procResp = new ProcessoResponse();
        procResp.setId(200L);
        procResp.setNumeroInterno(1);
        when(processoApplicationService.criar(any())).thenReturn(procResp);
        when(processoRepository.findById(200L)).thenReturn(Optional.of(processo(200L, 1, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(200L, "AUTOR", CLIENTE_PESSOA_ID))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(200L, "REU", 9001L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(200L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("Maria Silva", "123.456.789-01"));

        assertThat(r.pessoaCriada()).isTrue();
        assertThat(r.generoDefinido()).isEqualTo("F");
        assertThat(r.pessoaIdDevedor()).isEqualTo(9001L);
        ArgumentCaptor<PessoaComplementarPayload> cap = ArgumentCaptor.forClass(PessoaComplementarPayload.class);
        verify(pessoaApplicationService).salvarComplementar(eq(9001L), cap.capture());
        assertThat(cap.getValue().getGenero()).isEqualTo("F");
    }

    @Test
    void resolverUnidade_pjNova_generoPj() {
        when(pessoaRepository.findByCpf("12345678000199")).thenReturn(Optional.empty());
        PessoaCadastroResponse criada = new PessoaCadastroResponse();
        criada.setId(9002L);
        when(pessoaApplicationService.criar(any())).thenReturn(criada);
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID)).thenReturn(List.of());
        ProcessoResponse procResp = new ProcessoResponse();
        procResp.setId(201L);
        when(processoApplicationService.criar(any())).thenReturn(procResp);
        when(processoRepository.findById(201L)).thenReturn(Optional.of(processo(201L, 1, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(201L, "AUTOR", CLIENTE_PESSOA_ID))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(201L, "REU", 9002L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(201L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("Empresa LTDA", "12.345.678/0001-99"));

        assertThat(r.generoDefinido()).isEqualTo("PJ");
        verify(claudeApiService, never()).enviarMensagem(any(), any());
        verify(pessoaApplicationService).salvarComplementar(eq(9002L), any());
    }

    @Test
    void resolverUnidade_pessoaExistente_reusaSemAlterarGenero() {
        PessoaEntity existente = new PessoaEntity();
        existente.setId(777L);
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(existente));
        ProcessoEntity proc = processo(300L, 5, UNIDADE);
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.of(proc));
        when(processoRepository.save(proc)).thenAnswer(inv -> inv.getArgument(0));
        ProcessoParteEntity parte = parteReu(777L);
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(300L)).thenReturn(List.of(parte));

        ResolucaoUnidade r = service.resolverUnidade(input("Maria", "12345678901"));

        assertThat(r.pessoaIdDevedor()).isEqualTo(777L);
        assertThat(r.pessoaCriada()).isFalse();
        assertThat(r.generoDefinido()).isNull();
        verify(pessoaApplicationService, never()).criar(any());
        verify(pessoaApplicationService, never()).salvarComplementar(any(), any());
        verify(processoApplicationService, never()).criarParte(any(), any());
    }

    @Test
    void resolverUnidade_procComReuIgualDevedor_usaSemDuplicarParte() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        ProcessoEntity proc = processo(400L, 3, UNIDADE);
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.of(proc));
        when(processoRepository.save(proc)).thenAnswer(inv -> inv.getArgument(0));
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(400L))
                .thenReturn(List.of(parteReu(888L)));

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.processoId()).isEqualTo(400L);
        assertThat(r.reuVinculado()).isFalse();
        assertThat(r.revisaoTrocaDono()).isFalse();
        verify(processoApplicationService, never()).criarParte(any(), any());
    }

    @Test
    void resolverUnidade_procSemReu_vinculaReu() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        ProcessoEntity proc = processo(401L, 4, UNIDADE);
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.of(proc));
        when(processoRepository.save(proc)).thenAnswer(inv -> inv.getArgument(0));
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(401L)).thenReturn(List.of());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(401L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(401L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.reuVinculado()).isTrue();
        verify(processoApplicationService).criarParte(eq(401L), any(ProcessoParteWriteRequest.class));
    }

    @Test
    void resolverUnidade_reuDiferente_novoProcessoRevisaoTrocaDono() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        ProcessoEntity procAntigo = processo(500L, 6, UNIDADE);
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.of(procAntigo));
        when(processoRepository.save(procAntigo)).thenAnswer(inv -> inv.getArgument(0));
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(500L))
                .thenReturn(List.of(parteReu(999L)));

        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID))
                .thenReturn(List.of(procAntigo));
        ProcessoResponse novo = new ProcessoResponse();
        novo.setId(501L);
        novo.setNumeroInterno(7);
        when(processoApplicationService.criar(any())).thenReturn(novo);
        when(processoRepository.findById(501L)).thenReturn(Optional.of(processo(501L, 7, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(501L, "AUTOR", CLIENTE_PESSOA_ID))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(501L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(501L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.revisaoTrocaDono()).isTrue();
        assertThat(r.pessoaIdReuAnterior()).isEqualTo(999L);
        assertThat(r.processoId()).isEqualTo(501L);
        assertThat(r.processoCriado()).isTrue();
        verify(processoRepository).save(procAntigo);
        verify(processoApplicationService, never()).criarParte(eq(500L), any());
    }

    @Test
    void resolverUnidade_semProc_ignoraStubLegadoDistante_criaSequenciaCompacta() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        List<ProcessoEntity> existentes = new ArrayList<>();
        for (int ni = 1; ni <= 74; ni++) {
            existentes.add(processo(500L + ni, ni, "Unidade " + ni + " X"));
        }
        existentes.add(processo(600L, 1474, null));
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID)).thenReturn(existentes);
        ProcessoResponse criado = new ProcessoResponse();
        criado.setId(701L);
        criado.setNumeroInterno(75);
        when(processoApplicationService.criar(any())).thenReturn(criado);
        when(processoRepository.findById(701L)).thenReturn(Optional.of(processo(701L, 75, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "AUTOR", CLIENTE_PESSOA_ID))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(701L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.processoId()).isEqualTo(701L);
        assertThat(r.processoCriado()).isTrue();
        assertThat(r.numeroInterno()).isEqualTo(75);
        verify(processoApplicationService).criar(any());
    }

    @Test
    void resolverUnidade_semProcSemVazio_criaNovoProcesso() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        ProcessoEntity existente = processo(700L, 9, "B-0200");
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID)).thenReturn(List.of(existente));
        ProcessoResponse criado = new ProcessoResponse();
        criado.setId(701L);
        criado.setNumeroInterno(10);
        when(processoApplicationService.criar(any())).thenReturn(criado);
        when(processoRepository.findById(701L)).thenReturn(Optional.of(processo(701L, 10, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "AUTOR", CLIENTE_PESSOA_ID))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(701L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.processoCriado()).isTrue();
        assertThat(r.numeroInterno()).isEqualTo(10);
        verify(processoApplicationService).criar(any());
    }

    @Test
    void resolverUnidade_encontraProcessoPorUnidadeLegivel() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        ProcessoEntity proc = processo(550L, 12, "Unidade 103 A");
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, "A-0103")).thenReturn(Optional.of(proc));
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(550L)).thenReturn(List.of());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(550L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(550L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.processoId()).isEqualTo(550L);
        assertThat(r.processoCriado()).isFalse();
        verify(processoRepository, never()).save(proc);
    }

    @Test
    void resolverUnidade_processoExistenteSemUnidade_preencheUnidadeLegivel() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        ProcessoEntity proc = processo(551L, 13, null);
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, "A-0103")).thenReturn(Optional.of(proc));
        when(processoRepository.save(proc)).thenAnswer(inv -> inv.getArgument(0));
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(551L)).thenReturn(List.of());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(551L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(551L)).thenReturn(List.of());

        service.resolverUnidade(input("João", "12345678901"));

        assertThat(proc.getUnidade()).isEqualTo("Unidade 103 A");
        verify(processoRepository).save(proc);
    }

    @Test
    void resolverUnidade_processoExistenteComNumeroInternoZero_corrigeAntesDoMerge() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        ProcessoEntity proc = processo(552L, 0, "Unidade 103 A");
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, "A-0103")).thenReturn(Optional.of(proc));
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID))
                .thenReturn(List.of(proc));
        when(processoRepository.save(proc)).thenAnswer(inv -> inv.getArgument(0));
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(552L)).thenReturn(List.of());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(552L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(552L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(proc.getNumeroInterno()).isEqualTo(1);
        assertThat(r.numeroInterno()).isEqualTo(1);
        verify(processoRepository).save(proc);
    }

    @Test
    void resolverUnidade_semProc_ignoraStubComNiZero_criaNovo() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        when(processoUnidadeLookup.buscarPorCodigoUnidade(CLIENTE_ID, "A-0103")).thenReturn(Optional.empty());
        ProcessoEntity vazio = processo(601L, 0, null);
        ProcessoEntity ocupado = processo(602L, 40, "Unidade 999 V");
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID))
                .thenReturn(List.of(ocupado, vazio));
        ProcessoResponse criado = new ProcessoResponse();
        criado.setId(701L);
        criado.setNumeroInterno(1);
        when(processoApplicationService.criar(any())).thenReturn(criado);
        when(processoRepository.findById(701L)).thenReturn(Optional.of(processo(701L, 1, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "AUTOR", CLIENTE_PESSOA_ID))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(701L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.processoCriado()).isTrue();
        assertThat(r.numeroInterno()).isEqualTo(1);
        verify(processoApplicationService).criar(any());
        verify(processoRepository, never()).save(vazio);
    }

    private static ResolverUnidadeInput input(String nome, String doc) {
        return new ResolverUnidadeInput(CLIENTE_ID, CLIENTE_PESSOA_ID, COD8, UNIDADE, nome, doc, "imp-x");
    }

    private static PessoaEntity pessoa(long id) {
        PessoaEntity p = new PessoaEntity();
        p.setId(id);
        return p;
    }

    private static ProcessoEntity processo(long id, int ni, String unidade) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        p.setNumeroInterno(ni);
        p.setUnidade(unidade);
        return p;
    }

    private static ProcessoParteEntity parteReu(long pessoaId) {
        ProcessoParteEntity pp = new ProcessoParteEntity();
        pp.setPolo("REU");
        pp.setQualificacao("Proprietário");
        PessoaEntity pe = new PessoaEntity();
        pe.setId(pessoaId);
        pp.setPessoa(pe);
        return pp;
    }
}
