package br.com.vilareal.orgaojulgador.domain;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class OrgaoJulgadorTipoUtilTest {

    @Test
    void classificar_juizadoPorNomeOuGrau() {
        assertThat(OrgaoJulgadorTipoUtil.classificar("9º Juizado Especial Cível", "G1"))
                .isEqualTo(OrgaoJulgadorTipo.JUIZADO);
        assertThat(OrgaoJulgadorTipoUtil.classificar("Vara Cível", "JE")).isEqualTo(OrgaoJulgadorTipo.JUIZADO);
    }

    @Test
    void classificar_camaraGabineteOuTurma() {
        assertThat(OrgaoJulgadorTipoUtil.classificar("Gabinete do Desembargador", "G2"))
                .isEqualTo(OrgaoJulgadorTipo.CAMARA);
        assertThat(OrgaoJulgadorTipoUtil.classificar("1ª Turma Recursal", "TR"))
                .isEqualTo(OrgaoJulgadorTipo.TURMA);
    }

    @Test
    void classificar_varaESecao() {
        assertThat(OrgaoJulgadorTipoUtil.classificar("1ª Vara Cível de Anápolis", "G1"))
                .isEqualTo(OrgaoJulgadorTipo.VARA);
        assertThat(OrgaoJulgadorTipoUtil.classificar("Seção Cível", "G1")).isEqualTo(OrgaoJulgadorTipo.SECAO);
    }

    @Test
    void classificar_outroQuandoSemPadrao() {
        assertThat(OrgaoJulgadorTipoUtil.classificar("Presidência", "G2")).isEqualTo(OrgaoJulgadorTipo.OUTRO);
    }
}
