package br.com.vilareal.monitoramento.application;

import br.com.vilareal.jobrun.application.JobRunContext;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.domain.StatusVarredura;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.VarreduraPessoaEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.SegredoJusticaContagemRepository;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.VarreduraPessoaRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiBuscaParteService;
import br.com.vilareal.projudi.ProjudiBuscaParteService.LinhaLista;
import br.com.vilareal.projudi.ProjudiBuscaParteService.PaginaLista;
import br.com.vilareal.projudi.ProjudiEstruturaInesperadaException;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.dao.DataIntegrityViolationException;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicLong;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Idempotência da baseline parcial: falha no meio (ESTRUTURA_INESPERADA na página 2 de 3)
 * deixa {@code baseline_em=NULL} e as linhas das páginas anteriores gravadas; a re-execução
 * COMPLETA sem violar o UNIQUE (pessoa, numero_reduzido, ano) — o fake do repositório
 * SIMULA a constraint e estoura {@link DataIntegrityViolationException} num INSERT cru de
 * chave repetida, provando que a regravação consulta antes de inserir (upsert).
 */
class VarreduraPessoaServiceBaselineIdempotenciaTest {

    private static final Long PESSOA_ID = 42L;
    private static final Long CREDENCIAL_ID = 1L;

    private PessoaEntity pessoa;
    private ProjudiBuscaParteService busca;
    private VarreduraPessoaService service;

    /** Store em memória com a MESMA chave natural do UNIQUE da V200. */
    private final Map<String, ProcessoDescobertoEntity> store = new LinkedHashMap<>();
    private final List<VarreduraPessoaEntity> varreduras = new ArrayList<>();
    /** Quando true, a página de posição 2 lança ESTRUTURA_INESPERADA. */
    private boolean falharNaPagina2;

    private static String chave(ProcessoDescobertoEntity e) {
        return e.getPessoa().getId() + "|" + e.getNumeroReduzido() + "|" + e.getAnoDistribuicao();
    }

    private static LinhaLista linha(String reduzido, int ano) {
        return new LinhaLista(
                reduzido,
                LocalDateTime.of(ano, 3, 10, 12, 0),
                "61300000000000000" + reduzido.replaceAll("\\D", ""),
                "8739627809" + reduzido.substring(0, 2),
                List.of("FULANO DE TAL"),
                List.of("BANCO X"),
                false,
                null);
    }

    private static LinhaLista linhaSegredo() {
        return new LinhaLista(null, null, null, null, List.of(), List.of(), true, "Serventia Sigilosa");
    }

