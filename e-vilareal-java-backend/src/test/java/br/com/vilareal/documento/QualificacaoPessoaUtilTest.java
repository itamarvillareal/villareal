package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class QualificacaoPessoaUtilTest {

    @Test
    void deveGerarQualificacaoFeminina() {
        String resultado = QualificacaoPessoaUtil.gerarQualificacao(
                "EDINEIDE NONATO CORRÊA",
                "F",
                null,
                "CASADA",
                "professora",
                "65919572",
                "GO",
                "006.520.693-20",
                null,
                "AVENIDA DOM EMANOEL GOMES DE OLIVEIRA",
                "11",
                "Quadra 1, Lote 11",
                "JARDIM ALEXANDRINA",
                "ANÁPOLIS",
                "GO",
                "75060320",
                "nonatocorreaedineide@gmail.com",
                "62-99217-4070",
                true);

        assertThat(resultado).contains("brasileira");
        assertThat(resultado).contains("casada");
        assertThat(resultado).contains("portadora");
        assertThat(resultado).contains("inscrita");
        assertThat(resultado).contains("residente e domiciliada");
        assertThat(resultado).contains("Avenida Dom Emanoel Gomes de Oliveira");
        assertThat(resultado).contains("Jardim Alexandrina");
        assertThat(resultado).contains("cidade de Anápolis");
        assertThat(resultado).contains("estado de Goiás");
        assertThat(resultado).contains("<strong>EDINEIDE NONATO CORRÊA</strong>");
    }

    @Test
    void deveGerarQualificacaoMasculina() {
        String resultado = QualificacaoPessoaUtil.gerarQualificacao(
                "JOÃO DA SILVA SANTOS",
                "M",
                null,
                "SOLTEIRO",
                "empresário",
                "1234567",
                "GO",
                "000.000.000-00",
                null,
                "rua barão do rio branco",
                "100",
                "apto 201",
                "centro",
                "anápolis",
                "GO",
                "75000000",
                "joao@email.com",
                "62-99999-9999",
                true);

        assertThat(resultado).contains("brasileiro");
        assertThat(resultado).contains("solteiro");
        assertThat(resultado).contains("portador");
        assertThat(resultado).contains("inscrito");
        assertThat(resultado).contains("residente e domiciliado");
        assertThat(resultado).contains("Rua Barão do Rio Branco");
    }

    @Test
    void deveNormalizarNomes() {
        assertThat(QualificacaoPessoaUtil.normalizarNome("MARIA DA SILVA SANTOS"))
                .isEqualTo("Maria da Silva Santos");
        assertThat(QualificacaoPessoaUtil.normalizarNome("joao de oliveira"))
                .isEqualTo("Joao de Oliveira");
        assertThat(QualificacaoPessoaUtil.normalizarNome("JOSÉ DOS SANTOS FILHO"))
                .isEqualTo("José dos Santos Filho");
        assertThat(QualificacaoPessoaUtil.normalizarNome("ANA E SILVA"))
                .isEqualTo("Ana e Silva");
        assertThat(QualificacaoPessoaUtil.normalizarNome("EQUATORIAL GOIÁS DISTRIBUIDORA DE ENERGIA S/A"))
                .isEqualTo("Equatorial Goiás Distribuidora de Energia S/A");
        assertThat(QualificacaoPessoaUtil.normalizarNome("SE77E TELECOM EIRELI ME"))
                .isEqualTo("Se77e Telecom Eireli ME");
        assertThat(QualificacaoPessoaUtil.normalizarNome("TIM CELULAR S A"))
                .isEqualTo("Tim Celular S/A");
    }

    @Test
    void deveNormalizarEnderecos() {
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("AV. PINHEIRO CHAGAS"))
                .isEqualTo("Avenida Pinheiro Chagas");
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("R. BARÃO DO RIO BRANCO"))
                .isEqualTo("Rua Barão do Rio Branco");
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("QD. 1, LT. 11"))
                .isEqualTo("Quadra 1, Lote 11");
    }

    @Test
    void deveInferirGeneroFemininoPorNome() {
        assertThat(QualificacaoPessoaUtil.inferirFemininoPorNome("MARIA")).isTrue();
        assertThat(QualificacaoPessoaUtil.inferirFemininoPorNome("EDINEIDE")).isTrue();
        assertThat(QualificacaoPessoaUtil.inferirFemininoPorNome("BEATRIZ")).isTrue();
        assertThat(QualificacaoPessoaUtil.determinarFeminino("João Silva", null)).isFalse();
        assertThat(QualificacaoPessoaUtil.determinarFeminino("Luca Santos", null)).isFalse();
    }

    @Test
    void formatarCpf_onzeDigitos() {
        assertThat(QualificacaoPessoaUtil.formatarCpf("12345678901")).isEqualTo("123.456.789-01");
    }

    @Test
    void formatarCep_oitoDigitos() {
        assertThat(QualificacaoPessoaUtil.formatarCep("75060320")).isEqualTo("75.060-320");
    }

    @Test
    void deveNormalizarAlgarismosRomanosEmMaiusculo() {
        assertThat(QualificacaoPessoaUtil.normalizarNome("papa joão paulo ii"))
                .isEqualTo("Papa João Paulo II");
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("rua xv de novembro"))
                .isEqualTo("Rua XV de Novembro");
        assertThat(QualificacaoPessoaUtil.isAlgarismoRomano("xiii")).isTrue();
        assertThat(QualificacaoPessoaUtil.isAlgarismoRomano("XIII")).isTrue();
    }

    @Test
    void deveFormatarCidadeEstadoPorExtenso() {
        assertThat(QualificacaoPessoaUtil.formatarCidadeEstadoParaQualificacao("valparaiso", "GO"))
                .isEqualTo("cidade de Valparaiso, estado de Goiás");
        assertThat(QualificacaoPessoaUtil.formatarCidadeEstadoParaQualificacao("Valparaíso", "go"))
                .isEqualTo("cidade de Valparaíso, estado de Goiás");
    }

    @Test
    void deveFormatarDistritoFederalSemPalavraEstado() {
        assertThat(QualificacaoPessoaUtil.formatarCidadeEstadoParaQualificacao("Brasília", "DF"))
                .isEqualTo("cidade de Brasília, Distrito Federal");
    }
}
