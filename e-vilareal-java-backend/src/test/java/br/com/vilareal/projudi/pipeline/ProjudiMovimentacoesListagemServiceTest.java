package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.projudi.ProjudiNumeroReduzidoUtil;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

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
        when(teorService.listarMovimentacoes(CREDENCIAL_ID, REDUZIDO)).thenReturn(doReduzido);

        List<MovimentacaoProjudi> resultado =
                listagemService.listarComFallbackReduzido(CREDENCIAL_ID, CNJ);

        assertThat(resultado).isSameAs(doReduzido);
        verify(teorService).listarMovimentacoes(CREDENCIAL_ID, REDUZIDO);
        verify(teorService, never()).listarMovimentacoes(eq(CREDENCIAL_ID), eq(CNJ));
    }

    @Test
    void reduzidoVazio_reduzidoDiferenteDoCnj_chamaCompleto() {
        List<MovimentacaoProjudi> doCompleto = List.of(mov("26"), mov("25"));
        when(teorService.listarMovimentacoes(CREDENCIAL_ID, REDUZIDO)).thenReturn(List.of());
        when(teorService.listarMovimentacoes(CREDENCIAL_ID, CNJ)).thenReturn(doCompleto);

        List<MovimentacaoProjudi> resultado =
                listagemService.listarComFallbackReduzido(CREDENCIAL_ID, CNJ);

        assertThat(resultado).isSameAs(doCompleto);
        verify(teorService).listarMovimentacoes(CREDENCIAL_ID, REDUZIDO);
        verify(teorService).listarMovimentacoes(CREDENCIAL_ID, CNJ);
    }

    @Test
    void reduzidoVazio_reduzidoIgualAoCnj_naoChamaCompleto() {
        String cnjCurto = "5717034.38";
        assertThat(ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido(cnjCurto)).isEqualTo(cnjCurto);

        when(teorService.listarMovimentacoes(CREDENCIAL_ID, cnjCurto)).thenReturn(List.of());

        List<MovimentacaoProjudi> resultado =
                listagemService.listarComFallbackReduzido(CREDENCIAL_ID, cnjCurto);

        assertThat(resultado).isEmpty();
        verify(teorService).listarMovimentacoes(CREDENCIAL_ID, cnjCurto);
        verify(teorService, never()).listarMovimentacoes(eq(CREDENCIAL_ID), eq(CNJ));
    }

    private static MovimentacaoProjudi mov(String numero) {
        return new MovimentacaoProjudi(
                numero, "T", "D", "01/01/2026 10:00:00", "u", "c", "i", "tok", true);
    }
}
