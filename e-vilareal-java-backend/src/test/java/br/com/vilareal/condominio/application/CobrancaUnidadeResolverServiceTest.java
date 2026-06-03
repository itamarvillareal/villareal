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
import org.springframework.data.domain.Pageable;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
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
                processoRepository,
                processoParteRepository,
                processoApplicationService,
                claudeApiService);
    }

    @Test
    void resolverUnidade_pfNova_criaPessoaComGeneroInferido() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.empty());
        PessoaCadastroResponse criada = new PessoaCadastroResponse();
        criada.setId(9001L);
        when(pessoaApplicationService.criar(any(PessoaCadastroRequest.class))).thenReturn(criada);
        when(claudeApiService.enviarMensagem(any(), eq("Maria"))).thenReturn("F");
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        when(processoRepository.findProcessosVaziosPorCliente(eq(CLIENTE_ID), eq(COD8), any(Pageable.class)))
                .thenReturn(List.of());
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID)).thenReturn(List.of());
        ProcessoResponse procResp = new ProcessoResponse();
        procResp.setId(200L);
        procResp.setNumeroInterno(1);
        when(processoApplicationService.criar(any())).thenReturn(procResp);
        when(processoRepository.findById(200L)).thenReturn(Optional.of(processo(200L, 1, UNIDADE)));
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
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        when(processoRepository.findProcessosVaziosPorCliente(eq(CLIENTE_ID), eq(COD8), any(Pageable.class)))
                .thenReturn(List.of());
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID)).thenReturn(List.of());
        ProcessoResponse procResp = new ProcessoResponse();
        procResp.setId(201L);
        when(processoApplicationService.criar(any())).thenReturn(procResp);
        when(processoRepository.findById(201L)).thenReturn(Optional.of(processo(201L, 1, UNIDADE)));
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
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.of(proc));
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
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.of(proc));
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
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.of(proc));
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
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.of(procAntigo));
        when(processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(500L))
                .thenReturn(List.of(parteReu(999L)));

        when(processoRepository.findProcessosVaziosPorCliente(eq(CLIENTE_ID), eq(COD8), any(Pageable.class)))
                .thenReturn(List.of());
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID))
                .thenReturn(List.of(procAntigo));
        ProcessoResponse novo = new ProcessoResponse();
        novo.setId(501L);
        novo.setNumeroInterno(7);
        when(processoApplicationService.criar(any())).thenReturn(novo);
        when(processoRepository.findById(501L)).thenReturn(Optional.of(processo(501L, 7, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(501L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(501L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.revisaoTrocaDono()).isTrue();
        assertThat(r.pessoaIdReuAnterior()).isEqualTo(999L);
        assertThat(r.processoId()).isEqualTo(501L);
        assertThat(r.processoCriado()).isTrue();
        verify(processoRepository, never()).save(procAntigo);
        verify(processoApplicationService, never()).criarParte(eq(500L), any());
    }

    @Test
    void resolverUnidade_semProcComVazio_reaproveitaProcessoVazio() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        ProcessoEntity vazio = processo(600L, 8, null);
        when(processoRepository.findProcessosVaziosPorCliente(eq(CLIENTE_ID), eq(COD8), any(Pageable.class)))
                .thenReturn(List.of(vazio));
        when(processoRepository.save(vazio)).thenAnswer(inv -> inv.getArgument(0));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(600L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(600L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.processoId()).isEqualTo(600L);
        assertThat(r.processoCriado()).isFalse();
        assertThat(vazio.getUnidade()).isEqualTo(UNIDADE);
        verify(processoApplicationService, never()).criar(any());
        verify(processoRepository).save(vazio);
    }

    @Test
    void resolverUnidade_semProcSemVazio_criaNovoProcesso() {
        when(pessoaRepository.findByCpf("12345678901")).thenReturn(Optional.of(pessoa(888L)));
        when(processoRepository.findByCliente_IdAndUnidade(CLIENTE_ID, UNIDADE)).thenReturn(Optional.empty());
        when(processoRepository.findProcessosVaziosPorCliente(eq(CLIENTE_ID), eq(COD8), any(Pageable.class)))
                .thenReturn(List.of());
        ProcessoEntity existente = processo(700L, 9, "B-0200");
        when(processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(CLIENTE_ID)).thenReturn(List.of(existente));
        ProcessoResponse criado = new ProcessoResponse();
        criado.setId(701L);
        criado.setNumeroInterno(10);
        when(processoApplicationService.criar(any())).thenReturn(criado);
        when(processoRepository.findById(701L)).thenReturn(Optional.of(processo(701L, 10, UNIDADE)));
        when(processoParteRepository.findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(701L, "REU", 888L))
                .thenReturn(Optional.empty());
        when(processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(701L)).thenReturn(List.of());

        ResolucaoUnidade r = service.resolverUnidade(input("João", "12345678901"));

        assertThat(r.processoCriado()).isTrue();
        assertThat(r.numeroInterno()).isEqualTo(10);
        verify(processoApplicationService).criar(any());
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
