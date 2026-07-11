package br.com.vilareal.monitoramento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.monitoramento.api.dto.ProcessoDescobertoResponse;
import br.com.vilareal.monitoramento.domain.PoloDaPessoa;
import br.com.vilareal.monitoramento.domain.SituacaoProcessoDescoberto;
import br.com.vilareal.monitoramento.infrastructure.persistence.entity.ProcessoDescobertoEntity;
import br.com.vilareal.monitoramento.infrastructure.persistence.repository.ProcessoDescobertoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.projudi.ProjudiBuscaParteService;
import br.com.vilareal.projudi.ProjudiBuscaParteService.DetalheProcesso;
import br.com.vilareal.projudi.ProjudiBuscaParteService.LinhaLista;
import br.com.vilareal.projudi.ProjudiBuscaParteService.PaginaLista;
import br.com.vilareal.projudi.ProjudiOrquestradorGate;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class MonitoramentoTriagemServiceTest {

    private ProcessoDescobertoRepository repo;
    private ProjudiBuscaParteService busca;
    private MonitoramentoTriagemService service;
    private ProcessoDescobertoEntity descoberto;

    @BeforeEach
    void setUp() {
        repo = mock(ProcessoDescobertoRepository.class);
        busca = mock(ProjudiBuscaParteService.class);
        service = new MonitoramentoTriagemService(repo, busca, new ProjudiOrquestradorGate(), 1L);

        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(6613L);
        pessoa.setNome("D J BONAN AUTOPECAS E SERVICOS LTDA");
        pessoa.setCpf("42800038000199");

        descoberto = new ProcessoDescobertoEntity();
        descoberto.setId(3L);
        descoberto.setPessoa(pessoa);
        descoberto.setNumeroReduzido("5606575-35");
        descoberto.setAnoDistribuicao(2026);
        descoberto.setDataDistribuicao(LocalDateTime.of(2026, 7, 2, 16, 33, 59));
        descoberto.setSituacao(SituacaoProcessoDescoberto.BASELINE);
        descoberto.setPoloDaPessoa(PoloDaPessoa.PASSIVO);

        when(repo.findByIdComPessoa(3L)).thenReturn(Optional.of(descoberto));
        when(repo.save(any(ProcessoDescobertoEntity.class))).thenAnswer(inv -> inv.getArgument(0));
    }

    private static LinhaLista linha(String reduzido, LocalDateTime dist, String token) {
        return new LinhaLista(reduzido, dist, token, token.substring(Math.max(0, token.length() - 12)),
                List.of("Alguém"), List.of("Outro Alguém"), false, null);
    }

    @Test
    void enriquecerReencontraLinhaComTokenFrescoEAbreDetalhe() {
        // Página única: o alvo está nela com token FRESCO desta "sessão".
        when(busca.primeiraPagina(eq(1L), anyString())).thenReturn(new PaginaLista(
                List.of(
                        linha("5038553-76", LocalDateTime.of(2026, 1, 19, 15, 0), "tokA111111111111"),
                        linha("5606575-35", LocalDateTime.of(2026, 7, 2, 16, 33, 59), "tokFRESCO9999999")),
                0));
        when(busca.abrirDetalhe(1L, "tokFRESCO9999999"))
                .thenReturn(new DetalheProcesso("5606575-35.2026.8.09.0006", "Execução de Título", "Anápolis - X"));

        ProcessoDescobertoResponse r = service.enriquecer(3L);

        assertEquals("5606575-35.2026.8.09.0006", r.numeroCnj());
        assertEquals("Execução de Título", r.classe());
        assertEquals("Anápolis - X", r.serventia());
        verify(busca).abrirDetalhe(1L, "tokFRESCO9999999");
    }

    @Test
    void enriquecerNaoLocalizadoFalhaClaroSemVarrerListaInteira() {
        // 3 páginas; o alvo (distribuído 2026-07-02) NÃO está em nenhuma. A última página só
        // tem itens mais antigos que o alvo → para já na primeira página varrida.
        when(busca.primeiraPagina(eq(1L), anyString())).thenReturn(new PaginaLista(
                List.of(linha("1111111-11", LocalDateTime.of(2020, 1, 1, 10, 0), "tok1")), 2));
        when(busca.paginaEm(eq(1L), eq(2))).thenReturn(new PaginaLista(
                List.of(linha("2222222-22", LocalDateTime.of(2026, 6, 30, 10, 0), "tok2")), 2));

        BusinessRuleException e = assertThrows(BusinessRuleException.class, () -> service.enriquecer(3L));
        assertTrue(e.getMessage().contains("não localizado no PROJUDI atual"));
        // Early-stop: página 2 (mais novos < alvo) basta; páginas 1 e 0 não são visitadas.
        verify(busca, never()).paginaEm(anyLong(), eq(1));
        verify(busca, never()).abrirDetalhe(anyLong(), anyString());
    }

    @Test
    void enriquecerIdempotenteQuandoJaCompleto() {
        descoberto.setNumeroCnj("5606575-35.2026.8.09.0006");
        descoberto.setClasse("Execução");
        descoberto.setServentia("Anápolis - X");

        ProcessoDescobertoResponse r = service.enriquecer(3L);

        assertEquals("5606575-35.2026.8.09.0006", r.numeroCnj());
        verify(busca, never()).primeiraPagina(anyLong(), anyString());
    }

    @Test
    void ignorarPersisteSituacao() {
        ProcessoDescobertoResponse r = service.ignorar(3L);
        assertEquals("IGNORADO", r.situacao());
        assertEquals("Ignorado", r.rotulo());
        verify(repo).save(descoberto);
        assertEquals(SituacaoProcessoDescoberto.IGNORADO, descoberto.getSituacao());
    }
}
