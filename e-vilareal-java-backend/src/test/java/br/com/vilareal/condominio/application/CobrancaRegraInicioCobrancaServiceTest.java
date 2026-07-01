package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.RegraInicioCobrancaDiasValidator;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CobrancaRegraInicioCobrancaServiceTest {

    private static final DateTimeFormatter VENC_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final LocalDate DATA_IMPORTACAO = LocalDate.of(2026, 6, 3);
    private static final long CLIENTE_ID = 50L;
    private static final String COD8 = "00000299";

    @Mock
    private CobrancaDebitosCadastradosConsultaService debitosCadastradosConsulta;

    private CobrancaRegraInicioCobrancaService service;

    @BeforeEach
    void setUp() {
        service = new CobrancaRegraInicioCobrancaService(debitosCadastradosConsulta);
    }

    @Test
    void filtrar_importarTudo_nenhumDescartado() {
        List<CobrancaUnidadeRequestDto> unidades = List.of(
                unidade("A-01", List.of(cob(75), cob(40), cob(10))),
                unidade("B-02", List.of(cob(30))),
                unidade("C-03", List.of(cob(90), cob(65))));

        var filtro = service.filtrarUnidadesAcionadas(
                unidades, DATA_IMPORTACAO, RegraInicioCobrancaDiasValidator.REGRA_IMPORTAR_TUDO, CLIENTE_ID, COD8);

        assertThat(filtro.acionadas()).hasSize(3);
        assertThat(filtro.devedoresDescartados()).isZero();
        assertThat(filtro.titulosDescartados()).isZero();
    }

    @Test
    void filtrar_condicional61_semDebitoAnterior_soAcionaAcimaDe60() {
        when(debitosCadastradosConsulta.unidadeTemDebitoAbertoAcimaDe60Dias(anyLong(), any(), any(), any()))
                .thenReturn(false);

        CobrancaUnidadeRequestDto com61 = unidade("A-01", List.of(cob(4), cob(10), cob(61)));
        CobrancaUnidadeRequestDto so4 = unidade("B-02", List.of(cob(4)));
        CobrancaUnidadeRequestDto so30 = unidade("C-03", List.of(cob(30)));

        var filtro = service.filtrarUnidadesAcionadas(
                List.of(com61, so4, so30),
                DATA_IMPORTACAO,
                RegraInicioCobrancaDiasValidator.REGRA_CONDICIONAL_60_MAIS_1,
                CLIENTE_ID,
                COD8);

        assertThat(filtro.acionadas()).containsExactly(com61);
        assertThat(filtro.devedoresDescartados()).isEqualTo(2);
        assertThat(filtro.titulosDescartados()).isEqualTo(2);
    }

    @Test
    void filtrar_condicional61_comDebitoAnterior_importaMesmoCom4Dias() {
        CobrancaUnidadeRequestDto com4e10 = unidade("A-01", List.of(cob(4), cob(10)));
        when(debitosCadastradosConsulta.unidadeTemDebitoAbertoAcimaDe60Dias(
                        eq(CLIENTE_ID), eq(COD8), eq("A-01"), eq(DATA_IMPORTACAO)))
                .thenReturn(true);
        when(debitosCadastradosConsulta.unidadeTemDebitoAbertoAcimaDe60Dias(
                        eq(CLIENTE_ID), eq(COD8), eq("B-02"), eq(DATA_IMPORTACAO)))
                .thenReturn(false);

        CobrancaUnidadeRequestDto so4 = unidade("B-02", List.of(cob(4)));

        var filtro = service.filtrarUnidadesAcionadas(
                List.of(com4e10, so4),
                DATA_IMPORTACAO,
                RegraInicioCobrancaDiasValidator.REGRA_CONDICIONAL_60_MAIS_1,
                CLIENTE_ID,
                COD8);

        assertThat(filtro.acionadas()).containsExactly(com4e10);
        assertThat(filtro.devedoresDescartados()).isEqualTo(1);
    }

    @Test
    void unidadeAcionada_vencimentoFuturoOuMalformado_naoConta() {
        LocalDate hoje = LocalDate.of(2026, 6, 3);
        CobrancaUnidadeRequestDto futuro = unidade(
                "X-01",
                List.of(new InadimplenciaCobrancaDto("Ord", "1", "06/2026", "10/07/2026", "10", 1000L, "")));
        CobrancaUnidadeRequestDto malformado = unidade(
                "X-02",
                List.of(new InadimplenciaCobrancaDto("Ord", "1", "06/2026", "invalido", "10", 1000L, "")));

        assertThat(service.unidadeAcionada(futuro, hoje, 1)).isFalse();
        assertThat(service.unidadeAcionada(malformado, hoje, 1)).isFalse();
    }

    private static CobrancaUnidadeRequestDto unidade(String cod, List<InadimplenciaCobrancaDto> cobrancas) {
        return new CobrancaUnidadeRequestDto(cod, "Devedor", "11111111111", cobrancas);
    }

    private static InadimplenciaCobrancaDto cob(long diasAtraso) {
        String venc = DATA_IMPORTACAO.minusDays(diasAtraso).format(VENC_FMT);
        return new InadimplenciaCobrancaDto("Ordinária", "1", "04/2026", venc, "100,00", 10_000L, "");
    }
}
