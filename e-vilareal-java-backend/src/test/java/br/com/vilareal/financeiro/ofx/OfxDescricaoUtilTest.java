package br.com.vilareal.financeiro.ofx;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OfxDescricaoUtilTest {

    @Test
    void sicoob_nameComContraparteVaiParaDescricaoPrincipal() {
        OfxDescricaoUtil.Descricoes d = OfxDescricaoUtil.montar(
                "Recebimento Pix MICHELLE APARECI", "PIX RECEBIDO - OUTRA IF", "CREDIT");
        assertThat(d.descricao()).isEqualTo("Recebimento Pix MICHELLE APARECI");
        assertThat(d.descricaoDetalhada()).isEqualTo("CREDIT — PIX RECEBIDO - OUTRA IF");
    }

    @Test
    void itau_memoDetalhadoPermanecePrincipal() {
        OfxDescricaoUtil.Descricoes d = OfxDescricaoUtil.montar(
                "PIX ENVIADO", "PIX QR ESTATICA - RECEBEDOR ***12345678900", "DEBIT");
        assertThat(d.descricao()).isEqualTo("PIX QR ESTATICA - RECEBEDOR ***12345678900");
        assertThat(d.descricaoDetalhada()).isEqualTo("DEBIT — PIX ENVIADO");
    }

    @Test
    void apenasMemoUsaMemo() {
        OfxDescricaoUtil.Descricoes d = OfxDescricaoUtil.montar("", "Boleto pago - Equatorial", "DEBIT");
        assertThat(d.descricao()).isEqualTo("Boleto pago - Equatorial");
    }
}
