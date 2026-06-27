package br.com.vilareal.documento;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;
import java.util.HashMap;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class LocacaoTemplateLegadoSupportTest {

    @Test
    void preprocessar_removeMarcadoresParentesesVaziosECamposLegados() {
        Map<String, String> campos = new HashMap<>();
        campos.put("Endereco_Imovel", "Rua A, 100");
        campos.put("Quantidade_Garagens_Imovel", "2");
        campos.put("Data_Inicio_Aluguel", "2025-03-01");
        campos.put("Data_Fim_Aluguel", "2026-02-28");
        campos.put("Valor_Aluguel_Imovel", "1312.00");
        campos.put("Dia_Pagamento_Aluguel", "5");

        String template =
                "(\"CLAUSULA\")()()()()Propercase(Adequa(\"@\",\"Autor\",\"o\")) "
                        + "+++Nome(\"Autor\",\"all\")/\\, situado na Endereco_Imovel(\"@\"), "
                        + "Formatar_Texto(Quantidade_Garagens_Imovel(\"@\"),\"00\") "
                        + "Lcase(Verifica_Plural(\"@\",Quantidade_Garagens_Imovel(\"@\"),\"box\")) "
                        + "iniciando no dia Formatar_Texto(Data_Inicio_Aluguel(\"@\"),\"dd'de'mês'de'aaaa\") "
                        + "aluguel de Formatar_Texto(Valor_Aluguel_Imovel(\"@\"),\"R$\") "
                        + "(Extensoreais(Valor_Aluguel_Imovel(\"@\"))) "
                        + "até o dia Formatar_Texto(Dia_Pagamento_Aluguel(\"@\"),\"00\").";

        String out = LocacaoTemplateLegadoSupport.preprocessar(template, campos);

        assertThat(out).doesNotContain("Formatar_Texto");
        assertThat(out).doesNotContain("Verifica_Plural");
        assertThat(out).doesNotContain("Extensoreais");
        assertThat(out).doesNotContain("Endereco_Imovel(\"@\")");
        assertThat(out).doesNotContain("+++");
        assertThat(out).doesNotContain("()()");
        assertThat(out).contains("Rua A, 100");
        assertThat(out).contains("02 box");
        assertThat(out).contains("1 de março de 2025");
        assertThat(out).contains("R$");
        assertThat(out).contains("reais");
        assertThat(out).contains("05");
    }

    @Test
    void preprocessar_formatoGravadoNoBanco_semArroba() {
        Map<String, String> campos = new HashMap<>();
        campos.put("Endereco_Imovel", "Rua das Flores, 50");
        campos.put("Quantidade_Garagens_Imovel", "1");
        campos.put("quantidade_garagens_imovel", "1");
        campos.put("Data_Inicio_Aluguel", "2026-01-01");
        campos.put("Data_Fim_Aluguel", "2026-12-31");
        campos.put("Valor_Aluguel_Imovel", "1312.00");
        campos.put("Dia_Pagamento_Aluguel", "10");

        String template =
                "O Locador dá em locação o imóvel situado na Endereco_Imovel, "
                        + "Formatar_Texto(Quantidade_Garagens_Imovel,\"00\") "
                        + "verifica_plural(\"@\", quantidade_garagens_imovel,\"box\"), "
                        + "iniciando Formatar_Texto(Data_Inicio_Aluguel,\"dd'de'mês'de'aaaa\"), "
                        + "aluguel Formatar_Texto(Valor_Aluguel_Imovel,\"R$\") "
                        + "(Extensoreais(Valor_Aluguel_Imovel)) dia Formatar_Texto(Dia_Pagamento_Aluguel,\"00\").";

        String out = LocacaoTemplateLegadoSupport.preprocessar(template, campos);

        assertThat(out).doesNotContain("Formatar_Texto");
        assertThat(out).doesNotContain("verifica_plural");
        assertThat(out).doesNotContain("Extensoreais");
        assertThat(out).doesNotContain("Endereco_Imovel");
        assertThat(out).contains("Rua das Flores, 50");
        assertThat(out).contains("01 box");
        assertThat(out).contains("1 de janeiro de 2026");
        assertThat(out).contains("R$");
        assertThat(out).contains("10");
    }

    @Test
    void montarCamposLegacy_preencheUtilidadesDaClausula29() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setInscricaoImobiliaria("101.406.0332.216");
        imovel.setCamposExtrasJson(
                "{\"aguaNumero\":\"2177940-6\",\"energiaNumero\":\"10021333538 (129.364.805-15 04/06)\","
                        + "\"gasNumero\":\"333107 (tiago misael (885.894.391-00)\",\"linkVistoria\":\"https://exemplo/vistoria\"}");

        ContratoLocacaoEntity contrato = new ContratoLocacaoEntity();
        contrato.setImovel(imovel);

        Map<String, String> campos = LocacaoTemplateLegadoSupport.montarCamposLegacy(contrato, LocalDate.of(2026, 6, 22));

        assertThat(campos.get("Saneago_Imovel")).isEqualTo("2177940-6");
        assertThat(campos.get("Energia_Imovel")).isEqualTo("10021333538 (129.364.805-15 04/06)");
        assertThat(campos.get("Gas_Imovel")).isEqualTo("333107 (tiago misael (885.894.391-00)");
        assertThat(campos.get("Inscricao_Imobiliaria_Imovel")).isEqualTo("101.406.0332.216");
        assertThat(campos.get("Link_Vistoria")).isEqualTo("https://exemplo/vistoria");
    }

    @Test
    void preprocessar_clausula29Utilidades() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setCamposExtrasJson("{\"aguaNumero\":\"2177940-6\",\"energiaNumero\":\"10021333538\","
                + "\"gasNumero\":\"333107\",\"saneagoMatricula\":\"legado-ignorado\"}");

        ContratoLocacaoEntity contrato = new ContratoLocacaoEntity();
        contrato.setImovel(imovel);

        Map<String, String> campos = LocacaoTemplateLegadoSupport.montarCamposLegacy(contrato, LocalDate.now());
        String template =
                "a) Número de conta da Saneago: Saneago_Imovel(\"@\"); "
                        + "b) Energia: Energia_Imovel(\"@\"); c) Gás: Gas_Imovel(\"@\").";

        String out = LocacaoTemplateLegadoSupport.preprocessar(template, campos);

        assertThat(out).contains("2177940-6");
        assertThat(out).contains("10021333538");
        assertThat(out).contains("333107");
        assertThat(out).doesNotContain("Saneago_Imovel");
    }

    @Test
    void corrigirArtefatosTextoLocacao_corrigeSublocarQuebrado() {
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("d) S ublocar o imóvel"))
                .isEqualTo("d) Sublocar o imóvel");
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("Propercase(S) ublocar o imóvel"))
                .isEqualTo("Sublocar o imóvel");
    }
}
