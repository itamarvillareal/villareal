package br.com.vilareal.financeiro.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class DescricaoNormalizerTest {

    @Test
    void normalizar_removeDataColadaNoFim() {
        assertThat(DescricaoNormalizer.normalizar("PIX TRANSF BANCO I09/06"))
                .isEqualTo("PIX TRANSF BANCO I");
        assertThat(DescricaoNormalizer.normalizar("PIX TRANSF BANCO I10/06"))
                .isEqualTo("PIX TRANSF BANCO I");
    }

    @Test
    void normalizar_removeDataCompleta() {
        assertThat(DescricaoNormalizer.normalizar("PIX TRANSF JOAO 09/06/2026"))
                .isEqualTo("PIX TRANSF JOAO");
    }

    @Test
    void normalizar_colapsaEspacosECaixa() {
        assertThat(DescricaoNormalizer.normalizar("Boleto pago - Consigaz - Sp "))
                .isEqualTo("BOLETO PAGO - CONSIGAZ - SP");
    }

    @Test
    void normalizar_preservaMeioInalterado() {
        assertThat(DescricaoNormalizer.normalizar("SANEAMENTO DE GOIAS SA"))
                .isEqualTo("SANEAMENTO DE GOIAS SA");
        assertThat(DescricaoNormalizer.normalizar("CDB 30 DIAS"))
                .isEqualTo("CDB 30 DIAS");
    }

    @Test
    void normalizar_removeDataSeparadaPorEspacoNoFim() {
        assertThat(DescricaoNormalizer.normalizar("PIX TRANSF BANCO I28 05"))
                .isEqualTo("PIX TRANSF BANCO I");
        assertThat(DescricaoNormalizer.normalizar("PIX TRANSF BANCO I31 05"))
                .isEqualTo("PIX TRANSF BANCO I");
    }

    @Test
    void normalizar_removeParcelaCartao() {
        assertThat(DescricaoNormalizer.normalizar("Supermercado Jardins (2/2)"))
                .isEqualTo("SUPERMERCADO JARDINS");
        assertThat(DescricaoNormalizer.normalizar("Cartorio (2/3)"))
                .isEqualTo("CARTORIO");
    }

    @Test
    void normalizar_vazio() {
        assertThat(DescricaoNormalizer.normalizar(null)).isEmpty();
        assertThat(DescricaoNormalizer.normalizar("")).isEmpty();
        assertThat(DescricaoNormalizer.normalizar("   ")).isEmpty();
    }
}
