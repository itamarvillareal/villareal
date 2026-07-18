package br.com.vilareal.processo.application;

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
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ProcessoMovimentacoesConsolidadoDriveAutoServiceTest {

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private ProcessoMovimentacoesConsolidarPdfService consolidarPdfService;

    @Mock
    private DocumentoDrivePastaService documentoDrivePastaService;

    @Mock
    private GoogleDriveService googleDriveService;

    private ProcessoMovimentacoesConsolidadoDriveAutoService service;

    private ProcessoEntity processo;

    @BeforeEach
    void setUp() {
        service = new ProcessoMovimentacoesConsolidadoDriveAutoService(
                true,
                processoRepository,
                consolidarPdfService,
                documentoDrivePastaService,
                googleDriveService);
        processo = new ProcessoEntity();
        processo.setId(10L);
        processo.setNumeroInterno(42);
        processo.setNumeroCnj("5400529-12.2024.8.09.0001");
        processo.setTramitacao("Projudi");
    }

    @Test
    void atualizar_ignoraQuandoTramitacaoPje() {
        processo.setTramitacao("PJe");
        when(googleDriveService.isConfigurado()).thenReturn(true);
        when(processoRepository.findByIdWithClienteAndPessoa(10L)).thenReturn(Optional.of(processo));

        var r = service.atualizarConsolidadoNoDrive(10L, true);

        assertEquals(ProcessoMovimentacoesConsolidadoDriveAutoService.ResultadoTipo.IGNORADO, r.tipo());
        verifyNoInteractions(consolidarPdfService);
    }

    @Test
    void atualizar_criaArquivoNaPastaPai() throws Exception {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        when(processoRepository.findByIdWithClienteAndPessoa(10L)).thenReturn(Optional.of(processo));
        when(documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo)).thenReturn("C001");
        when(documentoDrivePastaService.resolverPastaRaizProcesso(eq(googleDriveService), eq("C001"), eq(42)))
                .thenReturn(new DrivePastaProcessoDto("pasta-raiz", null, "Proc. 42", "caminho"));
        when(consolidarPdfService.gerarPdf(10L))
                .thenReturn(new ProcessoMovimentacoesConsolidarPdfService.ResultadoConsolidado(
                        new byte[] {1, 2, 3}, "Movimentacoes_Consolidado_5400529.pdf", List.of()));
        when(googleDriveService.buscarArquivoPorNomeNaPasta(
                        eq("pasta-raiz"), eq("Movimentacoes_Consolidado_5400529.pdf")))
                .thenReturn(null);
        when(googleDriveService.uploadArquivo(
                        any(), eq("Movimentacoes_Consolidado_5400529.pdf"), eq("application/pdf"), eq("pasta-raiz")))
                .thenReturn(new DriveArquivoDto("file-1", "Movimentacoes_Consolidado_5400529.pdf", "arquivo", "application/pdf", 3L, null, null, null, null));

        var r = service.atualizarConsolidadoNoDrive(10L, true);

        assertEquals(ProcessoMovimentacoesConsolidadoDriveAutoService.ResultadoTipo.CRIADO, r.tipo());
        assertEquals("file-1", r.driveFileId());
        assertEquals("pasta-raiz", r.pastaDestinoId());
    }

    @Test
    void atualizar_substituiArquivoExistente() throws Exception {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        when(processoRepository.findByIdWithClienteAndPessoa(10L)).thenReturn(Optional.of(processo));
        when(documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo)).thenReturn("C001");
        when(documentoDrivePastaService.resolverPastaRaizProcesso(eq(googleDriveService), eq("C001"), eq(42)))
                .thenReturn(new DrivePastaProcessoDto("pasta-raiz", null, "Proc. 42", "caminho"));
        when(consolidarPdfService.gerarPdf(10L))
                .thenReturn(new ProcessoMovimentacoesConsolidarPdfService.ResultadoConsolidado(
                        new byte[] {9}, "Movimentacoes_Consolidado_5400529.pdf", List.of()));
        when(googleDriveService.buscarArquivoPorNomeNaPasta(
                        eq("pasta-raiz"), eq("Movimentacoes_Consolidado_5400529.pdf")))
                .thenReturn(new DriveArquivoDto("file-old", "Movimentacoes_Consolidado_5400529.pdf", "arquivo", "application/pdf", 1L, null, null, null, null));

        var r = service.atualizarConsolidadoNoDrive(10L, true);

        assertEquals(ProcessoMovimentacoesConsolidadoDriveAutoService.ResultadoTipo.ATUALIZADO, r.tipo());
        verify(googleDriveService).atualizarConteudoArquivo("file-old", new byte[] {9}, "application/pdf");
        verify(googleDriveService, never()).uploadArquivo(any(), anyString(), anyString(), anyString());
    }

    @Test
    void tentarAposArquivamento_naoChamaSemUploads() {
        service.tentarAposArquivamento(processo, 0);
        verifyNoInteractions(consolidarPdfService);
    }
}
