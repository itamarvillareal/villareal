package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiDriveMovimentacoesPdfSupport;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
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
}
