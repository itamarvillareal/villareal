package br.com.vilareal.pje.application;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doThrow;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class PjeDriveArquivamentoServiceTest {

    private static final String CNJ = "0012345-67.2024.5.18.0001";
    private static final String PASTA_ID = "pasta-mov-123";
    private static final String NOME_ARQUIVO = "Processo_" + CNJ + ".pdf";

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private DocumentoDrivePastaService documentoDrivePastaService;

    @Mock
    private GoogleDriveService googleDriveService;

    private PjeDriveArquivamentoService service;
    private ProcessoEntity processo;

    @BeforeEach
    void setUp() throws Exception {
        service = new PjeDriveArquivamentoService(
                processoRepository, documentoDrivePastaService, googleDriveService);
        processo = processo();
        configurarPastaMovimentacoes();
        when(googleDriveService.isConfigurado()).thenReturn(true);
    }

    @Test
    void enviarCopiaIntegral_duasRebaixadas_mantemUmArquivoAtualizado() throws Exception {
        byte[] pdf1 = new byte[] {1};
        byte[] pdf2 = new byte[] {2};
        byte[] pdf3 = new byte[] {3};

        when(googleDriveService.buscarFileIdsPorNomeNaPasta(PASTA_ID, NOME_ARQUIVO)).thenReturn(List.of());
        when(googleDriveService.uploadArquivo(pdf1, NOME_ARQUIVO, "application/pdf", PASTA_ID))
                .thenReturn(dto("file-unico"));

        var r1 = service.enviarCopiaIntegral(processo, CNJ, pdf1, NOME_ARQUIVO);
        assertThat(r1.driveFileId()).isEqualTo("file-unico");

        when(googleDriveService.buscarFileIdsPorNomeNaPasta(PASTA_ID, NOME_ARQUIVO))
                .thenReturn(List.of("file-unico"));

        var r2 = service.enviarCopiaIntegral(processo, CNJ, pdf2, NOME_ARQUIVO);
        assertThat(r2.driveFileId()).isEqualTo("file-unico");
        verify(googleDriveService).atualizarConteudoArquivo("file-unico", pdf2, "application/pdf");

        var r3 = service.enviarCopiaIntegral(processo, CNJ, pdf3, NOME_ARQUIVO);
        assertThat(r3.driveFileId()).isEqualTo("file-unico");
        verify(googleDriveService).atualizarConteudoArquivo("file-unico", pdf3, "application/pdf");
        verify(googleDriveService, times(1)).uploadArquivo(any(), eq(NOME_ARQUIVO), anyString(), eq(PASTA_ID));
        verify(googleDriveService, never()).enviarParaLixeira(anyString());
    }

    @Test
    void enviarCopiaIntegral_duplicatas_limpaExtrasEAtualizaPrimeiro() throws Exception {
        byte[] pdf = new byte[] {9};
        when(googleDriveService.buscarFileIdsPorNomeNaPasta(PASTA_ID, NOME_ARQUIVO))
                .thenReturn(List.of("id-manter", "id-duplicata"));

        var r = service.enviarCopiaIntegral(processo, CNJ, pdf, NOME_ARQUIVO);

        assertThat(r.driveFileId()).isEqualTo("id-manter");
        verify(googleDriveService).atualizarConteudoArquivo("id-manter", pdf, "application/pdf");
        verify(googleDriveService).enviarParaLixeira("id-duplicata");
        verify(googleDriveService, never()).uploadArquivo(any(), anyString(), anyString(), anyString());
    }

    @Test
    void enviarCopiaIntegral_buscaFalha_fazUploadFallback() throws Exception {
        byte[] pdf = new byte[] {5};
        doThrow(new RuntimeException("drive indisponível"))
                .when(googleDriveService)
                .buscarFileIdsPorNomeNaPasta(PASTA_ID, NOME_ARQUIVO);
        when(googleDriveService.uploadArquivo(pdf, NOME_ARQUIVO, "application/pdf", PASTA_ID))
                .thenReturn(dto("file-novo"));

        var r = service.enviarCopiaIntegral(processo, CNJ, pdf, NOME_ARQUIVO);

        assertThat(r.driveFileId()).isEqualTo("file-novo");
        verify(googleDriveService).uploadArquivo(pdf, NOME_ARQUIVO, "application/pdf", PASTA_ID);
    }

    private void configurarPastaMovimentacoes() throws Exception {
        when(documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo)).thenReturn("00000001");
        when(documentoDrivePastaService.resolverPastaRaizProcesso(googleDriveService, "00000001", 1))
                .thenReturn(new DrivePastaProcessoDto("raiz-id", null, null, null));
        when(googleDriveService.encontrarOuCriarPastaPublic(
                        PjeDriveArquivamentoService.PASTA_MOVIMENTACOES, "raiz-id"))
                .thenReturn(PASTA_ID);
    }

    private static ProcessoEntity processo() {
        ProcessoEntity p = new ProcessoEntity();
        p.setNumeroInterno(1);
        return p;
    }

    private static DriveArquivoDto dto(String id) {
        return new DriveArquivoDto(id, NOME_ARQUIVO, null, null, null, null, null, null, null);
    }
}
