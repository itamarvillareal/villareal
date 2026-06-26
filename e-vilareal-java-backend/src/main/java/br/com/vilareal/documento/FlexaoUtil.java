package br.com.vilareal.documento;

import java.util.Locale;
import java.util.Map;

/**
 * Utilitário puro de flexão de palavras por gênero (masculino/feminino) e número (singular/plural).
 *
 * <p>Resolve as marcações do legado VBA {@code Adequa(...)} (gênero + número) e
 * {@code Verifica_Plural(...)} (apenas número) usadas nos textos fixos das petições automáticas.
 *
 * <p>É um utilitário central, puro e sem acesso a banco — quem descobre o gênero/número de um polo
 * (autores/réus) e a quantidade de títulos é o <em>service</em> da petição; o {@code FlexaoUtil} só
 * recebe {@code (palavra, genero, numero)} e devolve a forma correta.
 */
public final class FlexaoUtil {

    public enum Genero {
        MASCULINO,
        FEMININO
    }

    public enum Numero {
        SINGULAR,
        PLURAL
    }

    private FlexaoUtil() {
    }

    /**
     * Dicionário explícito: lema → [masc.sing, fem.sing, masc.pl, fem.pl].
     * Tem precedência sobre as heurísticas.
     */
    private static final Map<String, String[]> DICIONARIO = Map.ofEntries(
            Map.entry("o", new String[] {"o", "a", "os", "as"}),
            Map.entry("ele", new String[] {"ele", "ela", "eles", "elas"}),
            Map.entry("do", new String[] {"do", "da", "dos", "das"}),
            Map.entry("pelo", new String[] {"pelo", "pela", "pelos", "pelas"}),
            Map.entry("ao", new String[] {"ao", "à", "aos", "às"}),
            Map.entry("no", new String[] {"no", "na", "nos", "nas"}),
            Map.entry("executado", new String[] {"executado", "executada", "executados", "executadas"}),
            Map.entry("exequente", new String[] {"exequente", "exequente", "exequentes", "exequentes"}),
            Map.entry("credor", new String[] {"credor", "credora", "credores", "credoras"}),
            Map.entry("devedor", new String[] {"devedor", "devedora", "devedores", "devedoras"}),
            Map.entry("solvente", new String[] {"solvente", "solvente", "solventes", "solventes"}),
            Map.entry("proprietário",
                    new String[] {"proprietário", "proprietária", "proprietários", "proprietárias"}),
            Map.entry("responsável",
                    new String[] {"responsável", "responsável", "responsáveis", "responsáveis"}),
            Map.entry("legítimo", new String[] {"legítimo", "legítima", "legítimos", "legítimas"}),
            Map.entry("inadimplente",
                    new String[] {"inadimplente", "inadimplente", "inadimplentes", "inadimplentes"}),
            Map.entry("compelido", new String[] {"compelido", "compelida", "compelidos", "compelidas"}),
            Map.entry("condenado", new String[] {"condenado", "condenada", "condenados", "condenadas"}),
            Map.entry("mencionado", new String[] {"mencionado", "mencionada", "mencionados", "mencionadas"}),
            Map.entry("é", new String[] {"é", "é", "são", "são"}),
            Map.entry("está", new String[] {"está", "está", "estão", "estão"}),
            Map.entry("efetuar", new String[] {"efetuar", "efetuar", "efetuarem", "efetuarem"}),
            Map.entry("endereço", new String[] {"endereço", "endereço", "endereços", "endereços"}),
            Map.entry("réu", new String[] {"réu", "ré", "réus", "rés"}),
            Map.entry("estar", new String[] {"está", "está", "estão", "estão"}),
            Map.entry("desfazer", new String[] {"desfazer", "desfazer", "desfazerem", "desfazerem"}),
            Map.entry("autor", new String[] {"autor", "autora", "autores", "autoras"}),
            Map.entry("requerido", new String[] {"requerido", "requerida", "requeridos", "requeridas"}),
            Map.entry("administrador",
                    new String[] {"administrador", "administradora", "administradores", "administradoras"}),
            Map.entry("amparado", new String[] {"amparado", "amparada", "amparados", "amparadas"}));

    /**
     * Palavras flexionadas apenas por número, fora do dicionário principal: lema → [singular, plural].
     * Usado por {@link #pluralizar(String, Numero)} (ex.: número de títulos).
     */
    private static final Map<String, String[]> DICIONARIO_PLURAL = Map.ofEntries(
            Map.entry("título", new String[] {"título", "títulos"}),
            Map.entry("executivo", new String[] {"executivo", "executivos"}),
            Map.entry("extrajudicial", new String[] {"extrajudicial", "extrajudiciais"}),
            Map.entry("encontra", new String[] {"encontra", "encontram"}),
            Map.entry("acostado", new String[] {"acostado", "acostados"}));

