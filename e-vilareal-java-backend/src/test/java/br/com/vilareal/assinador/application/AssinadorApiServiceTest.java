package br.com.vilareal.assinador.application;

import br.com.vilareal.assinador.api.dto.AssinadorArquivoResponse;
import br.com.vilareal.assinador.api.dto.AssinadorConcluirResponse;
import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService.ArquivoAssinadoRecebido;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService.ItemAssinado;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoArquivoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.api.io.TempDir;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssinadorApiServiceTest {

    private static final String ASSINADOR_ID = "win-test-1";

    @Mock
    private AssinaturaLoteService assinaturaLoteService;

    @Mock
    private ProjudiPeticaoAssinaturaService peticaoAssinaturaService;

    @Mock
    private ProjudiPeticaoArquivoRepository arquivoRepository;

    @TempDir
    Path tempDir;

    private AssinadorApiService service;

    @BeforeEach
    void setUp() {
        service = new AssinadorApiService(
                assinaturaLoteService,
                peticaoAssinaturaService,
                arquivoRepository,
                new ObjectMapper(),
                tempDir.toString());
    }

    @Test
    void tentarClaimProximoLote_retornaMetadados() {
        AssinaturaLoteEntity lote = lote(10L, List.of(100L));
        ProjudiPeticaoArquivoEntity arquivo = arquivo(5L, 100L, 1, "100_1_deadbeef.pdf");
        when(assinaturaLoteService.pegarProximoLotePendente(ASSINADOR_ID)).thenReturn(Optional.of(lote));
        when(arquivoRepository.findByStatusAndPeticaoIdIn("PENDENTE_ASSINATURA", List.of(100L)))
                .thenReturn(List.of(arquivo));

        var resp = service.tentarClaimProximoLote(ASSINADOR_ID).orElseThrow();

        assertThat(resp.loteId()).isEqualTo(10L);
        assertThat(resp.arquivos()).hasSize(1);
        assertThat(resp.arquivos().getFirst().nomeCanonicoP7s()).isEqualTo("100_1_deadbeef.pdf.p7s");
    }

    @Test
    void obterPdf_validaLoteTravado() throws Exception {
        AssinaturaLoteEntity lote = lote(10L, List.of(100L));
        ProjudiPeticaoArquivoEntity arquivo = arquivo(5L, 100L, 1, "100_1_deadbeef.pdf");
        Path pdf = tempDir.resolve("100_1_deadbeef.pdf");
        Files.write(pdf, "%PDF-1.4 test".getBytes());

        when(assinaturaLoteService.exigirLoteEmAssinaturaDoAssinador(10L, ASSINADOR_ID)).thenReturn(lote);
        when(arquivoRepository.findByIdWithPeticao(5L)).thenReturn(Optional.of(arquivo));

        byte[] bytes = service.obterPdfDoLote(10L, 5L, ASSINADOR_ID);
        assertThat(bytes).startsWith("%PDF".getBytes());
    }

    @Test
    void obterPdf_rejeitaArquivoDeOutroLote() {
        AssinaturaLoteEntity lote = lote(10L, List.of(100L));
        ProjudiPeticaoArquivoEntity arquivo = arquivo(5L, 999L, 1, "999_1_deadbeef.pdf");
        when(assinaturaLoteService.exigirLoteEmAssinaturaDoAssinador(10L, ASSINADOR_ID)).thenReturn(lote);
        when(arquivoRepository.findByIdWithPeticao(5L)).thenReturn(Optional.of(arquivo));

        assertThatThrownBy(() -> service.obterPdfDoLote(10L, 5L, ASSINADOR_ID))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("não pertence");
    }

    @Test
    void concluir_chamaReceberAssinados_eMarcaConcluido() {
        AssinaturaLoteEntity lote = lote(10L, List.of(100L));
        ProjudiPeticaoArquivoEntity arquivo = arquivo(5L, 100L, 1, "100_1_deadbeef.pdf");
        when(assinaturaLoteService.exigirLoteEmAssinaturaDoAssinador(10L, ASSINADOR_ID)).thenReturn(lote);
        when(arquivoRepository.findByStatusAndPeticaoIdIn("PENDENTE_ASSINATURA", List.of(100L)))
                .thenReturn(List.of(arquivo));

        MockMultipartFile p7s =
                new MockMultipartFile("arquivosP7s", "100_1_deadbeef.pdf.p7s", "application/pkcs7-signature", new byte[] {1, 2});
        when(peticaoAssinaturaService.receberAssinados(any(), eq(false), eq(List.of(100L)))).thenReturn(List.of(
                new ItemAssinado(
                        "100_1_deadbeef.pdf.p7s",
                        ProjudiPeticaoAssinaturaService.ResultadoPareamento.PAREADO,
                        100L,
                        1,
                        null)));

        AssinadorConcluirResponse resp = service.concluirLote(10L, ASSINADOR_ID, List.of(p7s));

        ArgumentCaptor<List<ArquivoAssinadoRecebido>> captor = ArgumentCaptor.forClass(List.class);
        verify(peticaoAssinaturaService).receberAssinados(captor.capture(), eq(false), eq(List.of(100L)));
        assertThat(captor.getValue()).hasSize(1);
        verify(assinaturaLoteService).concluirLote(eq(10L), any());
        assertThat(resp.status()).isEqualTo(AssinaturaLoteStatus.CONCLUIDO.name());
        assertThat(resp.pareadas()).isEqualTo(1);
    }

    @Test
    void registrarFalha_marcaErro() {
        AssinaturaLoteEntity lote = lote(10L, List.of(100L));
        when(assinaturaLoteService.exigirLoteEmAssinaturaDoAssinador(10L, ASSINADOR_ID)).thenReturn(lote);

        service.registrarFalha(10L, ASSINADOR_ID, "TOKEN_OCUPADO", "Token em uso");

        verify(assinaturaLoteService).falharLote(10L, "TOKEN_OCUPADO", "Token em uso");
    }

    private static AssinaturaLoteEntity lote(long id, List<Long> peticaoIds) {
        AssinaturaLoteEntity lote = new AssinaturaLoteEntity();
        lote.setId(id);
        lote.setCredencialId(1L);
        lote.setPeticaoIds(peticaoIds);
        lote.setStatus(AssinaturaLoteStatus.EM_ASSINATURA);
        return lote;
    }

    private static ProjudiPeticaoArquivoEntity arquivo(long id, long peticaoId, int ordem, String pdfRef) {
        ProjudiPeticaoEntity peticao = new ProjudiPeticaoEntity();
        peticao.setId(peticaoId);
        ProjudiPeticaoArquivoEntity arquivo = new ProjudiPeticaoArquivoEntity();
        arquivo.setId(id);
        arquivo.setPeticao(peticao);
        arquivo.setOrdem(ordem);
        arquivo.setPdfRef(pdfRef);
        arquivo.setPdfSha256("deadbeef".repeat(8));
        arquivo.setStatus("PENDENTE_ASSINATURA");
        return arquivo;
    }
}
