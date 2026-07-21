package br.com.vilareal.processo.application;

import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.pipeline.ProjudiDriveArquivamentoService;
import br.com.vilareal.projudi.pipeline.ProjudiMovimentacoesListagemService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProcessoProjudiAcervoIntegralDriveCheckerServiceTest {

    @Mock
    private ProjudiMovimentacoesListagemService movimentacoesListagemService;

    @Mock
    private ProjudiDriveArquivamentoService driveArquivamentoService;

    @Mock
    private GoogleDriveService googleDriveService;

    private ProcessoProjudiAcervoIntegralDriveCheckerService service;
    private ProcessoEntity processo;

    @BeforeEach
    void setUp() {
        service = new ProcessoProjudiAcervoIntegralDriveCheckerService(
                movimentacoesListagemService, driveArquivamentoService, googleDriveService);
        processo = new ProcessoEntity();
        processo.setId(1L);
        processo.setNumeroCnj("5059346-36.2026.8.09.0007");
        processo.setTramitacao("Projudi");
        processo.setNumeroInterno(10);
    }

    @Test
    void verificar_completoQuandoTodosNumerosEstaoNoDrive() throws Exception {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        var mov30 = mov(30, "481111");
        var mov26 = mov(26, "481112");
        when(movimentacoesListagemService.listarComFallbackReduzido(eq(1L), anyString()))
                .thenReturn(new ProjudiMovimentacoesListagemService.ListagemMovimentacoes(
                        List.of(mov30, mov26), null));
        when(driveArquivamentoService.resolverPastaMovimentacoesId(eq(processo), anyString(), anyList()))
                .thenReturn("pasta-mov");
        when(googleDriveService.listarFilhos("pasta-mov"))
                .thenReturn(List.of(
                        arquivo("30 Movimentação - Arquivo.pdf"),
                        arquivo("26 Movimentação - Arquivo.pdf")));

        var r = service.verificar(processo, 1L);

        assertTrue(r.completo());
        assertEquals(2, r.totalComDocumento());
        assertEquals(0, r.faltantes());
    }

    @Test
    void verificar_incompletoQuandoFaltaMovimentacao() throws Exception {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        when(movimentacoesListagemService.listarComFallbackReduzido(eq(1L), anyString()))
                .thenReturn(new ProjudiMovimentacoesListagemService.ListagemMovimentacoes(
                        List.of(mov(30, "481111"), mov(26, "481112")), null));
        when(driveArquivamentoService.resolverPastaMovimentacoesId(eq(processo), anyString(), anyList()))
                .thenReturn("pasta-mov");
        when(googleDriveService.listarFilhos("pasta-mov"))
                .thenReturn(List.of(arquivo("30 Movimentação - Arquivo.pdf")));

        var r = service.verificar(processo, 1L);

        assertFalse(r.completo());
        assertEquals(1, r.faltantes());
    }

    private static ProjudiTeorService.MovimentacaoProjudi mov(int numero, String idArquivo) {
        return new ProjudiTeorService.MovimentacaoProjudi(
                String.valueOf(numero),
                "tipo",
                "desc",
                "2026-01-01 10:00",
                "user",
                "cod",
                "idMovi",
                idArquivo,
                true);
    }

    private static com.google.api.services.drive.model.File arquivo(String nome) {
        com.google.api.services.drive.model.File f = new com.google.api.services.drive.model.File();
        f.setName(nome);
        return f;
    }
}
