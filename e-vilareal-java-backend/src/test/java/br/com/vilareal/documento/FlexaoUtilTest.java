package br.com.vilareal.documento;

import br.com.vilareal.documento.FlexaoUtil.Genero;
import br.com.vilareal.documento.FlexaoUtil.Numero;
import org.junit.jupiter.api.Test;

import static br.com.vilareal.documento.FlexaoUtil.Genero.FEMININO;
import static br.com.vilareal.documento.FlexaoUtil.Genero.MASCULINO;
import static br.com.vilareal.documento.FlexaoUtil.Numero.PLURAL;
import static br.com.vilareal.documento.FlexaoUtil.Numero.SINGULAR;
import static org.assertj.core.api.Assertions.assertThat;

class FlexaoUtilTest {

    private static String adequar(String palavra, Genero g, Numero n) {
        return FlexaoUtil.adequar(palavra, g, n);
    }

    // 1) adequar: cada lema do dicionário principal nas 4 combinações.

    @Test
    void adequarArtigoO() {
        assertThat(adequar("o", MASCULINO, SINGULAR)).isEqualTo("o");
        assertThat(adequar("o", FEMININO, SINGULAR)).isEqualTo("a");
        assertThat(adequar("o", MASCULINO, PLURAL)).isEqualTo("os");
        assertThat(adequar("o", FEMININO, PLURAL)).isEqualTo("as");
    }

    @Test
    void adequarEle() {
        assertThat(adequar("ele", MASCULINO, SINGULAR)).isEqualTo("ele");
        assertThat(adequar("ele", FEMININO, SINGULAR)).isEqualTo("ela");
        assertThat(adequar("ele", MASCULINO, PLURAL)).isEqualTo("eles");
        assertThat(adequar("ele", FEMININO, PLURAL)).isEqualTo("elas");
    }

    @Test
    void adequarDo() {
        assertThat(adequar("do", MASCULINO, SINGULAR)).isEqualTo("do");
        assertThat(adequar("do", FEMININO, SINGULAR)).isEqualTo("da");
        assertThat(adequar("do", MASCULINO, PLURAL)).isEqualTo("dos");
        assertThat(adequar("do", FEMININO, PLURAL)).isEqualTo("das");
    }

    @Test
    void adequarPelo() {
        assertThat(adequar("pelo", MASCULINO, SINGULAR)).isEqualTo("pelo");
        assertThat(adequar("pelo", FEMININO, SINGULAR)).isEqualTo("pela");
        assertThat(adequar("pelo", MASCULINO, PLURAL)).isEqualTo("pelos");
        assertThat(adequar("pelo", FEMININO, PLURAL)).isEqualTo("pelas");
    }

    @Test
    void adequarNo() {
        assertThat(adequar("no", MASCULINO, SINGULAR)).isEqualTo("no");
        assertThat(adequar("no", FEMININO, SINGULAR)).isEqualTo("na");
        assertThat(adequar("no", MASCULINO, PLURAL)).isEqualTo("nos");
        assertThat(adequar("no", FEMININO, PLURAL)).isEqualTo("nas");
    }

    @Test
    void adequarExecutado() {
        assertThat(adequar("executado", MASCULINO, SINGULAR)).isEqualTo("executado");
        assertThat(adequar("executado", FEMININO, SINGULAR)).isEqualTo("executada");
        assertThat(adequar("executado", MASCULINO, PLURAL)).isEqualTo("executados");
        assertThat(adequar("executado", FEMININO, PLURAL)).isEqualTo("executadas");
    }

    @Test
    void adequarExequente() {
        assertThat(adequar("exequente", MASCULINO, SINGULAR)).isEqualTo("exequente");
        assertThat(adequar("exequente", FEMININO, SINGULAR)).isEqualTo("exequente");
        assertThat(adequar("exequente", MASCULINO, PLURAL)).isEqualTo("exequentes");
        assertThat(adequar("exequente", FEMININO, PLURAL)).isEqualTo("exequentes");
    }

    @Test
    void adequarCredor() {
        assertThat(adequar("credor", MASCULINO, SINGULAR)).isEqualTo("credor");
        assertThat(adequar("credor", FEMININO, SINGULAR)).isEqualTo("credora");
        assertThat(adequar("credor", MASCULINO, PLURAL)).isEqualTo("credores");
        assertThat(adequar("credor", FEMININO, PLURAL)).isEqualTo("credoras");
    }

    @Test
    void adequarDevedor() {
        assertThat(adequar("devedor", MASCULINO, SINGULAR)).isEqualTo("devedor");
        assertThat(adequar("devedor", FEMININO, SINGULAR)).isEqualTo("devedora");
        assertThat(adequar("devedor", MASCULINO, PLURAL)).isEqualTo("devedores");
        assertThat(adequar("devedor", FEMININO, PLURAL)).isEqualTo("devedoras");
    }