    @BeforeEach
    void setUp() {
        pessoa = new PessoaEntity();
        pessoa.setId(PESSOA_ID);
        pessoa.setNome("FULANO DE TAL");
        pessoa.setCpf("11144477735");
        pessoa.setMarcadoMonitoramento(true);
        pessoa.setPoloMonitorado("AMBOS");
        pessoa.setBaselineEm(null);

        // 3 páginas: 0 → [A,B], 1 → [C, segredo], 2 → [D,E]. A página 2 falha na 1ª execução.
        busca = mock(ProjudiBuscaParteService.class);
        when(busca.primeiraPagina(eq(CREDENCIAL_ID), anyString()))
                .thenReturn(new PaginaLista(List.of(linha("1111111-11", 2020), linha("2222222-22", 2021)), 2));
        when(busca.paginaEm(eq(CREDENCIAL_ID), eq(1)))
                .thenReturn(new PaginaLista(List.of(linha("3333333-33", 2022), linhaSegredo()), 2));
        when(busca.paginaEm(eq(CREDENCIAL_ID), eq(2))).thenAnswer(inv -> {
            if (falharNaPagina2) {
                throw new ProjudiEstruturaInesperadaException("HTML sem table#Tabela (simulado)");
            }
            return new PaginaLista(List.of(linha("4444444-44", 2024), linha("5555555-55", 2026)), 2);
        });

        PessoaRepository pessoaRepository = mock(PessoaRepository.class);
        when(pessoaRepository.findById(PESSOA_ID)).thenReturn(Optional.of(pessoa));
        when(pessoaRepository.save(any(PessoaEntity.class))).thenAnswer(inv -> inv.getArgument(0));

        ProcessoRepository processoRepository = mock(ProcessoRepository.class);
        when(processoRepository.findByCnjSequencialDvAno(anyString())).thenReturn(List.of());

        // Fake do repositório de descobertas com a constraint UNIQUE simulada: INSERT cru
        // (id null) de chave já existente estoura, como o MySQL faria.
        AtomicLong seq = new AtomicLong(1);
        ProcessoDescobertoRepository descobertoRepository = mock(ProcessoDescobertoRepository.class);
        when(descobertoRepository.findByPessoaIdAndNumeroReduzidoAndAnoDistribuicao(anyLong(), anyString(), anyInt()))
                .thenAnswer(inv -> Optional.ofNullable(
                        store.get(inv.getArgument(0) + "|" + inv.getArgument(1) + "|" + inv.getArgument(2))));
        when(descobertoRepository.save(any(ProcessoDescobertoEntity.class))).thenAnswer(inv -> {
            ProcessoDescobertoEntity e = inv.getArgument(0);
            ProcessoDescobertoEntity existente = store.get(chave(e));
            if (e.getId() == null) {
                if (existente != null) {
                    throw new DataIntegrityViolationException(
                            "Duplicate entry para uk_processo_descoberto_pessoa_num_ano: " + chave(e));
                }
                e.setId(seq.getAndIncrement());
            }
            store.put(chave(e), e);
            return e;
        });
        when(descobertoRepository.findByIdProcessoSufixo(anyString()))
                .thenAnswer(inv -> store.values().stream()
                        .filter(d -> inv.getArgument(0).equals(d.getIdProcessoSufixo()))
                        .toList());

        VarreduraPessoaRepository varreduraRepository = mock(VarreduraPessoaRepository.class);
        when(varreduraRepository.save(any(VarreduraPessoaEntity.class))).thenAnswer(inv -> {
            VarreduraPessoaEntity v = inv.getArgument(0);
            if (v.getId() == null) {
                v.setId((long) varreduras.size() + 1);
                varreduras.add(v);
            }
            return v;
        });

        SegredoJusticaContagemRepository segredoRepository = mock(SegredoJusticaContagemRepository.class);
        when(segredoRepository.findByPessoaId(anyLong())).thenReturn(List.of());
        when(segredoRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        service = new VarreduraPessoaService(
                new ProjudiOrquestradorGate(), // gate REAL: exercita tryExecutar de verdade
                busca,
                pessoaRepository,
                processoRepository,
                descobertoRepository,
                varreduraRepository,
                segredoRepository);
    }

    @Test
    void baselineParcialNaoSetaBaselineEmEReexecucaoCompletaSemViolarUnique() {
        // 1ª execução: falha na página 2.
        falharNaPagina2 = true;
        VarreduraPessoaService.ResultadoVarredura r1 =
                service.varrerPessoa(PESSOA_ID, CREDENCIAL_ID, (JobRunContext) null);

        assertTrue(r1.executada());
        assertEquals(StatusVarredura.ERRO, r1.status());
        assertNull(pessoa.getBaselineEm(), "baseline_em deve permanecer NULL após falha no meio");
        assertEquals(3, store.size(), "linhas das páginas 0 e 1 devem estar gravadas (A, B, C)");
        assertTrue(store.keySet().containsAll(
                List.of("42|1111111-11|2020", "42|2222222-22|2021", "42|3333333-33|2022")));
        VarreduraPessoaEntity v1 = varreduras.get(0);
        assertEquals(StatusVarredura.ERRO, v1.getStatus());
        assertEquals("ESTRUTURA_INESPERADA", v1.getErroCodigo());

        // 2ª execução: página 2 responde. Regravar A, B, C não pode estourar o UNIQUE
        // simulado — se o serviço fizesse INSERT cru, o fake lançaria
        // DataIntegrityViolationException e o status viria ERRO.
        falharNaPagina2 = false;
        VarreduraPessoaService.ResultadoVarredura r2 =
                service.varrerPessoa(PESSOA_ID, CREDENCIAL_ID, (JobRunContext) null);

        assertEquals(StatusVarredura.SUCESSO, r2.status());
        assertNotNull(pessoa.getBaselineEm(), "baseline_em deve ser setado só na execução completa");
        assertEquals(5, store.size(), "as 5 linhas não-opacas devem existir exatamente uma vez");
        store.values().forEach(d ->
                assertEquals(SituacaoProcessoDescoberto.BASELINE, d.getSituacao()));
        VarreduraPessoaEntity v2 = varreduras.get(1);
        assertEquals(StatusVarredura.SUCESSO, v2.getStatus());
        assertNull(v2.getErroCodigo());
    }
}
