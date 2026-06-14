package br.com.vilareal.importacao;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;

class ImoveisPlanilhaImportSupportTest {

    @Test
    void parseValorRealBr_virgulaDecimal() {
        assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr("1.234,56"))
                .isEqualByComparingTo(new BigDecimal("1234.56"));
        assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr("R$ 99,00"))
                .isEqualByComparingTo(new BigDecimal("99.00"));
    }

    @Test
    void parseValorRealBr_rejeitaStringDeData() {
        // Defesa contra o bug do imóvel 43: nunca extrair "26" de uma data formatada.
        assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr("26/08/1904")).isNull();
        assertThat(ImoveisPlanilhaImportSupport.parseValorRealBr("01/01/2024")).isNull();
    }

    @Test
    void normalizarSimNao() {
        assertThat(ImoveisPlanilhaImportSupport.normalizarSimNao("Sim")).isEqualTo("sim");
        assertThat(ImoveisPlanilhaImportSupport.normalizarSimNao("NÃO")).isEqualTo("nao");
        assertThat(ImoveisPlanilhaImportSupport.normalizarSimNao("")).isEmpty();
    }

    @Test
    void parseDataFlex_br() {
        assertThat(ImoveisPlanilhaImportSupport.parseDataFlex("08/04/2026")).isEqualTo(LocalDate.of(2026, 4, 8));
    }

    @Test
    void resolverNumeroPlanilha_colACompostaOuPoiTruncado() {
        assertThat(ImoveisPlanilhaImportSupport.resolverNumeroPlanilha("938//37", "37")).isEqualTo(37);
        assertThat(ImoveisPlanilhaImportSupport.resolverNumeroPlanilha("938", "37")).isEqualTo(37);
        assertThat(ImoveisPlanilhaImportSupport.resolverNumeroPlanilha("911//4", "65")).isEqualTo(65);
        assertThat(ImoveisPlanilhaImportSupport.resolverNumeroPlanilha("938//55", "66")).isEqualTo(66);
        assertThat(ImoveisPlanilhaImportSupport.resolverNumeroPlanilha("37", "938")).isEqualTo(37);
        assertThat(ImoveisPlanilhaImportSupport.resolverNumeroPlanilha("//", "48")).isEqualTo(48);
    }

    @Test
    void ehErroXlsLegadoPoi_detectaLinkTable() {
        Path p = Path.of("Administração Imóveis.xls");
        assertThat(ImoveisPlanilhaImportService.ehErroXlsLegadoPoi(
                        p, new RuntimeException("Extern sheet is part of LinkTable")))
                .isTrue();
        assertThat(ImoveisPlanilhaImportService.ehErroXlsLegadoPoi(
                        p, new RuntimeException("outro erro")))
                .isFalse();
        assertThat(ImoveisPlanilhaImportService.ehErroXlsLegadoPoi(
                        Path.of("imoveis.xlsx"), new RuntimeException("Extern sheet is part of LinkTable")))
                .isFalse();
    }
}
