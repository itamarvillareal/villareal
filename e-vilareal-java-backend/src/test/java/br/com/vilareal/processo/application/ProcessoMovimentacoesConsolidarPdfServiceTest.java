package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiDriveMovimentacoesPdfSupport;
import com.google.api.services.drive.model.File;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessoMovimentacoesConsolidarPdfServiceTest {

    @Mock
    private ProcessoRepository processoRepository;

    @Mock
    private GoogleDriveService googleDriveService;

    @Mock
    private ProjudiDriveMovimentacoesPdfSupport movimentacoesPdfSupport;

    @InjectMocks
    private ProcessoMovimentacoesConsolidarPdfService service;

    @Test
    void gerarPdf_processoInexistente_lancaNotFound() {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        when(processoRepository.findByIdWithClienteAndPessoa(99L)).thenReturn(Optional.empty());

        assertThrows(ResourceNotFoundException.class, () -> service.gerarPdf(99L));
    }

    @Test
    void gerarPdf_semPastaMovimentacoes_lancaNotFound() throws Exception {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(1L);
        when(processoRepository.findByIdWithClienteAndPessoa(1L)).thenReturn(Optional.of(processo));
        when(movimentacoesPdfSupport.resolverPastaMovimentacoesId(processo)).thenReturn(null);

        assertThrows(ResourceNotFoundException.class, () -> service.gerarPdf(1L));
    }

    @Test
    void gerarPdf_driveNaoConfigurado_lancaBusinessRule() {
        when(googleDriveService.isConfigurado()).thenReturn(false);

        assertThrows(BusinessRuleException.class, () -> service.gerarPdf(1L));
    }

    @Test
    void listarPdfsMovimentacoes_semPasta_retornaVazio() throws Exception {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(1L);
        when(processoRepository.findByIdWithClienteAndPessoa(1L)).thenReturn(Optional.of(processo));
        when(movimentacoesPdfSupport.resolverPastaMovimentacoesId(processo)).thenReturn(null);

        assertTrue(service.listarPdfsMovimentacoes(1L).isEmpty());
    }

    @Test
    void listarPdfsMovimentacoes_mapeiaArquivos() throws Exception {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(1L);
        when(processoRepository.findByIdWithClienteAndPessoa(1L)).thenReturn(Optional.of(processo));
        when(movimentacoesPdfSupport.resolverPastaMovimentacoesId(processo)).thenReturn("pasta-mov");
        File f = new File().setId("abc").setName("0001 Movimentação.pdf").setMimeType("application/pdf").setSize(1024L);
        when(googleDriveService.listarPdfsNaPastaOrdenadosPorNome("pasta-mov")).thenReturn(List.of(f));

        List<DriveArquivoDto> lista = service.listarPdfsMovimentacoes(1L);
        assertEquals(1, lista.size());
        assertEquals("abc", lista.getFirst().id());
        assertEquals("0001 Movimentação.pdf", lista.getFirst().nome());
        assertEquals(1024L, lista.getFirst().tamanho());
    }

    @Test
    void gerarPdfSeletivo_listaVazia_lanca400() {
        ResponseStatusException ex =
                assertThrows(ResponseStatusException.class, () -> service.gerarPdf(1L, List.of()));
        assertEquals(400, ex.getStatusCode().value());
    }

    @Test
    void gerarPdfSeletivo_fileIdInvalido_lanca400() throws Exception {
        when(googleDriveService.isConfigurado()).thenReturn(true);
        ProcessoEntity processo = new ProcessoEntity();
        processo.setId(1L);
        when(processoRepository.findByIdWithClienteAndPessoa(1L)).thenReturn(Optional.of(processo));
        when(movimentacoesPdfSupport.resolverPastaMovimentacoesId(processo)).thenReturn("pasta-mov");
        when(googleDriveService.listarPdfsNaPastaOrdenadosPorNome("pasta-mov")).thenReturn(List.of());

        ResponseStatusException ex = assertThrows(
                ResponseStatusException.class, () -> service.gerarPdf(1L, List.of("id-inexistente")));
        assertEquals(400, ex.getStatusCode().value());
        assertTrue(ex.getReason().contains("id-inexistente"));
    }
}
