package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.OcrService;
import br.com.vilareal.processo.application.rag.RagArquivoDriveEnviado;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.ProjudiTeorService.ArquivoTeor;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.doReturn;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiDriveArquivamentoServiceTest {

    private static final String CNJ = "5059346-36.2026.8.09.0007";
    private static final String PASTA_ID = "pasta-mov-123";

    @Mock
    private DocumentoDrivePastaService documentoDrivePastaService;

    @Mock
    private GoogleDriveService googleDriveService;

    @Mock
    private OcrService ocrService;

    private ProjudiDriveArquivamentoService service;

    @BeforeEach
    void setUp() {
        service = new ProjudiDriveArquivamentoService(
                documentoDrivePastaService, googleDriveService, ocrService);
    }

    @Test
    void enviar_pastaIdNull_retornaZeroSemDetalhe() {
        List<String> detalhes = new ArrayList<>();
        int n = service.enviarArquivosMovimentacaoAoDrive(
                processoComInterno(1), CNJ, mov("26"), List.of(arquivoPdf()), "a.pdf", null, detalhes);
        assertThat(n).isZero();
        assertThat(detalhes).isEmpty();
    }

    @Test
    void enviar_arquivoJaExiste_naoChamaUpload() throws Exception {
        List<String> detalhes = new ArrayList<>();
        MovimentacaoProjudi mov = mov("26");
        List<ArquivoTeor> arquivos = List.of(arquivoPdf());
        doReturn(true).when(googleDriveService).existeArquivoComNomeNaPasta(eq(PASTA_ID), anyString());

        int n = service.enviarArquivosMovimentacaoAoDrive(
                processoComInterno(1), CNJ, mov, arquivos, "doc.pdf", PASTA_ID, detalhes);

        assertThat(n).isZero();
        assertThat(detalhes).anyMatch(d -> d.startsWith("já existe no Drive, pulado: "));
        verify(googleDriveService, never()).uploadArquivo(any(), anyString(), anyString(), anyString());
        assertThat(detalhes).anyMatch(d -> d.contains("-> 0 arquivo(s) em Movimentações:"));
    }

    @Test
    void enviar_arquivoNovo_coletorRag_recebeMetadados() throws Exception {
        List<String> detalhes = new ArrayList<>();
        List<RagArquivoDriveEnviado> coletor = new ArrayList<>();
        MovimentacaoProjudi mov = mov("26");
        doReturn(false).when(googleDriveService).existeArquivoComNomeNaPasta(eq(PASTA_ID), anyString());
        when(ocrService.processarPdfSeNecessario(any()))
                .thenReturn(new OcrService.ResultadoOcr(new byte[] {1}, "", false, false, null));
        when(googleDriveService.uploadArquivo(any(), anyString(), anyString(), eq(PASTA_ID)))
                .thenReturn(new DriveArquivoDto("drive-99", "n", null, null, null, null, null, null, null));

        int n = service.enviarArquivosMovimentacaoAoDrive(
                processoComInterno(1), CNJ, mov, List.of(arquivoPdf()), "doc.pdf", PASTA_ID, detalhes, coletor);

        assertThat(n).isEqualTo(1);
        assertThat(coletor).hasSize(1);
        assertThat(coletor.get(0).driveFileId()).isEqualTo("drive-99");
        assertThat(coletor.get(0).fonteId()).isEqualTo("drive:drive-99");
        assertThat(coletor.get(0).tipoPeca()).isEqualTo("despacho");
        assertThat(coletor.get(0).dataMov()).isEqualTo("2026-01-01");
    }

    @Test
    void enviar_arquivoNovo_uploadOk_contaUmEResumoComNome() throws Exception {
        List<String> detalhes = new ArrayList<>();
        MovimentacaoProjudi mov = mov("26");
        doReturn(false).when(googleDriveService).existeArquivoComNomeNaPasta(eq(PASTA_ID), anyString());
        when(ocrService.processarPdfSeNecessario(any()))
                .thenReturn(new OcrService.ResultadoOcr(new byte[] {1}, "", false, false, null));
        when(googleDriveService.uploadArquivo(any(), anyString(), anyString(), eq(PASTA_ID)))
                .thenReturn(new DriveArquivoDto("f1", "n", null, null, null, null, null, null, null));

        int n = service.enviarArquivosMovimentacaoAoDrive(
                processoComInterno(1), CNJ, mov, List.of(arquivoPdf()), "doc.pdf", PASTA_ID, detalhes);

        assertThat(n).isEqualTo(1);
        verify(googleDriveService).uploadArquivo(any(), anyString(), anyString(), eq(PASTA_ID));
        assertThat(detalhes).anyMatch(d -> d.contains("-> 1 arquivo(s) em Movimentações:"));
        assertThat(detalhes).anyMatch(d -> d.contains("0026 Movimentação - Arquivo 01"));
    }

    @Test
    void enviar_uploadNull_detalheErroFalhaEnviar() throws Exception {
        List<String> detalhes = new ArrayList<>();
        doReturn(false).when(googleDriveService).existeArquivoComNomeNaPasta(eq(PASTA_ID), anyString());
        when(ocrService.processarPdfSeNecessario(any()))
                .thenReturn(new OcrService.ResultadoOcr(new byte[] {1}, "", false, false, null));
        when(googleDriveService.uploadArquivo(any(), anyString(), anyString(), eq(PASTA_ID))).thenReturn(null);

        int n = service.enviarArquivosMovimentacaoAoDrive(
                processoComInterno(1), CNJ, mov("26"), List.of(arquivoPdf()), "doc.pdf", PASTA_ID, detalhes);

        assertThat(n).isZero();
        assertThat(detalhes).anyMatch(d -> d.contains("| ERRO Drive: falha ao enviar ")
                && d.contains("(verifique permissões/quota do Google Drive)."));
    }

    @Test
    void enviar_ocrAplicado_detalheOcrEUploadPdfPesquisavel() throws Exception {
        List<String> detalhes = new ArrayList<>();
        byte[] pesquisavel = new byte[] {9, 9, 9};
        doReturn(false).when(googleDriveService).existeArquivoComNomeNaPasta(eq(PASTA_ID), anyString());
        when(ocrService.processarPdfSeNecessario(any()))
                .thenReturn(new OcrService.ResultadoOcr(pesquisavel, "txt", true, false, null));
        when(googleDriveService.uploadArquivo(eq(pesquisavel), anyString(), eq("application/pdf"), eq(PASTA_ID)))
                .thenReturn(new DriveArquivoDto("f1", "n", null, null, null, null, null, null, null));

        int n = service.enviarArquivosMovimentacaoAoDrive(
                processoComInterno(1), CNJ, mov("26"), List.of(arquivoPdf()), "doc.pdf", PASTA_ID, detalhes);

        assertThat(n).isEqualTo(1);
        assertThat(detalhes).anyMatch(d -> d.startsWith("OCR aplicado antes do upload: "));
        verify(googleDriveService).uploadArquivo(eq(pesquisavel), anyString(), eq("application/pdf"), eq(PASTA_ID));
    }

    @Test
    void enviarSobrecarga1_resolverLanca_detalheErroDriveRetornaZero() throws Exception {
        ProcessoEntity processo = processoComInterno(99);
        when(documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo))
                .thenThrow(new RuntimeException("falha pasta"));

        List<String> detalhes = new ArrayList<>();
        int n = service.enviarArquivosMovimentacaoAoDrive(
                processo, CNJ, mov("1"), List.of(arquivoPdf()), "x.pdf", detalhes);

        assertThat(n).isZero();
        assertThat(detalhes).containsExactly(CNJ + " | mov 1 | ERRO Drive: falha pasta");
    }

    @Test
    void resolver_semNumeroInterno_avisoCorrespondente() throws Exception {
        ProcessoEntity processo = new ProcessoEntity();
        processo.setNumeroInterno(null);
        List<String> detalhes = new ArrayList<>();

        assertThat(service.resolverPastaMovimentacoesId(processo, CNJ, detalhes)).isNull();
        assertThat(detalhes).containsExactly(CNJ + " | AVISO Drive: sem numeroInterno.");
    }

    @Test
    void resolver_codigoClienteVazio_avisoCorrespondente() throws Exception {
        ProcessoEntity processo = processoComInterno(1);
        when(documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo)).thenReturn("  ");
        List<String> detalhes = new ArrayList<>();

        assertThat(service.resolverPastaMovimentacoesId(processo, CNJ, detalhes)).isNull();
        assertThat(detalhes).containsExactly(CNJ + " | AVISO Drive: codigoCliente não resolvido.");
    }

    @Test
    void resolver_pastaDtoNull_avisoCorrespondente() throws Exception {
        ProcessoEntity processo = processoComInterno(7);
        when(documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo)).thenReturn("00000001");
        when(documentoDrivePastaService.resolverPastaRaizProcesso(googleDriveService, "00000001", 7))
                .thenReturn(null);
        List<String> detalhes = new ArrayList<>();

        assertThat(service.resolverPastaMovimentacoesId(processo, CNJ, detalhes)).isNull();
        assertThat(detalhes).containsExactly(CNJ + " | AVISO Drive: pasta-folha não resolvida.");
    }

    @Test
    void resolver_ok_retornaPastaMovimentacoes() throws Exception {
        ProcessoEntity processo = processoComInterno(7);
        when(documentoDrivePastaService.resolverCodigoClienteDoProcesso(processo)).thenReturn("00000001");
        when(documentoDrivePastaService.resolverPastaRaizProcesso(googleDriveService, "00000001", 7))
                .thenReturn(new DrivePastaProcessoDto("raiz-id", null, null, null));
        when(googleDriveService.encontrarOuCriarPastaPublic(
                        ProjudiDriveArquivamentoService.PASTA_MOVIMENTACOES, "raiz-id"))
                .thenReturn(PASTA_ID);

        List<String> detalhes = new ArrayList<>();
        assertThat(service.resolverPastaMovimentacoesId(processo, CNJ, detalhes)).isEqualTo(PASTA_ID);
        assertThat(detalhes).isEmpty();
    }

    private static ProcessoEntity processoComInterno(int numeroInterno) {
        ProcessoEntity p = new ProcessoEntity();
        p.setNumeroInterno(numeroInterno);
        return p;
    }

    private static MovimentacaoProjudi mov(String numero) {
        return new MovimentacaoProjudi(
                numero, "Despacho", "Desc", "01/01/2026 10:00:00", "u", "c", "i", "tok", true);
    }

    private static ArquivoTeor arquivoPdf() {
        return new ArquivoTeor("doc.pdf", "application/pdf", "id1", "hash1", new byte[] {1, 2, 3});
    }
}
