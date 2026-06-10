package br.com.vilareal.documento;

import br.com.vilareal.documento.FlexaoUtil.Genero;
import br.com.vilareal.documento.FlexaoUtil.Numero;
import br.com.vilareal.documento.TopicoTokenResolver.ProcessamentoContexto;
import java.util.Map;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class TopicoTokenResolverTest {

    private static ProcessamentoContexto ctx(Genero gReu, Numero nReu, Numero nTitulos) {
        return new ProcessamentoContexto(
                Genero.MASCULINO, Numero.SINGULAR,
                gReu, nReu,
                nTitulos,
                "Apto 101 Bloco A",
                "R$ 1.234,56",
                "mil duzentos e trinta e quatro reais e cinquenta e seis centavos",
                "qualificação do autor",
                "qualificação do réu",
                "FULANO DE TAL",
                "BELTRANO DE TAL",
                Map.of());
    }

    @Test
    void flexReuMasculinoSingular() {
        String r = TopicoTokenResolver.resolver(
                "{{flex:reu:executado|proper}} {{flex:reu:está|lower}} inadimplente",
                ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        assertThat(r).isEqualTo("Executado está inadimplente");
    }

    @Test
    void flexReuFemininoPlural() {
        String r = TopicoTokenResolver.resolver(
                "{{flex:reu:o|lower}} {{flex:reu:executado|proper}}",
                ctx(Genero.FEMININO, Numero.PLURAL, Numero.PLURAL));
        assertThat(r).isEqualTo("as Executadas");
    }

    @Test
    void pluralTituloPlural() {
        String r = TopicoTokenResolver.resolver(
                "{{plural:titulo:título|proper}} {{plural:titulo:executivo|lower}}",
                ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        assertThat(r).isEqualTo("Títulos executivos");
    }

    @Test
    void totalDebito() {
        String r = TopicoTokenResolver.resolver(
                "importância de {{totalDebito}}",
                ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        assertThat(r).isEqualTo(
                "importância de R$ 1.234,56 (mil duzentos e trinta e quatro reais e cinquenta e seis centavos)");
    }

    @Test
    void totalDebitoExtenso() {
        String r = TopicoTokenResolver.resolver(
                "({{totalDebitoExtenso}})",
                ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        assertThat(r).isEqualTo("(mil duzentos e trinta e quatro reais e cinquenta e seis centavos)");
    }

    @Test
    void unidade() {
        String r = TopicoTokenResolver.resolver(
                "imóvel constituído pela {{unidade}}",
                ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        assertThat(r).isEqualTo("imóvel constituído pela Apto 101 Bloco A");
    }

    @Test
    void flexReuFemininoSingularReu() {
        String r = TopicoTokenResolver.resolver(
                "{{flex:reu:réu|proper}}",
                ctx(Genero.FEMININO, Numero.SINGULAR, Numero.SINGULAR));
        assertThat(r).isEqualTo("Ré");
    }

    @Test
    void debitosPreservadoIntacto() {
        String original = "{{debitos:Completo|Taxa condominial vencida em |Todos}}";
        String r = TopicoTokenResolver.resolver(original, ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        assertThat(r).isEqualTo(original);
    }

    @Test
    void perguntaSemRespostaVirVazio() {
        String r = TopicoTokenResolver.resolver(
                "{{pergunta:ARTIGO DO REGIMENTO INTERNO}}",
                ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        assertThat(r).isEqualTo("");
    }

    @Test
    void qualificaENome() {
        ProcessamentoContexto ctx = ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL);
        assertThat(TopicoTokenResolver.resolver("{{qualifica:autor}}", ctx)).isEqualTo("qualificação do autor");
        assertThat(TopicoTokenResolver.resolver("{{qualifica:reu}}", ctx)).isEqualTo("qualificação do réu");
        assertThat(TopicoTokenResolver.resolver("{{nome:autor}}", ctx)).isEqualTo("FULANO DE TAL");
        assertThat(TopicoTokenResolver.resolver("{{nome:reu}}", ctx)).isEqualTo("BELTRANO DE TAL");
    }

    @Test
    void alvoDesconhecidoEmFlexPreservaLema() {
        String r = TopicoTokenResolver.resolver(
                "{{flex:terceiro:executado|proper}}",
                ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        // alvo desconhecido → não flexiona, aplica só a caixa ao lema
        assertThat(r).isEqualTo("Executado");
    }

    @Test
    void tokenDesconhecidoPreservado() {
        String r = TopicoTokenResolver.resolver(
                "valor {{foobar:xyz}} fim",
                ctx(Genero.MASCULINO, Numero.SINGULAR, Numero.PLURAL));
        assertThat(r).isEqualTo("valor {{foobar:xyz}} fim");
    }
}
