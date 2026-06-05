package br.com.vilareal.projudi;

import br.com.vilareal.projudi.ProjudiDriveProgressivoUtil.SelecaoProgressiva;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import org.junit.jupiter.api.Test;

import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

/**
 * Caracterização da seleção progressiva — comportamento observado de {@link ProjudiDriveProgressivoUtil}
 * (sem impor regra de negócio nova).
 */
class ProjudiDriveProgressivoUtilTest {

    @Test
    void arquivadasVazio_baixarPrimeirasDoComDocDescAtePassoBackfill() {
        List<MovimentacaoProjudi> comDoc = List.of(mov("30"), mov("26"), mov("22"));

        SelecaoProgressiva sel = ProjudiDriveProgressivoUtil.selecionarMovimentacoes(comDoc, Set.of(), 2);

        assertThat(sel.novasTopo()).isEmpty();
        assertThat(sel.backfill()).containsExactly(mov("30"), mov("26"));
        assertThat(sel.baixar()).containsExactly(mov("30"), mov("26"));
        assertThat(sel.totalArquivadasDrive()).isZero();
        assertThat(sel.minArquivado()).isNull();
        assertThat(sel.maxArquivado()).isNull();
    }

    @Test
    void topoJaArquivado_novasTopoAcimaDoMaxArquivadoMaisBackfillAbaixo() {
        List<MovimentacaoProjudi> comDoc = List.of(mov("30"), mov("26"), mov("22"), mov("10"));
        Set<Integer> arquivadas = Set.of(26);

        SelecaoProgressiva sel = ProjudiDriveProgressivoUtil.selecionarMovimentacoes(comDoc, arquivadas, 10);

        assertThat(sel.novasTopo()).containsExactly(mov("30"));
        assertThat(sel.backfill()).containsExactly(mov("22"), mov("10"));
        assertThat(sel.baixar()).containsExactly(mov("30"), mov("22"), mov("10"));
        assertThat(sel.totalArquivadasDrive()).isEqualTo(1);
        assertThat(sel.minArquivado()).isEqualTo(26);
        assertThat(sel.maxArquivado()).isEqualTo(26);
    }

    @Test
    void backfillRespeitaPassoBackfill() {
        List<MovimentacaoProjudi> comDoc = List.of(mov("30"), mov("26"), mov("22"));
        Set<Integer> arquivadas = Set.of(30);

        SelecaoProgressiva sel = ProjudiDriveProgressivoUtil.selecionarMovimentacoes(comDoc, arquivadas, 1);

        assertThat(sel.novasTopo()).isEmpty();
        assertThat(sel.backfill()).containsExactly(mov("26"));
        assertThat(sel.baixar()).containsExactly(mov("26"));
    }

    @Test
    void extrairNumerosArquivados_prefixoMovimentacaoEIgnoraSemPadrao() {
        List<String> nomes = List.of(
                "0026 Movimentação - Arquivo 01 - Despacho.pdf",
                "0034 Movimentação - Arquivo 02 - Intimação.pdf",
                "arquivo_sem_prefixo.pdf",
                "",
                "  0005 Movimentação - Arquivo 01 - Petição.pdf  ");

        Set<Integer> nums = ProjudiDriveProgressivoUtil.extrairNumerosArquivados(nomes);

        assertThat(nums).containsExactly(26, 34, 5);
    }

    @Test
    void extrairNumerosArquivados_listaVaziaOuNula() {
        assertThat(ProjudiDriveProgressivoUtil.extrairNumerosArquivados(List.of())).isEmpty();
        assertThat(ProjudiDriveProgressivoUtil.extrairNumerosArquivados(null)).isEmpty();
    }

    @Test
    void selecaoProgressiva_resumo_congelado() {
        List<MovimentacaoProjudi> comDoc = List.of(mov("30"), mov("22"));
        SelecaoProgressiva sel =
                ProjudiDriveProgressivoUtil.selecionarMovimentacoes(comDoc, Set.of(26), 1);

        assertThat(sel.resumo())
                .isEqualTo("arquivadasDrive=1 min=26 max=26 novasTopo=1 backfill=1 baixar=[30, 22]");
    }

    @Test
    void contarJaArquivadasEmComDoc_contaNumerosDistintosPresentesNoSet() {
        List<MovimentacaoProjudi> comDoc = List.of(mov("30"), mov("26"), mov("22"));
        assertThat(ProjudiDriveProgressivoUtil.contarJaArquivadasEmComDoc(comDoc, Set.of(26, 99)))
                .isEqualTo(1);
        assertThat(ProjudiDriveProgressivoUtil.contarJaArquivadasEmComDoc(comDoc, Set.of())).isZero();
    }

    @Test
    void filtrarComDocDesc_ordemDescPorNumeroMov() {
        List<MovimentacaoProjudi> raw = List.of(
                movSemDoc("5"),
                mov("10"),
                mov("30"),
                mov("20"));
        List<MovimentacaoProjudi> filtrado = ProjudiDriveProgressivoUtil.filtrarComDocDesc(raw);
        assertThat(filtrado).extracting(MovimentacaoProjudi::numero).containsExactly("30", "20", "10");
    }

    private static MovimentacaoProjudi mov(String numero) {
        return new MovimentacaoProjudi(
                numero,
                "Tipo",
                "Desc",
                "01/01/2026 10:00:00",
                "user",
                "cod" + numero,
                "idMovi" + numero,
                "token-" + numero,
                true);
    }

    private static MovimentacaoProjudi movSemDoc(String numero) {
        return new MovimentacaoProjudi(
                numero, "T", "D", "01/01/2026 10:00:00", "u", "c", "i", null, false);
    }
}
