package br.com.vilareal.importacao;

import br.com.vilareal.importacao.dto.ImportacaoInativarProcessosResponse;
import br.com.vilareal.importacao.dto.InativacaoProcessoLinhaStatus;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.xssf.usermodel.XSSFWorkbook;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.io.ByteArrayInputStream;
import java.io.ByteArrayOutputStream;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProcessosInativarPlanilhaServiceTest {

    @Mock
    private ProcessosInativarPlanilhaRowApplier rowApplier;

    @InjectMocks
    private ProcessosInativarPlanilhaService service;

    @Test
    void linhaInativada_comPrimeiraLinhaDados1_pulaCabecalho() throws Exception {
        when(rowApplier.aplicar(eq("00000024"), eq(3)))
                .thenReturn(ProcessosInativarPlanilhaRowApplier.Resultado.ok(501L));

        byte[] xlsx = criarPlanilha(true);
        ImportacaoInativarProcessosResponse r =
                service.importarDeInputStream(new ByteArrayInputStream(xlsx), "t.xlsx", 1);

        assertThat(r.getInativados()).isEqualTo(1);
        assertThat(r.getNaoEncontrados()).isZero();
        assertThat(r.getLinhasComErro()).isZero();
        assertThat(r.getDetalhes()).hasSize(1);
        assertThat(r.getDetalhes().getFirst().getStatus()).isEqualTo(InativacaoProcessoLinhaStatus.INATIVADO);
        assertThat(r.getDetalhes().getFirst().getProcessoId()).isEqualTo(501L);
        verify(rowApplier).aplicar("00000024", 3);
    }

    @Test
    void linhaNaoEncontrada() throws Exception {
        when(rowApplier.aplicar(eq("00000001"), eq(1)))
                .thenReturn(ProcessosInativarPlanilhaRowApplier.Resultado.naoEncontrado());

        byte[] xlsx = criarPlanilhaUmaLinhaDados("00000001", 1, 0);
        ImportacaoInativarProcessosResponse r =
                service.importarDeInputStream(new ByteArrayInputStream(xlsx), "t.xlsx", 0);

        assertThat(r.getInativados()).isZero();
        assertThat(r.getNaoEncontrados()).isEqualTo(1);
        assertThat(r.getDetalhes().getFirst().getStatus()).isEqualTo(InativacaoProcessoLinhaStatus.NAO_ENCONTRADO);
    }

    @Test
    void colunaBVazia_contaErro() throws Exception {
        byte[] xlsx = criarPlanilhaSemColunaB();
        ImportacaoInativarProcessosResponse r =
                service.importarDeInputStream(new ByteArrayInputStream(xlsx), "t.xlsx", 1);

        assertThat(r.getLinhasComErro()).isEqualTo(1);
        assertThat(r.getDetalhes().getFirst().getStatus()).isEqualTo(InativacaoProcessoLinhaStatus.ERRO);
    }

    private static byte[] criarPlanilha(boolean comCabecalho) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            int rowIdx = 0;
            if (comCabecalho) {
                Row h = sh.createRow(rowIdx++);
                h.createCell(0).setCellValue("Codigo");
                h.createCell(1).setCellValue("Proc");
            }
            Row d = sh.createRow(rowIdx);
            d.createCell(0).setCellValue("00000024");
            d.createCell(1).setCellValue(3);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            return bos.toByteArray();
        }
    }

    private static byte[] criarPlanilhaUmaLinhaDados(String cod, int proc, int primeiraLinhaOffset) throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row d = sh.createRow(primeiraLinhaOffset);
            d.createCell(0).setCellValue(cod);
            d.createCell(1).setCellValue(proc);
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            return bos.toByteArray();
        }
    }

    private static byte[] criarPlanilhaSemColunaB() throws Exception {
        try (XSSFWorkbook wb = new XSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row h = sh.createRow(0);
            h.createCell(0).setCellValue("Codigo");
            h.createCell(1).setCellValue("Proc");
            Row d = sh.createRow(1);
            d.createCell(0).setCellValue("00000001");
            ByteArrayOutputStream bos = new ByteArrayOutputStream();
            wb.write(bos);
            return bos.toByteArray();
        }
    }
}
