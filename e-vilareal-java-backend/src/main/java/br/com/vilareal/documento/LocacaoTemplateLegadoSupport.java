package br.com.vilareal.documento;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Pré-processamento dos modelos legados de contrato de locação (Access/VBA): campos {@code Campo("@")}
 * ou {@code Campo} soltos, {@code Formatar_Texto}, {@code Verifica_Plural}, marcadores {@code +++…/\}
 * e parênteses vazios de formatação.
 */
public final class LocacaoTemplateLegadoSupport {

    private static final ObjectMapper OBJECT_MAPPER = new ObjectMapper();

    private static final Pattern CAMPO_AT = Pattern.compile("[A-Za-zÀ-ÿ][A-Za-z0-9_À-ÿ]*\\(\"@\"\\)");
    private static final Pattern PARENS_VAZIOS = Pattern.compile("\\(\\s*\\)");
    private static final Pattern MARCADOR_PLUS = Pattern.compile("\\+\\+\\+(.+?)/\\s*\\\\?,?");
    private static final Pattern MARCADOR_PLUS_SIMPLES = Pattern.compile("\\+\\+\\+([^+/]+)/\\s*\\\\?,?");
    private static final Pattern RAMO_OPCIONAL =
            Pattern.compile("\\(\\)\\(\"[^\"]*\\+\\+\\+[^\"]*\"\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern BLOCO_OPCIONAL_TEXTO = Pattern.compile(
            "\\(\"[^\"]*\\bresponsabilidade\\b[^\"]*\"\\)", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern FORMATAR_TEXTO =
            Pattern.compile("Formatar_Texto\\s*\\(\\s*([^,()]+(?:\\([^)]*\\)[^,()]*)*)\\s*,\\s*\"([^\"]*)\"\\s*\\)", Pattern.CASE_INSENSITIVE);
    private static final Pattern VERIFICA_PLURAL = Pattern.compile(
            "(?:Lcase|Ucase|Propercase)?\\s*\\(\\s*[Vv]erifica_[Pp]lural\\s*\\(\\s*\"@\"\\s*,\\s*([^,]+)\\s*,\\s*\"([^\"]*)\"\\s*\\)\\s*\\)|[Vv]erifica_[Pp]lural\\s*\\(\\s*\"@\"\\s*,\\s*([^,]+)\\s*,\\s*\"([^\"]*)\"\\s*\\)",
            Pattern.CASE_INSENSITIVE);
    private static final Pattern EXTENSO_REAIS =
            Pattern.compile("Extensoreais\\s*\\(\\s*([^)\"]+)\\s*\\)", Pattern.CASE_INSENSITIVE);

    private LocacaoTemplateLegadoSupport() {}

    /** Monta mapa de campos legados (várias grafias) a partir do contrato e do imóvel. */
    public static Map<String, String> montarCamposLegacy(ContratoLocacaoEntity contrato, LocalDate dataDocumento) {
        Map<String, String> campos = new HashMap<>();
        if (contrato == null) {
            return campos;
        }
        ImovelEntity im = contrato.getImovel();
        LocalDate dataInicio = contrato.getDataInicio();
        LocalDate dataFim = contrato.getDataFim();

        registrar(campos, "Data_Inicio_Aluguel", dataInicio != null ? dataInicio.toString() : "");
        registrar(campos, "Data_Fim_Aluguel", dataFim != null ? dataFim.toString() : "");
        registrar(campos, "Data_Pag_1_Tx_Cond", dataInicio != null ? dataInicio.toString() : "");
        registrar(campos, "data", dataDocumento != null ? dataDocumento.toString() : LocalDate.now().toString());

        if (contrato.getValorAluguel() != null) {
            String br = MoedaBrParser.formatDecimalBr(contrato.getValorAluguel());
            registrar(campos, "Valor_Aluguel_Imovel", br);
            registrar(campos, "valorAluguel", br);
        }
        if (contrato.getDiaVencimentoAluguel() != null) {
            registrar(campos, "Dia_Pagamento_Aluguel", String.valueOf(contrato.getDiaVencimentoAluguel()));
            registrar(campos, "diaVencimentoAluguel", String.valueOf(contrato.getDiaVencimentoAluguel()));
        }
        if (StringUtils.hasText(contrato.getFormaPagamentoAluguel())) {
            registrar(campos, "Forma_Pagamento_Aluguel", FormaPagamentoAluguelLocacao.normalizar(contrato.getFormaPagamentoAluguel()));
            registrar(campos, "formaPagamentoAluguel", FormaPagamentoAluguelLocacao.normalizar(contrato.getFormaPagamentoAluguel()));
        }
        if (contrato.getValorGarantia() != null) {
            registrar(campos, "valorGarantia", formatarMoedaBr(contrato.getValorGarantia()));
        }
        if (StringUtils.hasText(contrato.getGarantiaTipo())) {
            registrar(campos, "garantiaTipo", contrato.getGarantiaTipo().trim());
        }

        if (im != null) {
            registrar(campos, "Endereco_Imovel", nvl(im.getEnderecoCompleto()));
            registrar(campos, "endereco", nvl(im.getEnderecoCompleto()));
            registrar(campos, "Unidade_Imovel", nvl(im.getUnidade()));
            registrar(campos, "unidade", nvl(im.getUnidade()));
            registrar(campos, "Condominio_Imovel", nvl(im.getCondominio()));
            registrar(campos, "condominio", nvl(im.getCondominio()));
            registrar(campos, "Quantidade_Garagens_Imovel", nvl(im.getGaragens()));
            registrar(campos, "quantidade_garagens_imovel", nvl(im.getGaragens()));
            registrar(campos, "garagens", nvl(im.getGaragens()));
            registrar(campos, "Inscricao_Imobiliaria_Imovel", nvl(im.getInscricaoImobiliaria()));
            registrar(campos, "Inscrição_Imobiliária_Imovel", nvl(im.getInscricaoImobiliaria()));
            registrar(campos, "Inscriçao_Imobiliária_Imovel", nvl(im.getInscricaoImobiliaria()));
            registrar(campos, "inscricaoImobiliaria", nvl(im.getInscricaoImobiliaria()));

            JsonNode extras = parseExtrasJson(im.getCamposExtrasJson());
            String saneago = textoExtra(extras, "aguaNumero", "saneagoMatricula");
            String energia = textoExtra(extras, "energiaNumero", "energiaMatricula");
            String gas = textoExtra(extras, "gasNumero", "gasMatricula");
            String linkVistoria = textoExtra(extras, "linkVistoria");

            registrar(campos, "Link_Vistoria", linkVistoria);
            registrar(campos, "linkVistoria", linkVistoria);
            registrar(campos, "Saneago_Imovel", saneago);
            registrar(campos, "Energia_Imovel", energia);
            registrar(campos, "Gas_Imovel", gas);
            registrar(campos, "aguaNumero", saneago);
            registrar(campos, "energiaNumero", energia);
            registrar(campos, "gasNumero", gas);
        } else {
            registrar(campos, "Link_Vistoria", "");
            registrar(campos, "Saneago_Imovel", "");
            registrar(campos, "Energia_Imovel", "");
            registrar(campos, "Gas_Imovel", "");
        }

        registrar(campos, "Class_do_Processo", "");
        return campos;
    }

    /** Lê {@code linkVistoria} de {@code camposExtrasJson} do imóvel. */
    public static String extrairLinkVistoriaImovel(ImovelEntity imovel) {
        if (imovel == null) {
            return "";
        }
        JsonNode extras = parseExtrasJson(imovel.getCamposExtrasJson());
        return textoExtra(extras, "linkVistoria");
    }

    public static void registrarAliasesLegado(Map<String, String> params, ContratoLocacaoEntity contrato, LocalDate data) {
        if (params == null) {
            return;
        }
        for (Map.Entry<String, String> e : montarCamposLegacy(contrato, data).entrySet()) {
            params.putIfAbsent(e.getKey(), e.getValue());
        }
    }

    /** Atualiza campos de vigência/prazo da locação nos parâmetros do template legado. */
    public static void aplicarVigenciaLocacao(Map<String, String> params, LocalDate dataInicio, LocalDate dataFim) {
        if (params == null) {
            return;
        }
        if (dataInicio != null) {
            String iso = dataInicio.toString();
            registrar(params, "Data_Inicio_Aluguel", iso);
            params.put("dataInicio", iso);
        }
        if (dataFim != null) {
            String iso = dataFim.toString();
            registrar(params, "Data_Fim_Aluguel", iso);
            params.put("dataFim", iso);
        } else {
            registrar(params, "Data_Fim_Aluguel", "");
            params.put("dataFim", "");
        }
    }

    /** Atualiza campos de valor do aluguel nos parâmetros do template legado. */
    public static void aplicarValorLocacao(Map<String, String> params, java.math.BigDecimal valorAluguel) {
        if (params == null || valorAluguel == null) {
            return;
        }
        String br = MoedaBrParser.formatDecimalBr(valorAluguel);
        registrar(params, "Valor_Aluguel_Imovel", br);
        params.put("valorAluguel", br);
        params.put("valorCausa", br);
    }

    /** Atualiza o link da vistoria (Cláusula 7ª, § único). */
    public static void aplicarLinkVistoria(Map<String, String> params, String linkVistoria) {
        if (params == null || !StringUtils.hasText(linkVistoria)) {
            return;
        }
        String link = linkVistoria.trim();
        registrar(params, "Link_Vistoria", link);
        params.put("linkVistoria", link);
    }

    /** Atualiza o dia de vencimento do aluguel (Cláusula 3ª). */
    public static void aplicarDiaVencimento(Map<String, String> params, Integer diaVencimento) {
        if (params == null || diaVencimento == null || diaVencimento < 1) {
            return;
        }
        String dia = String.valueOf(diaVencimento);
        registrar(params, "Dia_Pagamento_Aluguel", dia);
        params.put("diaVencimentoAluguel", dia);
    }

    /** Atualiza a forma de pagamento do aluguel (Cláusula 3ª). */
    public static void aplicarFormaPagamentoAluguel(Map<String, String> params, String formaPagamentoAluguel) {
        if (params == null) {
            return;
        }
        String forma = FormaPagamentoAluguelLocacao.normalizar(formaPagamentoAluguel);
        registrar(params, "Forma_Pagamento_Aluguel", forma);
        params.put("formaPagamentoAluguel", forma);
    }

    /**
     * Escolhe o ramo da Cláusula 3ª entre depósito/TED e boletos.
     * O template legado concatena as duas redações separadas por {@code ;;}.
     */
    public static String resolverRamoFormaPagamentoAluguel(String template, Map<String, String> campos) {
        if (!StringUtils.hasText(template) || !template.contains(";;")) {
            return template != null ? template : "";
        }
        String lower = template.toLowerCase(Locale.ROOT);
        if (!lower.contains("mediante depósito") && !lower.contains("mediante boletos")) {
            return template;
        }
        String[] parts = template.split(";;", 2);
        if (parts.length < 2) {
            return template;
        }
        String forma = FormaPagamentoAluguelLocacao.normalizar(resolverCampo("formaPagamentoAluguel", campos));
        if (FormaPagamentoAluguelLocacao.isBoleto(forma)) {
            String antes = parts[0].trim();
            String depois = parts[1].trim();
            int idx = indexOfIgnoreCase(antes, ", mediante depósito");
            if (idx < 0) {
                idx = indexOfIgnoreCase(antes, "mediante depósito");
            }
            String prefix = idx >= 0 ? antes.substring(0, idx).trim() : antes;
            if (depois.regionMatches(true, 0, "do mês vigente de locação,", 0, 26)) {
                depois = depois.substring(26).trim();
            }
            if (!depois.regionMatches(true, 0, "mediante", 0, 8)) {
                depois = "mediante " + depois;
            }
            return prefix + ", " + depois;
        }
        return parts[0].trim();
    }

    /** Pré-processa template legado de locação antes das substituições de Nome/Adequa/etc. */
    public static String preprocessar(String template, Map<String, String> campos) {
        if (!StringUtils.hasText(template)) {
            return template != null ? template : "";
        }
        Map<String, String> mapa = campos != null ? campos : Map.of();
        String t = normalizarAspas(template);

        t = resolverRamoFormaPagamentoAluguel(t, mapa);
        t = limparArtefatosLegado(t);
        t = substituirCamposAt(t, mapa);

        t = processarFormatarTexto(t, mapa);
        t = processarVerificaPlural(t, mapa);
        t = processarExtensoreais(t, mapa);
        t = substituirCamposBare(t, mapa);

        return t;
    }

    /** Corrige artefatos conhecidos do legado Access/VBA após flexão e caixa. */
    public static String corrigirArtefatosTextoLocacao(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        return texto
                .replaceAll(",\\s*,\\s*", ", ")
                .replaceAll("\\s+,", ",")
                .replaceAll(",\\s{2,}", ", ")
                .replaceAll(";{2,}", ";")
                .replaceAll("\\bOS (Locatários|Locatárias)\\b", "Os $1")
                .replaceAll("(?i)Propercase\\(\\s*S\\s*\\)\\s*ublocar", "Sublocar")
                .replaceAll("(?i)\\bS ublocar\\b", "Sublocar");
    }

    /** Remove parênteses vazios, ramos opcionais legados e marcadores {@code +++}. */
    public static String limparArtefatosLegado(String texto) {
        if (!StringUtils.hasText(texto)) {
            return texto != null ? texto : "";
        }
        String t = texto;
        t = RAMO_OPCIONAL.matcher(t).replaceAll("");
        t = BLOCO_OPCIONAL_TEXTO.matcher(t).replaceAll("");
        for (int i = 0; i < 8 && PARENS_VAZIOS.matcher(t).find(); i++) {
            t = PARENS_VAZIOS.matcher(t).replaceAll("");
        }
        t = MARCADOR_PLUS.matcher(t).replaceAll("$1");
        t = MARCADOR_PLUS_SIMPLES.matcher(t).replaceAll("$1");
        return t;
    }

    private static String normalizarAspas(String texto) {
        return texto
                .replace('\u201c', '"')
                .replace('\u201d', '"')
                .replace('\u2018', '\'')
                .replace('\u2019', '\'');
    }

    private static String substituirCamposAt(String texto, Map<String, String> campos) {
        Matcher m = CAMPO_AT.matcher(texto);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String token = m.group();
            String nome = token.substring(0, token.indexOf('('));
            String valor = resolverCampo(nome, campos);
            m.appendReplacement(sb, Matcher.quoteReplacement(valor));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String substituirCamposBare(String texto, Map<String, String> campos) {
        List<String> nomes = new ArrayList<>();
        for (String nome : campos.keySet()) {
            if (StringUtils.hasText(nome) && nome.matches("[A-Za-zÀ-ÿ][A-Za-z0-9_À-ÿ]*")) {
                nomes.add(nome);
            }
        }
        nomes.sort(Comparator.comparingInt(String::length).reversed());
        String t = texto;
        for (String nome : nomes) {
            String valor = campos.get(nome);
            if (valor == null) {
                continue;
            }
            Pattern p = Pattern.compile("\\b" + Pattern.quote(nome) + "\\b", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
            t = p.matcher(t).replaceAll(Matcher.quoteReplacement(valor));
        }
        return t;
    }

    private static String processarFormatarTexto(String texto, Map<String, String> campos) {
        Matcher m = FORMATAR_TEXTO.matcher(texto);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String arg = m.group(1).trim();
            String fmt = m.group(2);
            String raw = valorLiteralOuCampo(arg, campos);
            m.appendReplacement(sb, Matcher.quoteReplacement(aplicarFormato(raw, fmt)));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String processarVerificaPlural(String texto, Map<String, String> campos) {
        Matcher m = VERIFICA_PLURAL.matcher(texto);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String arg = m.group(1) != null ? m.group(1).trim() : m.group(3).trim();
            String palavra = m.group(2) != null ? m.group(2) : m.group(4);
            String raw = valorLiteralOuCampo(arg, campos);
            int n = parseInteiro(raw);
            FlexaoUtil.Numero numero = n == 1 ? FlexaoUtil.Numero.SINGULAR : FlexaoUtil.Numero.PLURAL;
            String flexionada = FlexaoUtil.pluralizar(palavra, numero);
            m.appendReplacement(sb, Matcher.quoteReplacement(flexionada));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String processarExtensoreais(String texto, Map<String, String> campos) {
        Matcher m = EXTENSO_REAIS.matcher(texto);
        StringBuffer sb = new StringBuffer();
        while (m.find()) {
            String arg = m.group(1).trim();
            String raw = valorLiteralOuCampo(arg, campos);
            m.appendReplacement(sb, Matcher.quoteReplacement(valorPorExtenso(raw)));
        }
        m.appendTail(sb);
        return sb.toString();
    }

    private static String valorLiteralOuCampo(String arg, Map<String, String> campos) {
        String t = arg.trim();
        if (t.startsWith("\"") && t.endsWith("\"")) {
            return t.substring(1, t.length() - 1);
        }
        String resolvido = resolverCampo(t, campos);
        if (StringUtils.hasText(resolvido)) {
            return resolvido;
        }
        if (t.contains("(\"@\")")) {
            return "";
        }
        return t;
    }

    private static String resolverCampo(String nome, Map<String, String> campos) {
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        String direto = campos.get(nome);
        if (StringUtils.hasText(direto)) {
            return direto;
        }
        for (Map.Entry<String, String> e : campos.entrySet()) {
            if (chaveNormalizada(e.getKey()).equals(chaveNormalizada(nome))) {
                return nvl(e.getValue());
            }
        }
        return "";
    }

    private static String aplicarFormato(String raw, String fmt) {
        if (!StringUtils.hasText(fmt)) {
            return raw;
        }
        String f = fmt.trim();
        if ("R$".equals(f)) {
            return formatarMoedaBr(parseDecimal(raw));
        }
        if ("00".equals(f)) {
            int n = parseInteiro(raw);
            return String.format(Locale.ROOT, "%02d", Math.max(0, n));
        }
        if (f.contains("dd") && f.contains("aaaa")) {
            return dataPorExtenso(raw);
        }
        return raw;
    }

    private static String dataPorExtenso(String raw) {
        LocalDate data;
        try {
            data = LocalDate.parse(raw.trim());
        } catch (Exception e) {
            return raw;
        }
        DateTimeFormatter fmt = DateTimeFormatter.ofPattern("d 'de' MMMM 'de' yyyy", Locale.forLanguageTag("pt-BR"));
        return data.format(fmt);
    }

    private static String valorPorExtenso(String raw) {
        try {
            BigDecimal valor = MoedaBrParser.parseValorMonetario(raw);
            return ValorExtensoUtil.reaisPorExtenso(valor.setScale(2, RoundingMode.HALF_UP));
        } catch (Exception e) {
            return raw;
        }
    }

    static BigDecimal parseDecimal(String raw) {
        return MoedaBrParser.parseValorMonetario(raw);
    }

    private static int parseInteiro(String raw) {
        if (!StringUtils.hasText(raw)) {
            return 0;
        }
        try {
            return (int) Math.round(parseDecimal(raw).doubleValue());
        } catch (Exception e) {
            return 0;
        }
    }

    private static String formatarMoedaBr(BigDecimal valor) {
        if (valor == null) {
            return "";
        }
        return java.text.NumberFormat.getCurrencyInstance(Locale.forLanguageTag("pt-BR")).format(valor);
    }

    private static String extensoReais(BigDecimal valor) {
        long reais = valor.longValue();
        int centavos = valor.remainder(BigDecimal.ONE).movePointRight(2).intValue();
        StringBuilder sb = new StringBuilder();
        if (reais > 0) {
            sb.append(numeroPorExtenso(reais)).append(reais == 1 ? " real" : " reais");
        }
        if (centavos > 0) {
            if (!sb.isEmpty()) {
                sb.append(" e ");
            }
            sb.append(numeroPorExtenso(centavos)).append(centavos == 1 ? " centavo" : " centavos");
        }
        if (sb.isEmpty()) {
            return "zero reais";
        }
        return sb.toString();
    }

    private static String numeroPorExtenso(long n) {
        if (n == 0) {
            return "zero";
        }
        if (n < 0 || n > 999_999_999) {
            return Long.toString(n);
        }
        String[] unidades = {
            "", "um", "dois", "três", "quatro", "cinco", "seis", "sete", "oito", "nove", "dez",
            "onze", "doze", "treze", "quatorze", "quinze", "dezesseis", "dezessete", "dezoito", "dezenove"
        };
        String[] dezenas = {"", "", "vinte", "trinta", "quarenta", "cinquenta", "sessenta", "setenta", "oitenta", "noventa"};
        String[] centenas = {"", "cento", "duzentos", "trezentos", "quatrocentos", "quinhentos", "seiscentos", "setecentos", "oitocentos", "novecentos"};

        List<String> partes = new ArrayList<>();
        long milhao = n / 1_000_000;
        long restoMilhao = n % 1_000_000;
        long mil = restoMilhao / 1_000;
        long resto = restoMilhao % 1_000;

        if (milhao > 0) {
            partes.add(milhao == 1 ? "um milhão" : numeroPorExtenso(milhao) + " milhões");
        }
        if (mil > 0) {
            partes.add(mil == 1 ? "mil" : numeroPorExtenso(mil) + " mil");
        }
        if (resto > 0) {
            if (resto < 20) {
                partes.add(unidades[(int) resto]);
            } else if (resto == 100) {
                partes.add("cem");
            } else if (resto >= 100) {
                partes.add(centenas[(int) (resto / 100)] + (resto % 100 > 0 ? " e " + numeroPorExtenso(resto % 100) : ""));
            } else {
                int d = (int) (resto / 10);
                int u = (int) (resto % 10);
                partes.add(dezenas[d] + (u > 0 ? " e " + unidades[u] : ""));
            }
        }
        return String.join(" e ", partes);
    }

    private static void registrar(Map<String, String> campos, String chave, String valor) {
        if (!StringUtils.hasText(chave)) {
            return;
        }
        campos.put(chave, valor != null ? valor : "");
        campos.putIfAbsent(chaveNormalizada(chave), valor != null ? valor : "");
    }

    private static String chaveNormalizada(String s) {
        return Normalizer.normalize(String.valueOf(s), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase(Locale.ROOT);
    }

    private static int indexOfIgnoreCase(String texto, String trecho) {
        if (!StringUtils.hasText(texto) || !StringUtils.hasText(trecho)) {
            return -1;
        }
        return texto.toLowerCase(Locale.ROOT).indexOf(trecho.toLowerCase(Locale.ROOT));
    }

    private static String nvl(String s) {
        return s != null ? s.trim() : "";
    }

    private static JsonNode parseExtrasJson(String json) {
        if (!StringUtils.hasText(json)) {
            return OBJECT_MAPPER.createObjectNode();
        }
        try {
            return OBJECT_MAPPER.readTree(json);
        } catch (Exception e) {
            return OBJECT_MAPPER.createObjectNode();
        }
    }

    private static String textoExtra(JsonNode extras, String... campos) {
        if (extras == null || campos == null) {
            return "";
        }
        for (String campo : campos) {
            if (!StringUtils.hasText(campo) || !extras.has(campo) || extras.get(campo).isNull()) {
                continue;
            }
            String t = extras.get(campo).asText("").trim();
            if (StringUtils.hasText(t)) {
                return t;
            }
        }
        return "";
    }
}
