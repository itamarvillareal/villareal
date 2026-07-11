package br.com.vilareal.monitoramento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.monitoramento.api.dto.ProcessoDescobertoResponse;
import br.com.vilareal.monitoramento.domain.PoloDaPessoa;
import br.com.vilareal.monitoramento.domain.RotuloProcessoDescoberto;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.SegredoJusticaContagemRepository;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.VarreduraPessoaRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class MonitoramentoConsultaServiceTest {

    /** "Agora" fixo: 2026-07-10T12:00 em UTC-3. */
    private static final Instant AGORA = Instant.parse("2026-07-10T15:00:00Z");
    private static final ZoneId ZONA = ZoneId.of("America/Sao_Paulo");

    private ProcessoDescobertoRepository descobertoRepository;
    private MonitoramentoConsultaService service;
    private PessoaEntity pessoa;

    @BeforeEach
    void setUp() {
        descobertoRepository = mock(ProcessoDescobertoRepository.class);
        SegredoJusticaContagemRepository segredoRepository = mock(SegredoJusticaContagemRepository.class);
        PessoaRepository pessoaRepository = mock(PessoaRepository.class);
        when(pessoaRepository.existsById(anyLong())).thenReturn(true);
        service = new MonitoramentoConsultaService(
                descobertoRepository,
                segredoRepository,
                mock(VarreduraPessoaRepository.class),
                pessoaRepository,
                Clock.fixed(AGORA, ZONA));

        pessoa = new PessoaEntity();
        pessoa.setId(1809L);
        pessoa.setNome("SE77E TELECOM EIRELI ME");
    }

    private ProcessoDescobertoEntity descoberto(
            long id,
            SituacaoProcessoDescoberto situacao,
            LocalDateTime dataDistribuicao,
            Instant primeiroVistoEm,
            Long processoId) {
        ProcessoDescobertoEntity d = new ProcessoDescobertoEntity();
        d.setId(id);
        d.setPessoa(pessoa);
        d.setNumeroReduzido("5000000-0" + id);
        d.setAnoDistribuicao(dataDistribuicao.getYear());
        d.setDataDistribuicao(dataDistribuicao);
        d.setSituacao(situacao);
        d.setPoloDaPessoa(PoloDaPessoa.INDETERMINADO);
        if (processoId != null) {
            ProcessoEntity p = new ProcessoEntity();
            p.setId(processoId);
            d.setProcesso(p);
        }
        // primeiroVistoEm é insertable=false (banco preenche); nos testes seta via reflexão
        // para provar que o recorte "recentes" NÃO olha para ele.
        try {
            var f = ProcessoDescobertoEntity.class.getDeclaredField("primeiroVistoEm");
            f.setAccessible(true);
            f.set(d, primeiroVistoEm);
        } catch (ReflectiveOperationException e) {
            throw new IllegalStateException(e);
        }
        return d;
    }

    @Test
    void rotuloDerivadoCobreAsCincoCombinacoes() {
        assertEquals("Alerta",
                RotuloProcessoDescoberto.derivar(SituacaoProcessoDescoberto.NOVO, false));
        assertEquals("No seu acervo",
                RotuloProcessoDescoberto.derivar(SituacaoProcessoDescoberto.BASELINE, true));
        assertEquals("Histórico (não cadastrado)",
                RotuloProcessoDescoberto.derivar(SituacaoProcessoDescoberto.BASELINE, false));
        assertEquals("Ignorado",
                RotuloProcessoDescoberto.derivar(SituacaoProcessoDescoberto.IGNORADO, false));
        assertEquals("No seu acervo",
                RotuloProcessoDescoberto.derivar(SituacaoProcessoDescoberto.VINCULADO, true));
    }

    @Test
    void recentesFiltraPorDataDistribuicaoNaoPorPrimeiroVistoEm() {
        // Distribuído há 60 dias mas visto HOJE (pessoa recém-marcada): NÃO é recente.
        ProcessoDescobertoEntity antigoVistoHoje = descoberto(
                1L, SituacaoProcessoDescoberto.BASELINE,
                LocalDateTime.now(Clock.fixed(AGORA, ZONA)).minusDays(60), AGORA, null);
        // Distribuído há 5 dias mas visto há 60 (hipotético): É recente.
        ProcessoDescobertoEntity frescoVistoHaMuito = descoberto(
                2L, SituacaoProcessoDescoberto.NOVO,
                LocalDateTime.now(Clock.fixed(AGORA, ZONA)).minusDays(5),
                AGORA.minusSeconds(60L * 24 * 3600), null);
        when(descobertoRepository.findDaPessoaOrdenadoPorDistribuicao(1809L))
                .thenReturn(List.of(frescoVistoHaMuito, antigoVistoHoje));

        List<ProcessoDescobertoResponse> recentes = service.descobertosDaPessoa(1809L, null, true);

        assertEquals(1, recentes.size());
        assertEquals(2L, recentes.get(0).id(),
                "recorte deve manter o distribuído há 5 dias e descartar o de 60, "
                        + "independentemente de primeiro_visto_em");
    }

    @Test
    void filtroDeSituacaoERotuloNaSaida() {
        ProcessoDescobertoEntity baselineComAcervo = descoberto(
                1L, SituacaoProcessoDescoberto.BASELINE,
                LocalDateTime.of(2026, 1, 10, 10, 0), AGORA, 182L);
        ProcessoDescobertoEntity novo = descoberto(
                2L, SituacaoProcessoDescoberto.NOVO,
                LocalDateTime.of(2026, 7, 1, 10, 0), AGORA, null);
        when(descobertoRepository.findDaPessoaOrdenadoPorDistribuicao(1809L))
                .thenReturn(List.of(novo, baselineComAcervo));

        List<ProcessoDescobertoResponse> soBaseline = service.descobertosDaPessoa(1809L, "baseline", false);
        assertEquals(1, soBaseline.size());
        assertEquals("No seu acervo", soBaseline.get(0).rotulo());
        assertEquals(182L, soBaseline.get(0).processoId());

        List<ProcessoDescobertoResponse> todos = service.descobertosDaPessoa(1809L, null, false);
        assertEquals(2, todos.size());
        assertEquals("Alerta", todos.get(0).rotulo());
    }

    @Test
    void caixaDeEntradaDefaultNovoEViaRepositorioAgregado() {
        ProcessoDescobertoEntity novo = descoberto(
                7L, SituacaoProcessoDescoberto.NOVO, LocalDateTime.of(2026, 7, 8, 9, 0), AGORA, null);
        when(descobertoRepository.findCaixaDeEntrada(SituacaoProcessoDescoberto.NOVO))
                .thenReturn(List.of(novo));

        List<ProcessoDescobertoResponse> caixa = service.caixaDeEntrada(null);
        assertEquals(1, caixa.size());
        assertEquals("Alerta", caixa.get(0).rotulo());
        assertEquals(1809L, caixa.get(0).pessoa().id());
    }

    @Test
    void situacaoInvalidaEPessoaInexistenteFalhamClaro() {
        assertThrows(BusinessRuleException.class, () -> service.caixaDeEntrada("XYZ"));

        PessoaRepository pessoaRepository = mock(PessoaRepository.class);
        when(pessoaRepository.existsById(anyLong())).thenReturn(false);
        MonitoramentoConsultaService semPessoa = new MonitoramentoConsultaService(
                descobertoRepository,
                mock(SegredoJusticaContagemRepository.class),
                mock(VarreduraPessoaRepository.class),
                pessoaRepository,
                Clock.fixed(AGORA, ZONA));
        assertThrows(ResourceNotFoundException.class,
                () -> semPessoa.descobertosDaPessoa(999L, null, false));
    }
}