    @Test
    void adequarSolvente() {
        assertThat(adequar("solvente", MASCULINO, SINGULAR)).isEqualTo("solvente");
        assertThat(adequar("solvente", FEMININO, SINGULAR)).isEqualTo("solvente");
        assertThat(adequar("solvente", MASCULINO, PLURAL)).isEqualTo("solventes");
        assertThat(adequar("solvente", FEMININO, PLURAL)).isEqualTo("solventes");
    }

    @Test
    void adequarProprietario() {
        assertThat(adequar("proprietário", MASCULINO, SINGULAR)).isEqualTo("proprietário");
        assertThat(adequar("proprietário", FEMININO, SINGULAR)).isEqualTo("proprietária");
        assertThat(adequar("proprietário", MASCULINO, PLURAL)).isEqualTo("proprietários");
        assertThat(adequar("proprietário", FEMININO, PLURAL)).isEqualTo("proprietárias");
    }

    @Test
    void adequarResponsavel() {
        assertThat(adequar("responsável", MASCULINO, SINGULAR)).isEqualTo("responsável");
        assertThat(adequar("responsável", FEMININO, SINGULAR)).isEqualTo("responsável");
        assertThat(adequar("responsável", MASCULINO, PLURAL)).isEqualTo("responsáveis");
        assertThat(adequar("responsável", FEMININO, PLURAL)).isEqualTo("responsáveis");
    }

    @Test
    void adequarLegitimo() {
        assertThat(adequar("legítimo", MASCULINO, SINGULAR)).isEqualTo("legítimo");
        assertThat(adequar("legítimo", FEMININO, SINGULAR)).isEqualTo("legítima");
        assertThat(adequar("legítimo", MASCULINO, PLURAL)).isEqualTo("legítimos");
        assertThat(adequar("legítimo", FEMININO, PLURAL)).isEqualTo("legítimas");
    }

    @Test
    void adequarInadimplente() {
        assertThat(adequar("inadimplente", MASCULINO, SINGULAR)).isEqualTo("inadimplente");
        assertThat(adequar("inadimplente", FEMININO, SINGULAR)).isEqualTo("inadimplente");
        assertThat(adequar("inadimplente", MASCULINO, PLURAL)).isEqualTo("inadimplentes");
        assertThat(adequar("inadimplente", FEMININO, PLURAL)).isEqualTo("inadimplentes");
    }

    @Test
    void adequarCompelido() {
        assertThat(adequar("compelido", MASCULINO, SINGULAR)).isEqualTo("compelido");
        assertThat(adequar("compelido", FEMININO, SINGULAR)).isEqualTo("compelida");
        assertThat(adequar("compelido", MASCULINO, PLURAL)).isEqualTo("compelidos");
        assertThat(adequar("compelido", FEMININO, PLURAL)).isEqualTo("compelidas");
    }

    @Test
    void adequarCondenado() {
        assertThat(adequar("condenado", MASCULINO, SINGULAR)).isEqualTo("condenado");
        assertThat(adequar("condenado", FEMININO, SINGULAR)).isEqualTo("condenada");
        assertThat(adequar("condenado", MASCULINO, PLURAL)).isEqualTo("condenados");
        assertThat(adequar("condenado", FEMININO, PLURAL)).isEqualTo("condenadas");
    }

    @Test
    void adequarMencionado() {
        assertThat(adequar("mencionado", MASCULINO, SINGULAR)).isEqualTo("mencionado");
        assertThat(adequar("mencionado", FEMININO, SINGULAR)).isEqualTo("mencionada");
        assertThat(adequar("mencionado", MASCULINO, PLURAL)).isEqualTo("mencionados");
        assertThat(adequar("mencionado", FEMININO, PLURAL)).isEqualTo("mencionadas");
    }

    @Test
    void adequarVerboE() {
        assertThat(adequar("é", MASCULINO, SINGULAR)).isEqualTo("é");
        assertThat(adequar("é", FEMININO, SINGULAR)).isEqualTo("é");
        assertThat(adequar("é", MASCULINO, PLURAL)).isEqualTo("são");
        assertThat(adequar("é", FEMININO, PLURAL)).isEqualTo("são");
    }

    @Test
    void adequarVerboEsta() {
        assertThat(adequar("está", MASCULINO, SINGULAR)).isEqualTo("está");
        assertThat(adequar("está", FEMININO, SINGULAR)).isEqualTo("está");
        assertThat(adequar("está", MASCULINO, PLURAL)).isEqualTo("estão");
        assertThat(adequar("está", FEMININO, PLURAL)).isEqualTo("estão");
    }

