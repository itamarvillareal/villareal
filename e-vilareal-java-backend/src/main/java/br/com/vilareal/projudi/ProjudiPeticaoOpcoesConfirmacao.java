package br.com.vilareal.projudi;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.springframework.util.StringUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

/**
 * Checkboxes da confirmação do peticionamento PROJUDI ({@code PaginaAtual=5}):
 * «Envolve pedido de urgência…» e «Pedido de Liberdade».
 */
public record ProjudiPeticaoOpcoesConfirmacao(boolean pedidoUrgencia, boolean pedidoLiberdade) {

    public static final ProjudiPeticaoOpcoesConfirmacao PADRAO =
            new ProjudiPeticaoOpcoesConfirmacao(false, false);

    /** Fallbacks quando o HTML não expõe rótulo legível (convenção Softplan/PROJUDI-GO). */
    static final String FALLBACK_URGENCIA = "Urgente";
    static final String FALLBACK_LIBERDADE = "PedidoLiberdade";

    public static ProjudiPeticaoOpcoesConfirmacao of(Boolean pedidoUrgencia, Boolean pedidoLiberdade) {
        return new ProjudiPeticaoOpcoesConfirmacao(
                Boolean.TRUE.equals(pedidoUrgencia), Boolean.TRUE.equals(pedidoLiberdade));
    }

    /** Qualquer petição do grupo marcada → envia o checkbox na juntada. */
    public static ProjudiPeticaoOpcoesConfirmacao deFlags(Iterable<Boolean> urgencias, Iterable<Boolean> liberdades) {
        boolean urgencia = false;
        boolean liberdade = false;
        if (urgencias != null) {
            for (Boolean v : urgencias) {
                if (Boolean.TRUE.equals(v)) {
                    urgencia = true;
                    break;
                }
            }
        }
        if (liberdades != null) {
            for (Boolean v : liberdades) {
                if (Boolean.TRUE.equals(v)) {
                    liberdade = true;
                    break;
                }
            }
        }
        return new ProjudiPeticaoOpcoesConfirmacao(urgencia, liberdade);
    }

    /**
     * Acrescenta os parâmetros dos checkboxes marcados ao corpo do POST Concluir.
     * Desmarcado = omitido (comportamento do navegador no PROJUDI).
     */
    public String aplicarNoCorpoPasso11(String corpoBase, String htmlConfirmacao) {
        if (!StringUtils.hasText(corpoBase) || (!pedidoUrgencia && !pedidoLiberdade)) {
            return corpoBase;
        }
        StringBuilder sb = new StringBuilder(corpoBase);
        if (pedidoUrgencia) {
            CheckboxResolvido urg = resolverCheckbox(htmlConfirmacao, List.of("urgencia", "tutela"), FALLBACK_URGENCIA);
            appendCheckbox(sb, urg);
        }
        if (pedidoLiberdade) {
            CheckboxResolvido lib =
                    resolverCheckbox(htmlConfirmacao, List.of("liberdade"), FALLBACK_LIBERDADE);
            appendCheckbox(sb, lib);
        }
        return sb.toString();
    }

    private static void appendCheckbox(StringBuilder sb, CheckboxResolvido checkbox) {
        if (checkbox == null || !StringUtils.hasText(checkbox.name())) {
            return;
        }
        String valor = StringUtils.hasText(checkbox.value()) ? checkbox.value() : "true";
        sb.append('&')
                .append(URLEncoder.encode(checkbox.name(), StandardCharsets.ISO_8859_1))
                .append('=')
                .append(URLEncoder.encode(valor, StandardCharsets.ISO_8859_1));
    }

    static CheckboxResolvido resolverCheckbox(String html, List<String> tokensRotulo, String fallbackName) {
        Optional<CheckboxResolvido> doHtml = localizarCheckboxPorRotulo(html, tokensRotulo);
        if (doHtml.isPresent()) {
            return doHtml.get();
        }
        Optional<CheckboxResolvido> porNome = localizarCheckboxPorNome(html, fallbackName);
        return porNome.orElse(new CheckboxResolvido(fallbackName, "true"));
    }

