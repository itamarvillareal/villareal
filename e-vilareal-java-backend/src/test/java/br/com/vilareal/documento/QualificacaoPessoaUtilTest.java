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
    void flexionaNacionalidadeBrasileiraAoGenero() {
        assertThat(QualificacaoPessoaUtil.flexionarNacionalidade("Brasileira", false))
                .isEqualTo("brasileiro");
        assertThat(QualificacaoPessoaUtil.flexionarNacionalidade("brasileiro", true))
                .isEqualTo("brasileira");
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
    void deveExpandirAbreviacoesApenasComoTokenInteiro() {
        // Palavras já por extenso NÃO devem ser tocadas (bug: "APARTAMENTO"→"Apartamento Artamento").
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("APARTAMENTO 502 BLOCO B"))
                .isEqualTo("Apartamento 502 Bloco B");
        // Abreviações reais continuam expandindo.
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("AP 502 BL B"))
                .isEqualTo("Apartamento 502 Bloco B");
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("QD 06 LT 01"))
                .isEqualTo("Quadra 06 Lote 01");
        // Já por extenso permanece sem duplicar.
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("QUADRA 06 LOTE 01"))
                .isEqualTo("Quadra 06 Lote 01");
        // Abreviação como prefixo de outra palavra não deve expandir.
        assertThat(QualificacaoPessoaUtil.normalizarEndereco("RUA APARECIDA 10"))
                .isEqualTo("Rua Aparecida 10");
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

    @Test
    void deveGerarQualificacaoProcuracaoNoFormatoLegado() {
        String resultado = QualificacaoPessoaUtil.gerarQualificacaoProcuracao(
                "CARLOS HENRIQUE DE OLIVEIRA SAMPAIO",
                "M",
                null,
                null,
                "motorista",
                null,
                "GO",
                "017.908.731-26",
                null,
                "Rua Geni Ribeiro",
                "710",
                "Qd 35 Lt 04",
                "Maracanã",
                "Anápolis",
                "GO",
                "75040060",
                null);

        assertThat(resultado).startsWith("<strong>CARLOS HENRIQUE DE OLIVEIRA SAMPAIO</strong>, brasileiro, motorista");
        assertThat(resultado).doesNotContain("estado civil desconhecido");
        assertThat(resultado).contains("<strong>CARLOS HENRIQUE DE OLIVEIRA SAMPAIO</strong>");
        assertThat(resultado).contains("Rua Geni Ribeiro nº 710 Qd 35 Lt 04");
        assertThat(resultado).contains("Bairro Maracanã");
        assertThat(resultado).contains("CEP n° 75040060");
        assertThat(resultado).contains("não utiliza endereço eletrônico");
        assertThat(resultado).doesNotContain("Quadra");
        assertThat(resultado).doesNotContain("75.040-060");
    }

    @Test
    void formatarNomeAdvogadoProcuracaoEmNegrito_mantemTituloEUppercaseNoNome() {
        assertThat(QualificacaoPessoaUtil.formatarNomeAdvogadoProcuracaoEmNegrito(
                "Dr. Itamar Alexandre Felix Villa Real Junior"))
                .isEqualTo("<strong>Dr. ITAMAR ALEXANDRE FELIX VILLA REAL JUNIOR</strong>");
    }

    @Test
    void formatarCepLegadoProcuracao_mantemApenasDigitos() {
        assertThat(QualificacaoPessoaUtil.formatarCepLegadoProcuracao("75.040-060")).isEqualTo("75040060");
    }

    @Test
    void qualificacaoPjTextoPlano_preservaAmpersandNoNome() {
        String resultado = QualificacaoPessoaUtil.gerarQualificacao(
                "TRANSPORTADORA DE LEITE M&A LTDA",
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                null,
                "54.028.106/0001-22",
                "Avenida São Paulo",
                "1",
                "Quadra 27, Lote 7",
                "São João",
                "Anápolis",
                "GO",
                "75133330",
                null,
                null,
                false);

        assertThat(resultado).contains("M&A").doesNotContain("&amp;");
        assertThat(resultado).contains("Transportadora de Leite");
        assertThat(resultado).contains("Ltda");
    }
}
