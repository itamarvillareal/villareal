package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.ResultadoMerge;
import br.com.vilareal.condominio.api.dto.RelatorioCabecalhoDto;
import br.com.vilareal.condominio.api.dto.RelatorioDebitoIgnoradoDto;
import br.com.vilareal.condominio.api.dto.RelatorioDebitoInseridoDto;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.condominio.api.dto.RelatorioItemUnidadeDto;
import br.com.vilareal.condominio.api.dto.RelatorioTotaisDocumentoDto;
import br.com.vilareal.condominio.api.dto.RelatorioTotaisExecucaoDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.thymeleaf.spring6.SpringTemplateEngine;
import org.thymeleaf.templatemode.TemplateMode;
import org.thymeleaf.templateresolver.ClassLoaderTemplateResolver;

import java.time.Instant;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CobrancaRelatorioPdfServiceTest {

    private CobrancaRelatorioPdfService pdfService;

    @BeforeEach
    void setUp() {
        ClassLoaderTemplateResolver resolver = new ClassLoaderTemplateResolver();
        resolver.setPrefix("templates/");
        resolver.setSuffix(".html");
        resolver.setTemplateMode(TemplateMode.HTML);
        resolver.setCharacterEncoding("UTF-8");
        SpringTemplateEngine engine = new SpringTemplateEngine();
        engine.setTemplateResolver(resolver);
        pdfService = new CobrancaRelatorioPdfService(engine);
    }

    @Test
    void gerarPdf_retornaBytesNaoVazios() {
        RelatorioExecucaoCobranca rel = new RelatorioExecucaoCobranca(
                "imp-pdf-test",
                new RelatorioCabecalhoDto(
                        "imp-pdf-test",
                        Instant.now().toString(),
                        "00000299",
                        "Cliente PDF",
                        "rel.xls",
                        "tester"),
                new RelatorioTotaisDocumentoDto(1, 2),
                new RelatorioTotaisExecucaoDto(1, 0, 1, 1, 0, 0, 1, 0, 0),
                List.of(new RelatorioItemUnidadeDto(
                        "A-0402",
                        "Maria",
                        "12345678901",
                        false,
                        10L,
                        3,
                        false,
                        2,
                        1,
                        1,
                        0,
                        false,
                        null,
                        List.of(new RelatorioDebitoInseridoDto("10/04/2026", "658,77", 0, 0)),
                        List.of(new RelatorioDebitoIgnoradoDto(
                                "11/05/2026", "200,00", 0, ResultadoMerge.MOTIVO_DEBITO_JA_EXISTE)))),
                List.of(),
                List.of());

        byte[] pdf = pdfService.gerarPdf(rel);
        assertThat(pdf).isNotEmpty();
        assertThat(pdf.length).isGreaterThan(500);
        assertThat(new String(pdf, 0, Math.min(5, pdf.length))).startsWith("%PDF");
    }
}
