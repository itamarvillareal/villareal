package br.com.vilareal.condominio.application;

import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;

class CobrancaRegraInicioCobrancaServiceTest {

    private static final DateTimeFormatter VENC_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final LocalDate DATA_IMPORTACAO = LocalDate.of(2026, 6, 3);

    private final CobrancaRegraInicioCobrancaService service = new CobrancaRegraInicioCobrancaService();

    @Test
    void filtrar_D60_exemploSpec_devedorBDescartado() {
        CobrancaUnidadeRequestDto devedorA = unidade(
                "A-01",
                "Devedor A",
                "11111111111",
                List.of(cob(75), cob(40), cob(10)));
        CobrancaUnidadeRequestDto devedorB = unidade(
                "B-02",
                "Devedor B",
                "22222222222",
                List.of(cob(30)));
        CobrancaUnidadeRequestDto devedorC = unidade(
                "C-03",
                "Devedor C",
                "33333333333",
                List.of(cob(90), cob(65)));

        var filtro = service.filtrarUnidadesAcionadas(
                List.of(devedorA, devedorB, devedorC), DATA_IMPORTACAO, 60);

        assertThat(filtro.acionadas()).containsExactly(devedorA, devedorC);
        assertThat(filtro.devedoresDescartados()).isEqualTo(1);
        assertThat(filtro.titulosDescartados()).isEqualTo(1);

        assertThat(CobrancaRegraInicioCobrancaService.diasDesdeVencimento(cob(30), DATA_IMPORTACAO))
                .isEqualTo(30L);
        assertThat(CobrancaRegraInicioCobrancaService.diasDesdeVencimento(cob(75), DATA_IMPORTACAO))
                .isEqualTo(75L);
    }

    @Test
    void filtrar_D1_nenhumDescartado_noExemploSpec() {
        List<CobrancaUnidadeRequestDto> unidades = List.of(
                unidade("A-01", "Devedor A", "11111111111", List.of(cob(75), cob(40), cob(10))),
                unidade("B-02", "Devedor B", "22222222222", List.of(cob(30))),
                unidade("C-03", "Devedor C", "33333333333", List.of(cob(90), cob(65))));

        var filtro = service.filtrarUnidadesAcionadas(unidades, DATA_IMPORTACAO, 1);

        assertThat(filtro.acionadas()).hasSize(3);
        assertThat(filtro.devedoresDescartados()).isZero();
        assertThat(filtro.titulosDescartados()).isZero();
    }

    @Test
    void unidadeAcionada_vencimentoFuturoOuMalformado_naoConta() {
        LocalDate hoje = LocalDate.of(2026, 6, 3);
        CobrancaUnidadeRequestDto futuro = unidade(
                "X-01",
                "X",
                "12345678901",
                List.of(new InadimplenciaCobrancaDto("Ord", "1", "06/2026", "10/07/2026", "10", 1000L, "")));
        CobrancaUnidadeRequestDto malformado = unidade(
                "X-02",
                "Y",
                "12345678901",
                List.of(new InadimplenciaCobrancaDto("Ord", "1", "06/2026", "invalido", "10", 1000L, "")));

        assertThat(service.unidadeAcionada(futuro, hoje, 1)).isFalse();
        assertThat(service.unidadeAcionada(malformado, hoje, 1)).isFalse();
    }

    private static CobrancaUnidadeRequestDto unidade(
            String cod, String nome, String doc, List<InadimplenciaCobrancaDto> cobrancas) {
        return new CobrancaUnidadeRequestDto(cod, nome, doc, cobrancas);
    }

    private static InadimplenciaCobrancaDto cob(long diasAtraso) {
        String venc = DATA_IMPORTACAO.minusDays(diasAtraso).format(VENC_FMT);
        return new InadimplenciaCobrancaDto("Ordinária", "1", "04/2026", venc, "100,00", 10_000L, "");
    }
}
