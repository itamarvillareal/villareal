package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiMovimentacaoNovidadeClassifierTest {

    private static final String CNJ = "5059346-36.2026.8.09.0007";

    @Mock
    private PublicacaoRepository publicacaoRepository;

    private ProjudiMovimentacaoNovidadeClassifier classifier;

    @BeforeEach
    void setUp() {
        classifier = new ProjudiMovimentacaoNovidadeClassifier(publicacaoRepository);
    }

    @Test
    void listaVazia_retornaZeros() {
        var r = classifier.classificar(CNJ, List.of(), null);
        assertThat(r.novas()).isEmpty();
        assertThat(r.teoresNovos()).isZero();
        assertThat(r.teoresJaExistentes()).isZero();
        verify(publicacaoRepository, never()).existsByHashConteudo(anyString());
    }

    @Test
    void umaMovNova_existsFalse() {
        MovimentacaoProjudi mov = mov("1", "111");
        when(publicacaoRepository.existsByHashConteudo(anyString())).thenReturn(false);

        var r = classifier.classificar(CNJ, List.of(mov), null);

        assertThat(r.novas()).containsExactly(mov);
        assertThat(r.teoresNovos()).isEqualTo(1);
        assertThat(r.teoresJaExistentes()).isZero();
    }

    @Test
    void umaMovConhecida_existsTrue() {
        MovimentacaoProjudi mov = mov("1", "111");
        when(publicacaoRepository.existsByHashConteudo(anyString())).thenReturn(true);

        var r = classifier.classificar(CNJ, List.of(mov), null);

        assertThat(r.novas()).isEmpty();
        assertThat(r.teoresNovos()).isZero();
        assertThat(r.teoresJaExistentes()).isEqualTo(1);
    }

    @Test
    void misturaPreservaOrdemDasNovas() {
        MovimentacaoProjudi a = mov("10", "a");
        MovimentacaoProjudi b = mov("20", "b");
        MovimentacaoProjudi c = mov("30", "c");
        when(publicacaoRepository.existsByHashConteudo(anyString())).thenAnswer(inv -> {
            String h = inv.getArgument(0, String.class);
            return h.equals(ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(CNJ, "b"));
        });

        var r = classifier.classificar(CNJ, List.of(a, b, c), null);

        assertThat(r.novas()).containsExactly(a, c);
        assertThat(r.teoresNovos()).isEqualTo(2);
        assertThat(r.teoresJaExistentes()).isEqualTo(1);
    }

    /**
     * Cap conta movimentações COM DOCUMENTO percorridas (não só novas). Para antes do hash
     * na (max+1)-ésima; além do cap não entra em teoresNovos nem teoresJaExistentes.
     */
    @Test
    void capMax2_tresMovsSoDuasPassamPeloHash() {
        MovimentacaoProjudi m1 = mov("1", "id1");
        MovimentacaoProjudi m2 = mov("2", "id2");
        MovimentacaoProjudi m3 = mov("3", "id3");
        when(publicacaoRepository.existsByHashConteudo(anyString())).thenReturn(false);

        var r = classifier.classificar(CNJ, List.of(m1, m2, m3), 2);

        assertThat(r.novas()).containsExactly(m1, m2);
        assertThat(r.teoresNovos()).isEqualTo(2);
        assertThat(r.teoresJaExistentes()).isZero();
        verify(publicacaoRepository, org.mockito.Mockito.times(2)).existsByHashConteudo(anyString());
    }

    @Test
    void capMax2_segundaConhecidaTerceiraIgnoradaPeloCap() {
        MovimentacaoProjudi m1 = mov("1", "id1");
        MovimentacaoProjudi m2 = mov("2", "id2");
        MovimentacaoProjudi m3 = mov("3", "id3");
        when(publicacaoRepository.existsByHashConteudo(anyString())).thenAnswer(inv -> {
            String h = inv.getArgument(0, String.class);
            return h.equals(ProjudiMovimentacaoHashUtil.hashConteudoMovimentacao(CNJ, "id2"));
        });

        var r = classifier.classificar(CNJ, List.of(m1, m2, m3), 2);

        assertThat(r.novas()).containsExactly(m1);
        assertThat(r.teoresNovos()).isEqualTo(1);
        assertThat(r.teoresJaExistentes()).isEqualTo(1);
        verify(publicacaoRepository, org.mockito.Mockito.times(2)).existsByHashConteudo(anyString());
    }

    private static MovimentacaoProjudi mov(String numero, String idMovi) {
        return new MovimentacaoProjudi(
                numero,
                "Tipo",
                "Desc",
                "01/01/2026 10:00:00",
                "user",
                "cod",
                idMovi,
                "token-arquivo",
                true);
    }
}
