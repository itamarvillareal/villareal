package br.com.vilareal.documento;

import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/** Texto fixo das cláusulas do contrato de honorários (modelo legado Villa Real). */
final class ContratoHonorariosClausulas {

    private static final String OBJETO_PADRAO =
            "EM PEDIDO DE INDENIZAÇÃO POR DANO MORAL E MATERIAL, em face de XXXXXXXXXXXX";

    static final String CLAUSULA_3_PADRAO =
            "Em REMUNERAÇÃO desses serviços, o advogado Contratado receberá da Contratante os "
                    + "honorários líquidos e certos na importância de 35% (trinta e cinco por cento) calculados "
                    + "sobre o montante proveito econômico da demanda (inclusive extrajudicial);";

    private ContratoHonorariosClausulas() {}

    static List<String> montarClausulas(String objetoContrato, String clausula3Remuneracao) {
        String objeto = StringUtils.hasText(objetoContrato) ? objetoContrato.trim() : OBJETO_PADRAO;
        String clausula3 = StringUtils.hasText(clausula3Remuneracao) ? clausula3Remuneracao.trim() : CLAUSULA_3_PADRAO;
        List<String> clausulas = new ArrayList<>(16);
        clausulas.add(
                "Cláusula 1ª. O advogado contratado obriga-se, face ao Mandado Judicial ou Administrativo "
                        + "outorgado, a prestar seus serviços profissionais, ao constituinte, desincumbindo com zelo "
                        + "a atividade a seu encargo, consoante os Estatutos da Ordem dos Advogados do Brasil e o "
                        + "Código de Ética Profissional, no seguinte serviço profissional:");
        clausulas.add(
                "Cláusula 2ª. O presente instrumento tem como OBJETO a prestação de serviços advocatícios, "
                        + objeto
                        + ", até Sentença de Primeiro Grau, inclusive por via extrajudicial.");
        clausulas.add("Cláusula 3ª. " + clausula3);
        clausulas.add(
                "Cláusula 4ª. Ao contratante tem ciência que o contrato de prestação de serviços "
                        + "agora firmado é contrato de meio, não obrigando o CONTRATADO com o resultado da demanda, "
                        + "sendo que esta pode resultar em nenhum resultado efetivo;");
        clausulas.add(
                "Cláusula 5ª. Na eventualidade de atuação recursos, não havendo novo pacto, fica desde já "
                        + "estabelecido que será acrescido no montante de honorários descritos na Cláusula retro, o "
                        + "montante de 10% para cada instância recursal;");
        clausulas.add(
                "Cláusula 6ª. Ao contratante caberá o fornecimento de documentos e informações que o Contratado "
                        + "solicitar dentro dos prazos legais, e ainda, correndo por conta da Contratante todas as "
                        + "despesas com custas processuais (dispensadas na forma da lei 9.099) e despesas que forem "
                        + "necessárias ao bom andamento do processo, inclusive extração de documentos e "
                        + "desarquivamento. Em caso de processos fora da comarca de Anápolis, as despesas com "
                        + "combustível, alimentação, hospedagem e passagens áreas e outras despesas. Tudo contra "
                        + "recibo devidamente preparado e assinado pelo Contratado ou mediante simples solicitação "
                        + "verbal do Contratado;");
        clausulas.add("Cláusula 7ª. Os honorários de sucumbência pertencem ao Contratado;");
        clausulas.add(
                "Cláusula 8ª. As partes estabelecem que havendo atraso no pagamento dos honorários, será cobrada "
                        + "multa contratual de 20% (vinte por cento) e juros de mora na proporção de 5% (cinco por "
                        + "cento) ao mês; podendo, ainda, haver interrupção na prestação dos serviços por parte do "
                        + "advogado;");
        clausulas.add(
                "Cláusula 9ª. Em caso de rescisão contratual, abandono da causa ou desistência da ação, por parte "
                        + "do Contratante, será devido ao CONTRATADO valor correspondente a 50% (cinquenta por "
                        + "cento) da remuneração ou, caso não haja sentença ou recebimento: do valor da causa;");
        clausulas.add(
                "Cláusula 10ª. O total dos honorários será ser exigido imediatamente, se houver composição amigável "
                        + "(judicial ou extrajudicial) realizada por qualquer das partes, ou no caso do não "
                        + "prosseguimento do feito por qualquer circunstância não determinada pelo advogado "
                        + "Contratado ou, ainda, se lhe for cassado o mandato sem culpa;");
        clausulas.add(
                "Cláusula 11ª. Caso o Contratado levante alvará de valores, fica desde já autorizada a liquidação "
                        + "deste contrato, pela quantia levantada, caso os valores sejam suficientes. A diferença, se "
                        + "houver, será repassada ao Contratante, dando-se plena, geral e irrevogável quitação ao "
                        + "presente Contrato;");
        clausulas.add(
                "Cláusula 12ª. Para dirimir quaisquer controvérsias oriundas do contrato, que faz lei entre as "
                        + "partes, elegem o foro da comarca de Anápolis, Estado de Goiás, renunciando desde já, por "
                        + "mais privilegiado que sejam outros;");
        clausulas.add(
                "Cláusula 13ª. Os herdeiros ou sucessores das partes contratantes se obrigam desde já ao inteiro "
                        + "teor deste contrato;");
        clausulas.add(
                "Cláusula 14ª. Caso seja necessário ingressar de demanda judicial para recebimento deste contrato, "
                        + "o valor final será acrescido de 20% (vinte por cento) a título de custas e honorários "
                        + "advocatícios;");
        clausulas.add(
                "Cláusula 15ª. O constituinte compromete-se a informar ao advogado constituído toda a comunicação "
                        + "por ele(a) recebida ou realizada, referente à demanda, eximindo o Contratado de qualquer "
                        + "responsabilidade ante a conduta unilateral e sem a ciência do advogado que prejudique o "
                        + "processo;");
        clausulas.add(
                "Cláusula 16ª. Neste ato, o constituinte declara que após serem digitalizados recebeu de volta todos "
                        + "os documentos apresentados para instruir a demanda, e compromete-se a mantê-los em sua "
                        + "guarda e apresentar os originais em todos os atos e audiências pertinentes ao processo;");
        return clausulas;
    }

    static String montarFecho() {
        return ContratoFechoTexto.montarFechoHonorarios(ContratoFormaAssinatura.DUAS_VIAS);
    }

    static String normalizarNomeAssinatura(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        return nome.trim().toUpperCase(Locale.ROOT);
    }
}
