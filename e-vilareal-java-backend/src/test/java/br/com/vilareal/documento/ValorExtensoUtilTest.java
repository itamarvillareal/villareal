package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import java.math.BigDecimal;

import static org.assertj.core.api.Assertions.assertThat;

class ValorExtensoUtilTest {

    private static String reais(String v) {
        return ValorExtensoUtil.reaisPorExtenso(new BigDecimal(v));
    }

    @Test
    void reaisApenasCentavos() {
        assertThat(reais("0.01")).isEqualTo("um centavo");
    }

    @Test
    void reaisUmReal() {
        assertThat(reais("1.00")).isEqualTo("um real");
    }

    @Test
    void reaisDoisReais() {
        assertThat(reais("2.00")).isEqualTo("dois reais");
    }

    @Test
    void reaisCem() {
        assertThat(reais("100.00")).isEqualTo("cem reais");
    }

    @Test
    void reaisCentoEVinteTresComCentavos() {
        assertThat(reais("123.45")).isEqualTo("cento e vinte e três reais e quarenta e cinco centavos");
    }

    @Test
    void reaisMil() {
        assertThat(reais("1000.00")).isEqualTo("um mil reais");
    }

    @Test
    void reaisMilSeiscentosECinquenta() {
        assertThat(reais("1650.00")).isEqualTo("um mil seiscentos e cinquenta reais");
    }

    @Test
    void reaisMilDuzentosTrintaEQuatro() {
        assertThat(reais("1234.56")).isEqualTo("um mil duzentos e trinta e quatro reais e cinquenta e seis centavos");
    }

    @Test
    void reaisUmMilhao() {
        assertThat(reais("1000000.00")).isEqualTo("um milhão de reais");
    }

    @Test
    void cardinais() {
        assertThat(ValorExtensoUtil.numeroPorExtenso(0)).isEqualTo("zero");
        assertThat(ValorExtensoUtil.numeroPorExtenso(1)).isEqualTo("um");
        assertThat(ValorExtensoUtil.numeroPorExtenso(2)).isEqualTo("dois");
        assertThat(ValorExtensoUtil.numeroPorExtenso(15)).isEqualTo("quinze");
        assertThat(ValorExtensoUtil.numeroPorExtenso(30)).isEqualTo("trinta");
        assertThat(ValorExtensoUtil.numeroPorExtenso(100)).isEqualTo("cem");
        assertThat(ValorExtensoUtil.numeroPorExtenso(101)).isEqualTo("cento e um");
    }
}
