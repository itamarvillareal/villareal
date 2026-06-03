package br.com.vilareal.condominio.application;

import br.com.vilareal.condominio.api.dto.CobrancaExtracaoResponse;
import br.com.vilareal.condominio.api.dto.CobrancaProcessarRequest;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.mock.web.MockMultipartFile;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CobrancaAutomaticaApplicationServiceTest {

    @Mock
    private CobrancaRelatorioXlsParser xlsParser;

    @Mock
    private br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository clienteRepository;

    @Mock
    private CobrancaAutomaticaUnidadeTransactionalService unidadeTransactionalService;

    @Mock
    private CobrancaRelatorioMontador relatorioMontador;

    @Mock
    private CobrancaExecucaoPersistenciaService persistenciaService;

    @Mock
    private CobrancaRelatorioPdfService pdfService;

    private CobrancaAutomaticaApplicationService service;

    @BeforeEach
    void setUp() {
        service = new CobrancaAutomaticaApplicationService(
                xlsParser,
                clienteRepository,
                unidadeTransactionalService,
                relatorioMontador,
                persistenciaService,
                pdfService);
    }

    @Test
    void extrair_devolveUnidadesETotais() throws Exception {
        List<CobrancaUnidadeParsed> parsed = List.of(new CobrancaUnidadeParsed(
                "A-0402",
                "Maria",
                "12345678901",
                List.of(new InadimplenciaCobrancaDto("Ordinária", "1", "04/2026", "10/04/2026", "100,00", 10000L, ""))));
        when(xlsParser.parse(any())).thenReturn(parsed);

        MockMultipartFile file = new MockMultipartFile("arquivo", "rel.xls", "application/vnd.ms-excel", new byte[] {1});
        CobrancaExtracaoResponse r = service.extrair(file);

        assertThat(r.unidades()).hasSize(1);
        assertThat(r.totais().unidades()).isEqualTo(1);
        assertThat(r.totais().debitos()).isEqualTo(1);
    }

    @Test
    void processar_persisteRelatorio() {
        ClienteEntity cliente = new ClienteEntity();
        cliente.setId(50L);
        PessoaEntity pessoa = new PessoaEntity();
        pessoa.setId(100L);
        cliente.setPessoa(pessoa);
        when(clienteRepository.findByCodigoClienteFetchPessoa("00000299")).thenReturn(Optional.of(cliente));

        CobrancaUnidadeRequestDto u = new CobrancaUnidadeRequestDto(
                "A-0402", "Maria", "12345678901", List.of());
        UnidadeProcessamentoResult proc = new UnidadeProcessamentoResult(
                u,
                new ResolucaoUnidade(1L, false, null, 10L, 3, true, true, false, null),
                new br.com.vilareal.calculo.application.ResultadoMerge(List.of(), List.of()));

        when(unidadeTransactionalService.processarUnidade(eq(50L), eq(100L), eq("00000299"), eq(u), any()))
                .thenReturn(proc);

        RelatorioExecucaoCobranca relMock = new RelatorioExecucaoCobranca(
                "imp-1",
                null,
                null,
                null,
                List.of(),
                List.of(),
                List.of());
        when(relatorioMontador.montar(any(), any(), any(), any(), any(), any(), any(), any(), any()))
                .thenReturn(relMock);

        RelatorioExecucaoCobranca res =
                service.processar(new CobrancaProcessarRequest("299", List.of(u), "rel.xls"));

        assertThat(res).isSameAs(relMock);
        verify(persistenciaService).salvar(relMock);
    }
}