    @Test
    void adequarEfetuar() {
        assertThat(adequar("efetuar", MASCULINO, SINGULAR)).isEqualTo("efetuar");
        assertThat(adequar("efetuar", FEMININO, SINGULAR)).isEqualTo("efetuar");
        assertThat(adequar("efetuar", MASCULINO, PLURAL)).isEqualTo("efetuarem");
        assertThat(adequar("efetuar", FEMININO, PLURAL)).isEqualTo("efetuarem");
    }

    @Test
    void adequarEndereco() {
        assertThat(adequar("endereço", MASCULINO, SINGULAR)).isEqualTo("endereço");
        assertThat(adequar("endereço", FEMININO, SINGULAR)).isEqualTo("endereço");
        assertThat(adequar("endereço", MASCULINO, PLURAL)).isEqualTo("endereços");
        assertThat(adequar("endereço", FEMININO, PLURAL)).isEqualTo("endereços");
    }

    // 2) pluralizar

    @Test
    void pluralizarTitulo() {
        assertThat(FlexaoUtil.pluralizar("título", PLURAL)).isEqualTo("títulos");
        assertThat(FlexaoUtil.pluralizar("título", SINGULAR)).isEqualTo("título");
    }

    @Test
    void pluralizarExtrajudicial() {
        assertThat(FlexaoUtil.pluralizar("extrajudicial", PLURAL)).isEqualTo("extrajudiciais");
        assertThat(FlexaoUtil.pluralizar("extrajudicial", SINGULAR)).isEqualTo("extrajudicial");
    }

    @Test
    void pluralizarEncontra() {
        assertThat(FlexaoUtil.pluralizar("encontra", PLURAL)).isEqualTo("encontram");
        assertThat(FlexaoUtil.pluralizar("encontra", SINGULAR)).isEqualTo("encontra");
    }

    @Test
    void pluralizarExecutivoEAcostado() {
        assertThat(FlexaoUtil.pluralizar("executivo", PLURAL)).isEqualTo("executivos");
        assertThat(FlexaoUtil.pluralizar("acostado", PLURAL)).isEqualTo("acostados");
    }

    @Test
    void pluralizarDerivaDoDicionarioPrincipal() {
        assertThat(FlexaoUtil.pluralizar("o", PLURAL)).isEqualTo("os");
        assertThat(FlexaoUtil.pluralizar("o", SINGULAR)).isEqualTo("o");
    }

    // 3) preservação de caixa

    @Test
    void preservaCaixaCapitalizada() {
        assertThat(adequar("Executado", FEMININO, SINGULAR)).isEqualTo("Executada");
        assertThat(adequar("Executado", FEMININO, PLURAL)).isEqualTo("Executadas");
    }

    @Test
    void preservaCaixaMinuscula() {
        assertThat(adequar("executado", FEMININO, SINGULAR)).isEqualTo("executada");
    }

    // 4) fallback heurístico (palavra fora do dicionário)

    @Test
    void fallbackHeuristicoGenero() {
        assertThat(adequar("advogado", FEMININO, SINGULAR)).isEqualTo("advogada");
        assertThat(adequar("autor", FEMININO, SINGULAR)).isEqualTo("autora");
        assertThat(adequar("advogado", FEMININO, PLURAL)).isEqualTo("advogadas");
    }

    @Test
    void fallbackHeuristicoPlural() {
        assertThat(FlexaoUtil.pluralizar("documento", PLURAL)).isEqualTo("documentos");
        assertThat(FlexaoUtil.pluralizar("imóvel", PLURAL)).isEqualTo("imóveis");
    }

    // 5) lemas novos (F6) + lookup case-insensitive

    @Test
    void adequarReu() {
        assertThat(adequar("réu", FEMININO, SINGULAR)).isEqualTo("ré");
        assertThat(adequar("réu", MASCULINO, PLURAL)).isEqualTo("réus");
        assertThat(adequar("réu", FEMININO, PLURAL)).isEqualTo("rés");
    }

    @Test
    void adequarEstarCaseInsensitive() {
        assertThat(adequar("ESTAR", MASCULINO, PLURAL)).isEqualTo("estão");
        assertThat(adequar("estar", MASCULINO, PLURAL)).isEqualTo("estão");
    }

    @Test
    void adequarDesfazer() {
        assertThat(adequar("desfazer", MASCULINO, PLURAL)).isEqualTo("desfazerem");
    }

    @Test
    void adequarExecutadoLookupCaseInsensitive() {
        assertThat(adequar("Executado", FEMININO, SINGULAR)).isEqualTo("Executada");
        // lookup case-insensitive: entrada toda em caixa-alta encontra a entrada e devolve a forma canônica
        assertThat(adequar("EXECUTADO", FEMININO, SINGULAR)).isEqualTo("executada");
    }

    @Test
    void adequarAutorPlural() {
        assertThat(adequar("autor", FEMININO, PLURAL)).isEqualTo("autoras");
    }
}
