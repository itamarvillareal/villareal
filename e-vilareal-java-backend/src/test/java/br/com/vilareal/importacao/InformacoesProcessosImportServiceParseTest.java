package br.com.vilareal.importacao;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import org.apache.poi.hssf.usermodel.HSSFWorkbook;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.lang.reflect.Method;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class InformacoesProcessosImportServiceParseTest {

    @Mock
    PessoaRepository pessoaRepository;

    @Mock
    InformacoesProcessosImportRowApplier rowApplier;

    @Mock
    ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;

    InformacoesProcessosImportService service;

    @BeforeEach
    void setUp() {
        service = new InformacoesProcessosImportService(pessoaRepository, rowApplier, clienteCodigoPessoaResolver);
    }

    private DadosImportacaoLinha parseLinha(Row row, int linhaExcel) throws Exception {
        Method m = InformacoesProcessosImportService.class.getDeclaredMethod("parseLinha", Row.class, int.class);
        m.setAccessible(true);
        return (DadosImportacaoLinha) m.invoke(service, row, linhaExcel);
    }

    @Test
    void parseBasicoComFaseEPartes() throws Exception {
        when(clienteCodigoPessoaResolver.resolverPessoaId("00000001")).thenReturn(1L);
        when(pessoaRepository.existsById(1L)).thenReturn(true);
        when(pessoaRepository.existsById(99L)).thenReturn(true);

        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue("00000001");
            r.createCell(1).setCellValue("99");
            r.createCell(11).setCellValue(5);
            r.createCell(12).setCellValue("Ag. Documentos");
            r.createCell(13).setCellValue("CNJ-123");
            r.createCell(14).setCellValue("Descrição O");

            DadosImportacaoLinha d = parseLinha(r, 2);
            assertThat(d.clientePessoaId()).isEqualTo(1L);
            assertThat(d.numeroInterno()).isEqualTo(5);
            assertThat(d.faseOpcional()).contains("Ag. Documentos");
            assertThat(d.numeroCnjOuNull()).isEqualTo("CNJ-123");
            assertThat(d.descricaoAcaoOuNull()).isEqualTo("Descrição O");
            assertThat(d.partes()).hasSize(1);
            assertThat(d.partes().get(0).polo()).isEqualTo("AUTOR");
            assertThat(d.partes().get(0).ordem()).isEqualTo(1);
            assertThat(d.partes().get(0).pessoaId()).isEqualTo(99L);
            assertThat(d.controleAtivoOpcional()).isEmpty();
            assertThat(d.usarFaseEmAndamentoQuandoFaseVazia()).isFalse();
            assertThat(d.atualizarComplementarDescricaoAcao()).isTrue();
        }
    }

    @Test
    void parseCnjComPontosColunaN() throws Exception {
        when(clienteCodigoPessoaResolver.resolverPessoaId("00000149")).thenReturn(149L);
        when(pessoaRepository.existsById(149L)).thenReturn(true);
        when(pessoaRepository.existsById(686L)).thenReturn(true);
        when(pessoaRepository.existsById(1531L)).thenReturn(true);

        String cnj = "5169363.33.2012.8.09.0007";
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue("00000149");
            r.createCell(1).setCellValue(686);
            r.createCell(6).setCellValue(1531);
            r.createCell(11).setCellValue(1);
            r.createCell(12).setCellValue("Em Andamento");
            r.createCell(13).setCellValue(cnj);

            DadosImportacaoLinha d = parseLinha(r, 2);
            assertThat(d.clientePessoaId()).isEqualTo(149L);
            assertThat(d.numeroInterno()).isEqualTo(1);
            assertThat(d.numeroCnjOuNull()).isEqualTo(cnj);
            assertThat(d.partes()).hasSize(2);
            assertThat(d.controleAtivoOpcional()).isEmpty();
            assertThat(d.atualizarComplementarDescricaoAcao()).isTrue();
        }
    }

    @Test
    void clienteInexistente() throws Exception {
        when(clienteCodigoPessoaResolver.resolverPessoaId("00000002")).thenReturn(2L);
        when(pessoaRepository.existsById(2L)).thenReturn(false);

        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue("00000002");
            r.createCell(11).setCellValue(1);

            assertThatThrownBy(() -> parseLinha(r, 2))
                    .isInstanceOf(java.lang.reflect.InvocationTargetException.class)
                    .cause()
                    .isInstanceOf(IllegalArgumentException.class)
                    .hasMessageContaining("Cliente");
        }
    }

    @Test
    void faseInvalida() throws Exception {
        when(clienteCodigoPessoaResolver.resolverPessoaId("00000001")).thenReturn(1L);
        when(pessoaRepository.existsById(1L)).thenReturn(true);

        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue("00000001");
            r.createCell(11).setCellValue(1);
            r.createCell(12).setCellValue("Fase XYZ desconhecida");

            assertThatThrownBy(() -> parseLinha(r, 2))
                    .isInstanceOf(java.lang.reflect.InvocationTargetException.class)
                    .cause()
                    .isInstanceOf(IllegalArgumentException.class);
        }
    }

    @Test
    void codigoClienteInvalidoReflectionEnvolveBusinessRule() throws Exception {
        when(clienteCodigoPessoaResolver.resolverPessoaId("abc"))
                .thenThrow(new BusinessRuleException("codigoCliente inválido"));
        try (HSSFWorkbook wb = new HSSFWorkbook()) {
            Sheet sh = wb.createSheet();
            Row r = sh.createRow(0);
            r.createCell(0).setCellValue("abc");
            r.createCell(11).setCellValue(1);

            assertThatThrownBy(() -> parseLinha(r, 2))
                    .isInstanceOf(java.lang.reflect.InvocationTargetException.class)
                    .cause()
                    .isInstanceOf(BusinessRuleException.class);
        }
    }
}
