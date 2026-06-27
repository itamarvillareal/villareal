package br.com.vilareal.documento;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class LocacaoTextoCorrecaoUtilTest {

    @Test
    void corrigeGrafiaClausula17AutorizadaCobranca() {
        String raw =
                "Caso ocorra o atraso no pagamento do aluguel,  já fica autorizado a cobrança pelo advogado";
        assertThat(LocacaoTextoCorrecaoUtil.normalizar(raw))
                .isEqualTo(
                        "Caso ocorra o atraso no pagamento do aluguel, já fica autorizada a cobrança pelo advogado");
    }

    @Test
    void corrigeGrafiaFechoJustasEContratadas() {
        String raw = "E por estarem justos e contratados as partes firmam o presente contrato";
        assertThat(LocacaoTextoCorrecaoUtil.normalizar(raw))
                .isEqualTo("E por estarem justas e contratadas, as partes firmam o presente contrato");
    }

    @Test
    void corrigeCraseEmAtendimentoAClausula() {
        assertThat(LocacaoTextoCorrecaoUtil.normalizar("Parágrafo único: em atendimento à esta cláusula, as partes"))
                .isEqualTo("Parágrafo único: em atendimento a esta cláusula, as partes");
    }

    @Test
    void corrigeLexicoLocacaoSemAcentos() {
        assertThat(LocacaoTextoCorrecaoUtil.normalizar("desocupacao do imovel na cidade de anapolis-go"))
                .isEqualTo("desocupação do imóvel na cidade de Anápolis-GO");
    }

    @Test
    void corrigeMojibakeEPreservaParagrafos() {
        String raw = "§1º \tTerminado o prazo\n§2º \tCaso nao haja pagamento";
        assertThat(LocacaoTextoCorrecaoUtil.normalizar(raw))
                .isEqualTo("§1º Terminado o prazo\n§2º Caso não haja pagamento");
    }

    @Test
    void corrigeSublocarTmPorJustoEOsLocatarios() {
        assertThat(LocacaoTextoCorrecaoUtil.normalizar("Marcus, tm por justo e contratado"))
                .isEqualTo("Marcus, têm por justo e contratado");
        assertThat(LocacaoTextoCorrecaoUtil.normalizar("d) S\tublocar o imóvel")).isEqualTo("d) Sublocar o imóvel");
        assertThat(LocacaoTextoCorrecaoUtil.normalizar("§3º OS Locatários fica")).isEqualTo("§3º Os Locatários fica");
    }

    @Test
    void corrigeEAgudoCorrompidoParaSao() {
        assertThat(LocacaoTextoCorrecaoUtil.normalizar("aviso prsãovio, Tambsãom, elsãotrica, dsãobito, Fsãolix"))
                .isEqualTo("aviso prévio, Também, elétrica, débito, Félix");
    }

    @Test
    void integracaoComCorrigirArtefatosTextoLocacao_nomeAdvogado() {
        String errado = "Dr. Itamar Alexandre Fsãolix Villa Real Junior (OAB/GO 33.329)";
        String out = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(errado);
        assertThat(out).contains("Itamar Alexandre Félix Villa Real Junior");
        assertThat(out).doesNotContain("Fsãolix");
    }

    @Test
    void integracaoTemplateClausula17E59() {
        String cl17 =
                "Caso ocorra o atraso no pagamento do aluguel,  já fica autorizado a cobrança pelo advogado do Locador, "
                        + "Dr. Itamar Alexandre Félix Villa Real Junior (OAB/GO 33.329), ficando ainda o Locatário sujeito "
                        + "ao pagamento dos honorários do profissional já fixados na base de 20% do valor do débito atualizado, "
                        + "independentemente das multas contratuais e cominações legais;";
        String fecho =
                "E por estarem justos e contratados as partes firmam o presente contrato em duas vias de igual conteúdo";

        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(cl17))
                .contains("já fica autorizada a cobrança")
                .doesNotContain("autorizado a cobrança");
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(fecho))
                .contains("justas e contratadas, as partes");
    }
}
