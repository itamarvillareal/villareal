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
    void corrigirArtefatosTextoLocacao_normalizaNomeAdvogadoClausula17() {
        String errado =
                "Dr. Itamar Alexandre Fsãolix Villa Real Junior (OAB/GO 33.329), ficando ainda os Locatários";
        String out = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(errado);
        assertThat(out).contains("Itamar Alexandre Félix Villa Real Junior");
        assertThat(out).doesNotContain("Fsãolix");
        assertThat(out).doesNotContain("Felix Villa");
    }

    @Test
    void corrigirArtefatosTextoLocacao_corrigeSublocarQuebrado() {
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("d) S ublocar o imóvel"))
                .isEqualTo("d) Sublocar o imóvel");
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(
                        "d) S\tublocar o imóvel sem autorização expressa da Locadora;"))
                .isEqualTo("d) Sublocar o imóvel sem autorização expressa da Locadora;");
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("Propercase(S) ublocar o imóvel"))
                .isEqualTo("Sublocar o imóvel");
    }

    @Test
    void corrigirArtefatosTextoLocacao_normalizaOsLocatarios() {
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("§3º OS Locatários fica"))
                .isEqualTo("§3º Os Locatários fica");
    }

    @Test
    void corrigirArtefatosTextoLocacao_normalizaTmPorJusto() {
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("Marcus, tm por justo e contratado"))
                .isEqualTo("Marcus, têm por justo e contratado");
    }

    @Test
    void corrigirArtefatosTextoLocacao_normalizaVirgulasDuplasEEspacoAntesDaVirgula() {
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("CEP 75.110-580, , e, como LOCATÁRIOS"))
                .isEqualTo("CEP 75.110-580, e, como LOCATÁRIOS");
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("Marcus Anacleto , brasileiro"))
                .isEqualTo("Marcus Anacleto, brasileiro");
        assertThat(LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao("locação;; do mês"))
                .isEqualTo("locação; do mês");
    }

    @Test
    void preprocessar_valorAluguelIsoDecimalFormataMoedaBrEExtenso() {
        Map<String, String> campos = new HashMap<>();
        campos.put("Valor_Aluguel_Imovel", "1650.00");

        String template =
                "aluguel mensal de Formatar_Texto(Valor_Aluguel_Imovel(\"@\"),\"R$\") "
                        + "(Extensoreais(Valor_Aluguel_Imovel(\"@\")))";

        String out = LocacaoTemplateLegadoSupport.preprocessar(template, campos);

        assertThat(out).contains("R$");
        assertThat(out).contains("1.650,00");
        assertThat(out).contains("um mil seiscentos e cinquenta reais");
        assertThat(out).doesNotContain("165.000");
        assertThat(out).doesNotContain("cento e sessenta e cinco mil");
    }

    @Test
    void preprocessar_linkVistoriaNaClausula7() {
        Map<String, String> campos = new HashMap<>();
        campos.put(
                "Link_Vistoria",
                "https://www.dropbox.com/scl/fo/5xt59k5ijz3g9cnemfq5m/AMfdIOL4EmB3zbyj93GktRo?rlkey=humo7d3eo86031e6byd3xplmp&dl=0");

        String template =
                "Parágrafo único: faz parte integrante deste contrato termo de vistoria do imóvel locado "
                        + "com as condições gerais do imóvel locado; e fotos disponíveis no link Link_Vistoria(\"@\");";

        String out = LocacaoTemplateLegadoSupport.preprocessar(template, campos);

        assertThat(out).contains("https://www.dropbox.com/scl/fo/5xt59k5ijz3g9cnemfq5m/");
        assertThat(out).doesNotContain("Link_Vistoria");
    }

    @Test
    void aplicarLinkVistoria_atualizaCamposLegados() {
        Map<String, String> params = new HashMap<>();
        LocacaoTemplateLegadoSupport.aplicarLinkVistoria(params, "https://exemplo/vistoria");

        assertThat(params.get("Link_Vistoria")).isEqualTo("https://exemplo/vistoria");
        assertThat(params.get("linkVistoria")).isEqualTo("https://exemplo/vistoria");
    }

    @Test
    void aplicarValorLocacao_atualizaCamposLegados() {
        Map<String, String> params = new HashMap<>();
        LocacaoTemplateLegadoSupport.aplicarValorLocacao(params, new java.math.BigDecimal("1700"));

        assertThat(params.get("Valor_Aluguel_Imovel")).isEqualTo("1700,00");
        assertThat(params.get("valorAluguel")).isEqualTo("1700,00");
        assertThat(params.get("valorCausa")).isEqualTo("1700,00");
    }

    @Test
    void aplicarVigenciaLocacao_atualizaCamposLegadosDePrazo() {
        Map<String, String> params = new HashMap<>();
        params.put("Data_Inicio_Aluguel", "2025-01-01");
        params.put("Data_Fim_Aluguel", "2025-12-31");

        LocacaoTemplateLegadoSupport.aplicarVigenciaLocacao(
                params, LocalDate.of(2025, 5, 30), LocalDate.of(2025, 11, 30));

        assertThat(params.get("Data_Inicio_Aluguel")).isEqualTo("2025-05-30");
        assertThat(params.get("Data_Fim_Aluguel")).isEqualTo("2025-11-30");
        assertThat(params.get("dataInicio")).isEqualTo("2025-05-30");
        assertThat(params.get("dataFim")).isEqualTo("2025-11-30");
        assertThat(params.get("Prazo_Locacao_Meses")).isEqualTo("6");
        assertThat(params.get("prazoLocacaoTexto")).isEqualTo("6 meses");
    }

    @Test
    void preprocessar_clausula2_substituiDozeMesesPeloPrazoCalculado() {
        Map<String, String> campos = new HashMap<>();
        campos.put("Data_Inicio_Aluguel", "2025-05-30");
        campos.put("Data_Fim_Aluguel", "2025-11-30");
        LocacaoTemplateLegadoSupport.aplicarVigenciaLocacao(
                campos, LocalDate.of(2025, 5, 30), LocalDate.of(2025, 11, 30));

        String template =
                "O prazo da locação é de 12 meses, iniciando no dia "
                        + "Formatar_Texto(Data_Inicio_Aluguel(\"@\"),\"dd'de'mês'de'aaaa\") e terminando no dia "
                        + "Formatar_Texto(Data_Fim_Aluguel(\"@\"),\"dd'de'mês'de'aaaa\");";

        String out = LocacaoTemplateLegadoSupport.preprocessar(template, campos);

        assertThat(out).contains("é de 6 meses");
        assertThat(out).doesNotContain("12 meses");
        assertThat(out).contains("30 de maio de 2025");
        assertThat(out).contains("30 de novembro de 2025");
    }

    @Test
    void aplicarVigenciaLocacao_atualizaDatasECalculaPrazoJunhoADezembro() {
        Map<String, String> params = new HashMap<>();
        params.put("Data_Inicio_Aluguel", "2025-01-01");
        params.put("Data_Fim_Aluguel", "2025-12-31");

        LocacaoTemplateLegadoSupport.aplicarVigenciaLocacao(
                params, LocalDate.of(2026, 6, 29), LocalDate.of(2026, 12, 29));

        assertThat(params.get("Data_Inicio_Aluguel")).isEqualTo("2026-06-29");
        assertThat(params.get("Data_Fim_Aluguel")).isEqualTo("2026-12-29");
        assertThat(params.get("dataInicio")).isEqualTo("2026-06-29");
        assertThat(params.get("dataFim")).isEqualTo("2026-12-29");
        assertThat(params.get("Prazo_Locacao_Meses")).isEqualTo("6");
        assertThat(params.get("prazoLocacaoTexto")).isEqualTo("6 meses");
    }

    @Test
    void preprocessar_clausula3_depositoTed() {
        Map<String, String> campos = new HashMap<>();
        campos.put("Dia_Pagamento_Aluguel", "5");
        campos.put("Valor_Aluguel_Imovel", "1700.00");
        campos.put("formaPagamentoAluguel", FormaPagamentoAluguelLocacao.DEPOSITO_TED);

        String template =
                "O aluguel mensal convencionado é de Formatar_Texto(Valor_Aluguel_Imovel(\"@\"),\"R$\") "
                        + "(Extensoreais(Valor_Aluguel_Imovel(\"@\"))) a ser pago até o dia "
                        + "Formatar_Texto(Dia_Pagamento_Aluguel(\"@\"),\"00\") do mês vigente de locação, "
                        + "mediante depósito, TED ou transferência na conta do Administrador do Locador no Banco Itaú, "
                        + "agência 9664, conta 00747-4 ou Pix CPF 007.332.351-90, servindo o recibo de depósito "
                        + "como comprovante de pagamento do aluguel e encargos decorrentes da locação;; "
                        + "do mês vigente de locação, mediante boletos que já foram disponibilizados ao Locatário, "
                        + "servindo este contrato como recibo dos boletos enviados, e o recibo do pagamento do próprio "
                        + "boleto como comprovante de pagamento do aluguel;";

        String out = LocacaoTemplateLegadoSupport.preprocessar(template, campos);

        assertThat(out).contains("até o dia 05 do mês vigente de locação");
        assertThat(out).contains("mediante depósito, TED ou transferência");
        assertThat(out).contains("007.332.351-90");
        assertThat(out).doesNotContain(";;");
        assertThat(out).doesNotContain("mediante boletos");
    }

    @Test
    void preprocessar_clausula3_boletos() {
        Map<String, String> campos = new HashMap<>();
        campos.put("Dia_Pagamento_Aluguel", "10");
        campos.put("Valor_Aluguel_Imovel", "1650.00");
        campos.put("formaPagamentoAluguel", FormaPagamentoAluguelLocacao.BOLETO);

        String template =
                "O aluguel mensal convencionado é de Formatar_Texto(Valor_Aluguel_Imovel(\"@\"),\"R$\") "
                        + "(Extensoreais(Valor_Aluguel_Imovel(\"@\"))) a ser pago até o dia "
                        + "Formatar_Texto(Dia_Pagamento_Aluguel(\"@\"),\"00\") do mês vigente de locação, "
                        + "mediante depósito, TED ou transferência na conta do Administrador do Locador no Banco Itaú, "
                        + "agência 9664, conta 00747-4 ou Pix CPF 007.332.351-90, servindo o recibo de depósito "
                        + "como comprovante de pagamento do aluguel e encargos decorrentes da locação;; "
                        + "do mês vigente de locação, mediante boletos que já foram disponibilizados ao Locatário, "
                        + "servindo este contrato como recibo dos boletos enviados, e o recibo do pagamento do próprio "
                        + "boleto como comprovante de pagamento do aluguel;";

        String out = LocacaoTemplateLegadoSupport.preprocessar(template, campos);

        assertThat(out).contains("até o dia 10 do mês vigente de locação");
        assertThat(out).contains("mediante boletos que já foram disponibilizados");
        assertThat(out).doesNotContain(";;");
        assertThat(out).doesNotContain("mediante depósito");
        assertThat(out).doesNotContain("007.332.351-90");
    }

    @Test
    void montarCamposLegacy_dataPag1TxCondDoExtras() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setCamposExtrasJson("{\"dataPag1TxCond\":\"10/07/2026\"}");

        ContratoLocacaoEntity contrato = new ContratoLocacaoEntity();
        contrato.setImovel(imovel);
        contrato.setDataInicio(LocalDate.of(2025, 5, 30));

        Map<String, String> campos = LocacaoTemplateLegadoSupport.montarCamposLegacy(contrato, LocalDate.now());

        assertThat(campos.get("Data_Pag_1_Tx_Cond")).isEqualTo("2026-07-10");
    }

    @Test
    void preprocessar_paragrafoTaxaCondominial_usaDataPag1TxCondEPrazoLocacao() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setCamposExtrasJson("{\"dataPag1TxCond\":\"10/07/2026\"}");

        ContratoLocacaoEntity contrato = new ContratoLocacaoEntity();
        contrato.setImovel(imovel);
        contrato.setDataInicio(LocalDate.of(2025, 5, 30));
        contrato.setDataFim(LocalDate.of(2025, 11, 30));

        Map<String, String> campos = LocacaoTemplateLegadoSupport.montarCamposLegacy(contrato, LocalDate.now());
        LocacaoTemplateLegadoSupport.aplicarVigenciaLocacao(
                campos, LocalDate.of(2025, 5, 30), LocalDate.of(2025, 11, 30));

        String template =
                "§3º Os Locatários ficam responsáveis pelo pagamento da taxa condominial que vence a partir de "
                        + "Formatar_Texto(Data_Pag_1_Tx_Cond(\"@\"),\"dd'de'mês'de'aaaa\"), "
                        + "devendo fazer o pagamento por igual período de meses da locação, ou seja, 12 meses, "
                        + "caso o contrato não seja renovado;";

        String out = LocacaoTemplateLegadoSupport.corrigirArtefatosTextoLocacao(
                LocacaoTemplateLegadoSupport.preprocessar(template, campos));

        assertThat(out).contains("10 de julho de 2026");
        assertThat(out).doesNotContain("30 de maio de 2025");
        assertThat(out).contains("6 meses");
        assertThat(out).contains("mesma quantidade de taxas condominiais");
    }

    @Test
    void aplicarDataPagamentoPrimeiraTaxaCondominial_atualizaCamposLegados() {
        Map<String, String> params = new HashMap<>();
        LocacaoTemplateLegadoSupport.aplicarDataPagamentoPrimeiraTaxaCondominial(params, LocalDate.of(2026, 7, 10));

        assertThat(params.get("Data_Pag_1_Tx_Cond")).isEqualTo("2026-07-10");
        assertThat(params.get("dataPag1TxCond")).isEqualTo("2026-07-10");
    }

    @Test
    void aplicarDiaVencimento_eFormaPagamento_atualizamCamposLegados() {
        Map<String, String> params = new HashMap<>();
        LocacaoTemplateLegadoSupport.aplicarDiaVencimento(params, 15);
        LocacaoTemplateLegadoSupport.aplicarFormaPagamentoAluguel(params, FormaPagamentoAluguelLocacao.BOLETO);

        assertThat(params.get("Dia_Pagamento_Aluguel")).isEqualTo("15");
        assertThat(params.get("Forma_Pagamento_Aluguel")).isEqualTo(FormaPagamentoAluguelLocacao.BOLETO);
    }
}