    static Optional<CheckboxResolvido> localizarCheckboxPorRotulo(String html, List<String> tokens) {
        if (!StringUtils.hasText(html) || tokens == null || tokens.isEmpty()) {
            return Optional.empty();
        }
        Document doc = Jsoup.parse(html);
        for (Element input : doc.select("input[type=checkbox]")) {
            String name = input.attr("name");
            if (!StringUtils.hasText(name)) {
                continue;
            }
            String rotulo = normalizar(textoAssociado(input));
            if (!contemTodos(rotulo, tokens)) {
                continue;
            }
            return Optional.of(new CheckboxResolvido(name.trim(), valorCheckbox(input)));
        }
        return Optional.empty();
    }

    static Optional<CheckboxResolvido> localizarCheckboxPorNome(String html, String nameEsperado) {
        if (!StringUtils.hasText(html) || !StringUtils.hasText(nameEsperado)) {
            return Optional.empty();
        }
        Document doc = Jsoup.parse(html);
        Element input = doc.selectFirst("input[type=checkbox][name=" + nameEsperado + "]");
        if (input == null) {
            // name case-insensitive
            for (Element el : doc.select("input[type=checkbox]")) {
                if (nameEsperado.equalsIgnoreCase(el.attr("name"))) {
                    return Optional.of(new CheckboxResolvido(el.attr("name").trim(), valorCheckbox(el)));
                }
            }
            return Optional.empty();
        }
        return Optional.of(new CheckboxResolvido(input.attr("name").trim(), valorCheckbox(input)));
    }

    private static String valorCheckbox(Element input) {
        String value = input.attr("value");
        return StringUtils.hasText(value) ? value.trim() : "true";
    }

    private static String textoAssociado(Element input) {
        String id = input.id();
        if (StringUtils.hasText(id) && input.ownerDocument() != null) {
            // CSS attribute value quoted — ids alfanuméricos do PROJUDI.
            Element label = input.ownerDocument().selectFirst("label[for=" + id + "]");
            if (label != null) {
                return label.text();
            }
        }
        Element parentLabel = input.closest("label");
        if (parentLabel != null) {
            return parentLabel.text();
        }
        // Texto imediatamente após o checkbox (nós de texto e <span>/<b>),
        // sem atravessar outro input/label (evita capturar o rótulo do vizinho).
        StringBuilder sb = new StringBuilder();
        for (org.jsoup.nodes.Node node = input.nextSibling(); node != null; node = node.nextSibling()) {
            if (node instanceof Element el) {
                if ("input".equalsIgnoreCase(el.tagName()) || "label".equalsIgnoreCase(el.tagName())
                        || "br".equalsIgnoreCase(el.tagName()) || "button".equalsIgnoreCase(el.tagName())) {
                    break;
                }
                sb.append(' ').append(el.text());
            } else {
                sb.append(' ').append(node.toString());
            }
            if (sb.length() > 240) {
                break;
            }
        }
        if (StringUtils.hasText(sb.toString())) {
            return sb.toString();
        }
        Element celula = input.closest("td, th, li");
        return celula != null ? celula.text() : "";
    }

    private static boolean contemTodos(String texto, List<String> tokens) {
        if (!StringUtils.hasText(texto)) {
            return false;
        }
        for (String token : tokens) {
            if (!texto.contains(normalizar(token))) {
                return false;
            }
        }
        return true;
    }

    private static String normalizar(String s) {
        if (s == null) {
            return "";
        }
        String nfd = Normalizer.normalize(s, Normalizer.Form.NFD);
        String semAcento = nfd.replaceAll("\\p{M}+", "");
        return semAcento.toLowerCase(Locale.ROOT).replaceAll("\\s+", " ").trim();
    }

    record CheckboxResolvido(String name, String value) {}
}
