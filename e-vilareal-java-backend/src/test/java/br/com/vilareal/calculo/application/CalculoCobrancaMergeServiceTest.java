package br.com.vilareal.calculo.application;

import br.com.vilareal.calculo.infrastructure.persistence.projection.CalculoRodadaResumoProjection;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.ArgumentMatchers.isNull;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CalculoCobrancaMergeServiceTest {

    private static final String COD8 = "00000299";
    private static final int PROC = 12;

    @Mock
    private CalculoRodadaRepository rodadaRepository;

    @Mock
    private CalculoApplicationService calculoApplicationService;

    private CalculoCobrancaMergeService service;
    private final ObjectMapper objectMapper = new ObjectMapper();

    @BeforeEach
    void setUp() {
        service = new CalculoCobrancaMergeService(rodadaRepository, calculoApplicationService, objectMapper);
    }

    @Test
    void mesclarDebitos_dimUnicaNaoAceita_insereSoAusentes() {
        when(rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(COD8, PROC))
                .thenReturn(List.of(resumo(0, false)));
        when(rodadaRepository.findByCodigoClienteAndNumeroProcessoAndDimensao(COD8, PROC, 0))
                .thenReturn(Optional.of(new br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity()));
        when(calculoApplicationService.obterRodada(COD8, PROC, 0))
                .thenReturn(Optional.of(payloadComTitulo("10/01/2026", "R$ 100,00", "Taxa A")));

        DebitoNovo existente = new DebitoNovo("10/01/2026", 10_000L, "Taxa A");
        DebitoNovo novo = new DebitoNovo("15/02/2026", 20_000L, "Taxa B");

        ResultadoMerge r = service.mesclarDebitos(COD8, PROC, List.of(existente, novo), "imp-1");

        assertThat(r.debitosIgnorados()).hasSize(1);
        assertThat(r.debitosIgnorados().getFirst().vencimento()).isEqualTo(existente.vencimento());
        assertThat(r.debitosIgnorados().getFirst().valorCentavos()).isEqualTo(10_000L);
        assertThat(r.debitosIgnorados().getFirst().descricao()).isEqualTo("Taxa A");
        assertThat(r.debitosIgnorados().getFirst().dimensaoExistente()).isZero();
        assertThat(r.debitosIgnorados().getFirst().motivo()).isEqualTo(ResultadoMerge.MOTIVO_DEBITO_JA_EXISTE);
        assertThat(r.dimensoesTocadas()).hasSize(1);
        assertThat(r.dimensoesTocadas().getFirst().dimensao()).isZero();
        assertThat(r.dimensoesTocadas().getFirst().dimensaoCriada()).isFalse();
        assertThat(r.dimensoesTocadas().getFirst().insercoes()).hasSize(1);
        assertThat(r.dimensoesTocadas().getFirst().insercoes().getFirst().dimensao()).isZero();
        assertThat(r.dimensoesTocadas().getFirst().insercoes().getFirst().posicao()).isEqualTo(1);
        assertThat(r.dimensoesTocadas().getFirst().insercoes().getFirst().debito()).isEqualTo(novo);

        ArgumentCaptor<ObjectNode> payloadCap = ArgumentCaptor.forClass(ObjectNode.class);
        verify(calculoApplicationService).salvarRodada(eq(COD8), eq(PROC), eq(0), payloadCap.capture(), eq("imp-1"));
        assertThat(payloadCap.getValue().get("titulos")).hasSize(2);
    }

    @Test
    void mesclarDebitos_dim0Aceita_dim1NaoAceita_cascata() {
        when(rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(COD8, PROC))
                .thenReturn(List.of(resumo(0, true), resumo(1, false)));
        when(calculoApplicationService.obterRodada(COD8, PROC, 0))
                .thenReturn(Optional.of(payloadComTitulo("01/03/2026", "R$ 50,00", "Já na 0")));
        when(calculoApplicationService.obterRodada(COD8, PROC, 1))
                .thenReturn(Optional.of(payloadVazio()));

        DebitoNovo naDim0 = new DebitoNovo("01/03/2026", 5_000L, "Já na 0");
        DebitoNovo novo = new DebitoNovo("02/04/2026", 7_500L, "Vai pra 1");

        ResultadoMerge r = service.mesclarDebitos(COD8, PROC, List.of(naDim0, novo), null);

        assertThat(r.debitosIgnorados()).hasSize(1);
        assertThat(r.debitosIgnorados().getFirst().dimensaoExistente()).isZero();
        assertThat(r.dimensoesTocadas()).hasSize(1);
        assertThat(r.dimensoesTocadas().getFirst().dimensao()).isEqualTo(1);
        assertThat(r.dimensoesTocadas().getFirst().insercoes().getFirst().posicao()).isZero();
        verify(calculoApplicationService, never()).salvarRodada(eq(COD8), eq(PROC), eq(0), any(), any());
        verify(calculoApplicationService).salvarRodada(eq(COD8), eq(PROC), eq(1), any(), isNull());
    }

    @Test
    void mesclarDebitos_todasDimsAceitas_criaNovaDimensao() {
        when(rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(COD8, PROC))
                .thenReturn(List.of(resumo(0, true), resumo(1, true)));
        when(rodadaRepository.findByCodigoClienteAndNumeroProcessoAndDimensao(COD8, PROC, 2))
                .thenReturn(Optional.empty());
        when(calculoApplicationService.obterRodada(COD8, PROC, 0))
                .thenReturn(Optional.of(payloadVazio()));
        when(calculoApplicationService.obterRodada(COD8, PROC, 1))
                .thenReturn(Optional.of(payloadVazio()));

        DebitoNovo d1 = new DebitoNovo("05/05/2026", 1_000L, "Novo 1");
        DebitoNovo d2 = new DebitoNovo("06/06/2026", 2_000L, "Novo 2");

        ResultadoMerge r = service.mesclarDebitos(COD8, PROC, List.of(d1, d2), "imp-2");

        assertThat(r.debitosIgnorados()).isEmpty();
        assertThat(r.dimensoesTocadas()).hasSize(1);
        assertThat(r.dimensoesTocadas().getFirst().dimensao()).isEqualTo(2);
        assertThat(r.dimensoesTocadas().getFirst().dimensaoCriada()).isTrue();
        assertThat(r.dimensoesTocadas().getFirst().insercoes()).hasSize(2);
        verify(calculoApplicationService).salvarRodada(eq(COD8), eq(PROC), eq(2), any(), eq("imp-2"));
    }

    @Test
    void mesclarDebitos_semDimensao_criaDim0ComTodos() {
        when(rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(COD8, PROC))
                .thenReturn(List.of());
        when(rodadaRepository.findByCodigoClienteAndNumeroProcessoAndDimensao(COD8, PROC, 0))
                .thenReturn(Optional.empty());

        DebitoNovo d1 = new DebitoNovo("01/07/2026", 3_000L, "A");
        DebitoNovo d2 = new DebitoNovo("02/08/2026", 4_000L, "B");

        ResultadoMerge r = service.mesclarDebitos(COD8, PROC, List.of(d1, d2), "imp-3");

        assertThat(r.debitosIgnorados()).isEmpty();
        assertThat(r.dimensoesTocadas()).hasSize(1);
        assertThat(r.dimensoesTocadas().getFirst().dimensao()).isZero();
        assertThat(r.dimensoesTocadas().getFirst().dimensaoCriada()).isTrue();
        assertThat(r.dimensoesTocadas().getFirst().insercoes()).hasSize(2);
        assertThat(r.dimensoesTocadas().getFirst().insercoes().get(0).posicao()).isZero();
        assertThat(r.dimensoesTocadas().getFirst().insercoes().get(1).posicao()).isEqualTo(1);

        ArgumentCaptor<ObjectNode> cap = ArgumentCaptor.forClass(ObjectNode.class);
        verify(calculoApplicationService).salvarRodada(eq(COD8), eq(PROC), eq(0), cap.capture(), eq("imp-3"));
        assertThat(cap.getValue().get("titulos")).hasSize(2);
        assertThat(cap.getValue().get("parcelamentoAceito").booleanValue()).isFalse();
    }

    @Test
    void mesclarDebitos_idempotente_naoDuplicaNaSegundaExecucao() {
        when(rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(COD8, PROC))
                .thenReturn(List.of(resumo(0, false)));

        ObjectNode depoisPrimeira = payloadComTitulo("10/09/2026", "R$ 30,00", "Único");
        when(calculoApplicationService.obterRodada(COD8, PROC, 0)).thenReturn(Optional.of(depoisPrimeira));

        DebitoNovo d = new DebitoNovo("10/09/2026", 3_000L, "Único");
        ResultadoMerge r2 = service.mesclarDebitos(COD8, PROC, List.of(d), null);

        assertThat(r2.debitosIgnorados()).hasSize(1);
        assertThat(r2.dimensoesTocadas()).isEmpty();
        verify(calculoApplicationService, never()).salvarRodada(eq(COD8), eq(PROC), eq(0), any(), any());
    }

    private static CalculoRodadaResumoProjection resumo(int dim, boolean aceito) {
        return new CalculoRodadaResumoProjection(COD8, PROC, dim, aceito);
    }

    private ObjectNode payloadVazio() {
        ObjectNode root = objectMapper.createObjectNode();
        root.put("parcelamentoAceito", false);
        root.set("titulos", objectMapper.createArrayNode());
        root.set("parcelas", objectMapper.createArrayNode());
        return root;
    }

    private ObjectNode payloadComTitulo(String vencimento, String valorBrl, String descricao) {
        ObjectNode root = payloadVazio();
        ObjectNode t = objectMapper.createObjectNode();
        t.put("dataVencimento", vencimento);
        t.put("valorInicial", valorBrl);
        t.put("descricaoValor", descricao);
        root.withArray("titulos").add(t);
        return root;
    }
}