    /** Flexiona por gênero E número (resolve o {@code Adequa} do legado). */
    public static String adequar(String palavra, Genero genero, Numero numero) {
        if (palavra == null || palavra.isBlank()) {
            return palavra == null ? "" : palavra;
        }
        String lema = chaveLema(palavra);
        String[] formas = DICIONARIO.get(lema);
        String resultado;
        if (formas != null) {
            int idx = (genero == Genero.FEMININO ? 1 : 0) + (numero == Numero.PLURAL ? 2 : 0);
            resultado = formas[idx];
        } else {
            String comGenero = genero == Genero.FEMININO ? heuristicaFeminino(lema) : lema;
            resultado = numero == Numero.PLURAL ? heuristicaPlural(comGenero) : comGenero;
        }
        return aplicarCaixa(resultado, palavra);
    }

    /** Flexiona apenas por número (resolve o {@code Verifica_Plural} do legado). */
    public static String pluralizar(String palavra, Numero numero) {
        if (palavra == null || palavra.isBlank()) {
            return palavra == null ? "" : palavra;
        }
        String lema = chaveLema(palavra);
        String resultado;
        String[] pluralOnly = DICIONARIO_PLURAL.get(lema);
        if (pluralOnly != null) {
            resultado = numero == Numero.PLURAL ? pluralOnly[1] : pluralOnly[0];
        } else {
            String[] principal = DICIONARIO.get(lema);
            if (principal != null) {
                // Deriva das colunas masculinas do dicionário principal.
                resultado = numero == Numero.PLURAL ? principal[2] : principal[0];
            } else {
                resultado = numero == Numero.PLURAL ? heuristicaPlural(lema) : lema;
            }
        }
        return aplicarCaixa(resultado, palavra);
    }

    private static String chaveLema(String palavra) {
        return palavra.trim().toLowerCase(Locale.ROOT);
    }

    /** Heurística masculino → feminino. */
    private static String heuristicaFeminino(String palavra) {
        if (palavra.endsWith("or")) {
            return palavra.substring(0, palavra.length() - 2) + "ora";
        }
        if (palavra.endsWith("o")) {
            return palavra.substring(0, palavra.length() - 1) + "a";
        }
        return palavra;
    }

    /** Heurística singular → plural. */
    private static String heuristicaPlural(String palavra) {
        if (palavra.isEmpty()) {
            return palavra;
        }
        if (palavra.endsWith("ável") || palavra.endsWith("ível")
                || palavra.endsWith("óvel") || palavra.endsWith("uvel")) {
            // Remove o "el" final e acrescenta "eis" (responsável → responsáveis; imóvel → imóveis).
            return palavra.substring(0, palavra.length() - 2) + "eis";
        }
        if (palavra.endsWith("l")) {
            return palavra.substring(0, palavra.length() - 1) + "is";
        }
        if (palavra.endsWith("r") || palavra.endsWith("z")) {
            return palavra + "es";
        }
        if (palavra.endsWith("m")) {
            return palavra.substring(0, palavra.length() - 1) + "ns";
        }
        if (terminaEmVogal(palavra)) {
            return palavra + "s";
        }
        return palavra + "s";
    }

    private static boolean terminaEmVogal(String palavra) {
        char ultima = palavra.charAt(palavra.length() - 1);
        return "aeiouáéíóúâêôãõà".indexOf(Character.toLowerCase(ultima)) >= 0;
    }

    /** Reaplica a caixa do lema de entrada ao resultado (que vem em minúsculas). */
    private static String aplicarCaixa(String resultado, String entrada) {
        if (resultado == null || resultado.isEmpty()) {
            return resultado;
        }
        String entradaTrim = entrada.trim();
        if (entradaTrim.isEmpty()) {
            return resultado;
        }
        boolean todaMaiuscula = entradaTrim.length() > 1
                && entradaTrim.equals(entradaTrim.toUpperCase(Locale.ROOT))
                && !entradaTrim.equals(entradaTrim.toLowerCase(Locale.ROOT));
        if (todaMaiuscula) {
            // Entrada toda em caixa-alta: devolve a forma canônica (minúscula) do dicionário.
            // Quem decide a caixa final é o chamador (TopicoTokenResolver, via sufixo |CAIXA).
            return resultado;
        }
        if (Character.isUpperCase(entradaTrim.charAt(0))) {
            return Character.toUpperCase(resultado.charAt(0)) + resultado.substring(1);
        }
        return resultado;
    }
}
