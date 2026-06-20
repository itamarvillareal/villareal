package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.projudi.ProjudiNumeroReduzidoUtil;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.ProjudiTeorService.ConsultaProcessoProjudi;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiMovimentacoesListagemServiceTest {

    private static final Long CREDENCIAL_ID = 1L;
    private static final String CNJ = "5059346-36.2026.8.09.0007";
    private static final String REDUZIDO = ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido(CNJ);

    @Mock
    private ProjudiTeorService teorService;

    private ProjudiMovimentacoesListagemService listagemService;

    @BeforeEach
    void setUp() {
        listagemService = new ProjudiMovimentacoesListagemService(teorService);
    }

    @Test
    void reduzidoComResultado_naoChamaCnjCompleto() {
        List<MovimentacaoProjudi> doReduzido = List.of(mov("1"));
        when(teorService.consultarProcesso(CREDENCIAL_ID, REDUZIDO))
                .thenReturn(new ConsultaProcessoProjudi(doReduzido, LocalDate.of(2024, 3, 20)));

        ProjudiMovimentacoesListagemService.ListagemMovimentacoes resultado =
                listagemService.listarComFallbackReduzido(CREDENCIAL_ID, CNJ);

        assertThat(resultado.movimentacoes()).isSameAs(doReduzido);
        assertThat(resultado.dataDistribuicao()).isEqualTo(LocalDate.of(2024, 3, 20));
        verify(teorService).consultarProcesso(CREDENCIAL_ID, REDUZIDO);
        verify(teorService, never()).consultarProcesso(eq(CREDENCIAL_ID), eq(CNJ));
    }

    @Test
    void reduzidoVazio_reduzidoDiferenteDoCnj_chamaCompleto() {
        List<MovimentacaoProjudi> doCompleto = List.of(mov("26"), mov("25"));
        when(teorService.consultarProcesso(CREDENCIAL_ID, REDUZIDO))
                .thenReturn(new ConsultaProcessoProjudi(List.of(), LocalDate.of(2024, 1, 1)));
        when(teorService.consultarProcesso(CREDENCIAL_ID, CNJ))
                .thenReturn(new ConsultaProcessoProjudi(doCompleto, LocalDate.of(2024, 2, 2)));

        ProjudiMovimentacoesListagemService.ListagemMovimentacoes resultado =
                listagemService.listarComFallbackReduzido(CREDENCIAL_ID, CNJ);

        assertThat(resultado.movimentacoes()).isSameAs(doCompleto);
        assertThat(resultado.dataDistribuicao()).isEqualTo(LocalDate.of(2024, 2, 2));
        verify(teorService).consultarProcesso(CREDENCIAL_ID, REDUZIDO);
        verify(teorService).consultarProcesso(CREDENCIAL_ID, CNJ);
    }

    @Test
    void reduzidoVazio_reduzidoIgualAoCnj_naoChamaCompleto() {
        String cnjCurto = "5717034.38";
        assertThat(ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido(cnjCurto)).isEqualTo(cnjCurto);

        when(teorService.consultarProcesso(CREDENCIAL_ID, cnjCurto))
                .thenReturn(new ConsultaProcessoProjudi(List.of(), null));

        ProjudiMovimentacoesListagemService.ListagemMovimentacoes resultado =
                listagemService.listarComFallbackReduzido(CREDENCIAL_ID, cnjCurto);

        assertThat(resultado.movimentacoes()).isEmpty();
        verify(teorService).consultarProcesso(CREDENCIAL_ID, cnjCurto);
        verify(teorService, never()).consultarProcesso(eq(CREDENCIAL_ID), eq(CNJ));
    }

    private static MovimentacaoProjudi mov(String numero) {
        return new MovimentacaoProjudi(
                numero, "", "", "", "", "", "", null, false);
    }
}
