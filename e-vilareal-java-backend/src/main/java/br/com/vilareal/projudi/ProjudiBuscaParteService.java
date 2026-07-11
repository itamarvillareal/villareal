package br.com.vilareal.projudi;

import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Busca de processos por CPF/CNPJ de parte no PROJUDI — serviço definitivo do monitoramento
 * de pessoas (promoção do spike, fatos validados em produção):
 *
 * <ul>
 *   <li>O POST vai ao MESMO path {@code BuscaProcesso} gateado pela barreira anti-ciência de
 *       {@link ProjudiSessionService} (nenhum path novo é autorizado). O checkbox "Próprios"
 *       fica desmarcado por OMISSÃO do parâmetro {@code Proprio} — ver comentário em
 *       {@code montarCorpoBuscaPorParte}.</li>
 *   <li>A lista NÃO traz CNJ completo: só o número REDUZIDO (sequencial-dv, ex.: 5432153-35)
 *       e a data de Distribuição. Ordenada por Distribuição CRESCENTE, 15 por página, sem
 *       controle de sort — os mais recentes estão na ÚLTIMA página.</li>
 *   <li>O resultado fica guardado NA SESSÃO do PROJUDI: a paginação é um GET
 *       {@code BuscaProcesso?PaginaAtual=2&Paginacao=true&PosicaoPaginaAtual=N&PassoBusca=1}
 *       sobre esse estado. Outro POST na mesma credencial SOBRESCREVE o resultado — por isso
 *       o chamador (varredura) segura o {@link ProjudiOrquestradorGate} do início ao fim.</li>
 *   <li>{@code Id_Processo} completo é token de SESSÃO; o sufixo de 12 dígitos é estável
 *       entre sessões (verificado por login duplo).</li>
 *   <li>Linhas em segredo de justiça vêm opacas ({@code tr[id^=segredojus]}): sem número,
 *       sem partes, sem link — só a serventia no texto.</li>
 * </ul>
 */
@Service
public class ProjudiBuscaParteService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiBuscaParteService.class);

    /** Últimos N dígitos do Id_Processo que são estáveis entre sessões. */
    public static final int TAMANHO_SUFIXO_ESTAVEL = 12;

    private static final Pattern PADRAO_SUBMETE = Pattern.compile("submete\\('([^']+)'\\)");
    private static final Pattern PADRAO_POSICAO = Pattern.compile("PosicaoPaginaAtual=(\\d+)");
    /** Número CNJ com ou sem pontuação (ex.: 5059346-36.2026.8.09.0007). */
    private static final Pattern PADRAO_CNJ =
            Pattern.compile("\\d{7}-?\\d{2}\\.?\\d{4}\\.?\\d\\.?\\d{2}\\.?\\d{4}");
    /** Serventia entre aspas na linha opaca de segredo de justiça. */
    private static final Pattern PADRAO_SERVENTIA_SEGREDO = Pattern.compile("\"\\s*([^\"]+?)\\s*\"");

    private static final DateTimeFormatter DATA_HORA = DateTimeFormatter.ofPattern("dd/MM/yyyy HH:mm:ss");
    private static final DateTimeFormatter DATA = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final ProjudiSessionService sessionService;

    public ProjudiBuscaParteService(ProjudiSessionService sessionService) {
        this.sessionService = sessionService;
    }

    // ------------------------------------------------------------------
    // Modelo
    // ------------------------------------------------------------------

    /**
     * Linha da lista de resultados. Para linhas de segredo de justiça só
     * {@code segredo=true} e {@code serventiaSegredo} são preenchidos.
     */
    public record LinhaLista(
            String numeroReduzido,
            LocalDateTime dataDistribuicao,
            /** Token de navegação — VÁLIDO SÓ NA SESSÃO ATUAL. Nunca persistir como chave. */
            String idProcessoToken,
            /** Últimos 12 dígitos do token — estáveis entre sessões (gravado para estudo). */
            String idProcessoSufixo,
            List<String> partesAtivo,
            List<String> partesPassivo,
            boolean segredo,
            String serventiaSegredo) {}

    public record PaginaLista(
            List<LinhaLista> linhas,
            /** Posição da última página, extraída do link "Última" (0 = página única). */
            int posicaoUltimaPagina) {}

    public record DetalheProcesso(String numeroCnj, String classe, String serventia) {}

    // ------------------------------------------------------------------
    // Navegação (todas as chamadas exigem posse do ProjudiOrquestradorGate pelo chamador)
    // ------------------------------------------------------------------

    /**
     * POST da busca por CPF/CNPJ (página inicial do resultado, posição 0). Estabelece o
     * resultado NA SESSÃO — as chamadas de {@link #paginaEm} navegam sobre ele.
     */
    public PaginaLista primeiraPagina(Long credencialId, String cpfCnpj) {
        String digitos = cpfCnpj == null ? "" : cpfCnpj.replaceAll("\\D", "");
        ProjudiSessionService.RespostaProjudi resp =
                sessionService.buscarProcessosPorCpfCnpjParte(credencialId, digitos);
        return parsePagina(resp.body(), "POST busca por parte (cpfCnpj=***" + sufixoDoc(digitos) + ")");
    }

    /**
     * GET read-only de paginação sobre o resultado guardado na sessão (estabelecido pelo
     * {@link #primeiraPagina} imediatamente antes, na mesma posse do gate).
     */
    public PaginaLista paginaEm(Long credencialId, int posicao) {
        String caminho = "BuscaProcesso?PaginaAtual=2&Paginacao=true&PosicaoPaginaAtual="
                + posicao + "&PassoBusca=1";
        ProjudiSessionService.RespostaProjudi resp = sessionService.getAutenticado(credencialId, caminho);
        return parsePagina(resp.body(), "GET paginação posicao=" + posicao);
    }

    /**
     * Abre o DETALHE de um processo via GET {@code BuscaProcesso?Id_Processo=token} — mesmo
     * mecanismo do clique na linha (função {@code submete}) e das capturas do peticionamento.
     * Read-only; já verificado que abrir o detalhe NÃO registra ciência (a ciência exige ação
     * explícita em painel próprio). O token deve ter sido colhido NA MESMA SESSÃO.
     *
     * <p><b>Atenção:</b> este GET pode substituir o estado de busca da sessão — chamar só
     * DEPOIS de terminar a paginação da lista.</p>
     */
    public DetalheProcesso abrirDetalhe(Long credencialId, String idProcessoToken) {
        ProjudiSessionService.RespostaProjudi resp =
                sessionService.getAutenticado(credencialId, "BuscaProcesso?Id_Processo=" + idProcessoToken);
        Document doc = Jsoup.parse(resp.body() == null ? "" : resp.body());

        String numeroCnj = null;
        Element spanNumero = doc.selectFirst("span#span_proc_numero");
        if (spanNumero != null) {
            Matcher m = PADRAO_CNJ.matcher(spanNumero.text());
            numeroCnj = m.find() ? m.group() : spanNumero.text().trim();
        } else {
            Matcher m = PADRAO_CNJ.matcher(doc.text());
            numeroCnj = m.find() ? m.group() : null;
        }
        String classe = valorAposRotulo(doc, "Classe");
        String serventia = valorAposRotulo(doc, "Serventia");
        if (numeroCnj == null) {
            log.warn("Detalhe PROJUDI sem CNJ identificável (token …{}).", sufixoEstavel(idProcessoToken));
        }
        return new DetalheProcesso(numeroCnj, classe, serventia);
    }

    // ------------------------------------------------------------------
    // Parse
    // ------------------------------------------------------------------

    /**
     * Estrutura real (validada no spike): {@code table#Tabela} com cabeçalhos em
     * {@code thead td} (vazio | checkbox | Número | Partes | Distribuição | Selecionar) e
     * linhas em {@code tbody#tabListaProcesso}. Falha ALTO em estrutura desconhecida — uma
     * página vazia silenciosa faria a varredura concluir "nenhum processo" e corromper o
     * estado (ex.: baseline vazia).
     */
    static PaginaLista parsePagina(String html, String contexto) {
        Document doc = Jsoup.parse(html == null ? "" : html);
        Element tbody = doc.selectFirst("table#Tabela tbody#tabListaProcesso");
        if (tbody == null) {
            if (pareceSemResultado(doc)) {
                return new PaginaLista(List.of(), 0);
            }
            throw new ProjudiEstruturaInesperadaException(
                    "Resposta do PROJUDI sem a lista esperada (table#Tabela/tabListaProcesso) — " + contexto);
        }

        Element tabela = doc.selectFirst("table#Tabela");
        List<String> cabecalhos = new ArrayList<>();
        Element theadTr = tabela.selectFirst("thead tr");
        if (theadTr != null) {
            for (Element td : theadTr.select("> td")) {
                cabecalhos.add(td.text().trim());
            }
        }

        List<LinhaLista> linhas = new ArrayList<>();
        for (Element tr : tbody.select("> tr")) {
            if (tr.id() != null && tr.id().startsWith("segredojus")) {
                linhas.add(parseLinhaSegredo(tr));
                continue;
            }
            Elements tds = tr.select("> td");
            if (tds.isEmpty()) {
                continue;
            }
            linhas.add(parseLinhaNormal(cabecalhos, tds, tr));
        }
        return new PaginaLista(linhas, extrairPosicaoUltimaPagina(doc));
    }

    /**
     * Linha opaca: {@code <tr id="segredojus...."><td colspan=6>Processo em segredo de
     * justiça... Serventia <b> "Nome da Serventia" </b>...</td></tr>}. Sem número, sem
     * partes, sem link — só a serventia identifica algo.
     */
    private static LinhaLista parseLinhaSegredo(Element tr) {
        String serventia = null;
        Element b = tr.selectFirst("b");
        if (b != null) {
            Matcher m = PADRAO_SERVENTIA_SEGREDO.matcher(b.text());
            serventia = m.find() ? m.group(1).trim() : b.text().replace("\"", "").trim();
        }
        return new LinhaLista(null, null, null, null, List.of(), List.of(), true, serventia);
    }

    private static LinhaLista parseLinhaNormal(List<String> cabecalhos, Elements tds, Element tr) {
        String numeroReduzido = textoDaColuna(cabecalhos, tds, "Número");

        LocalDateTime dataDistribuicao = parseDataDistribuicao(textoDaColuna(cabecalhos, tds, "Distribuição"));

        List<String> partesAtivo = new ArrayList<>();
        List<String> partesPassivo = new ArrayList<>();
        Element celPartes = celulaPorCabecalho(cabecalhos, tds, "Partes");
        if (celPartes != null) {
            for (Element grupo : celPartes.select("div.coluna100")) {
                Element rotulo = grupo.selectFirst("b");
                Element valor = grupo.selectFirst("div.coluna80");
                if (rotulo == null || valor == null) {
                    continue;
                }
                String r = rotulo.text().trim().toLowerCase(Locale.ROOT);
                String nome = valor.text().trim();
                if (nome.isBlank()) {
                    continue;
                }
                if (r.contains("ativo")) {
                    partesAtivo.add(nome);
                } else if (r.contains("passivo")) {
                    partesPassivo.add(nome);
                }
            }
        }

        String token = null;
        Matcher ms = PADRAO_SUBMETE.matcher(tr.attr("onclick"));
        if (ms.find()) {
            token = ms.group(1);
        } else {
            Element chk = tr.selectFirst("input[name=processos][value]");
            if (chk != null && !chk.attr("value").isBlank()) {
                token = chk.attr("value").trim();
            }
        }

        return new LinhaLista(
                numeroReduzido,
                dataDistribuicao,
                token,
                sufixoEstavel(token),
                partesAtivo,
                partesPassivo,
                false,
                null);
    }

    private static String textoDaColuna(List<String> cabecalhos, Elements tds, String nome) {
        Element cel = celulaPorCabecalho(cabecalhos, tds, nome);
        String texto = cel == null ? null : cel.text().trim();
        return texto == null || texto.isBlank() ? null : texto;
    }

    private static Element celulaPorCabecalho(List<String> cabecalhos, Elements tds, String nome) {
        for (int i = 0; i < cabecalhos.size() && i < tds.size(); i++) {
            if (cabecalhos.get(i).equalsIgnoreCase(nome)) {
                return tds.get(i);
            }
        }
        return null;
    }

    static LocalDateTime parseDataDistribuicao(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        String t = texto.trim();
        try {
            return LocalDateTime.parse(t, DATA_HORA);
        } catch (Exception ignored) {
            // sem hora
        }
        try {
            return java.time.LocalDate.parse(t, DATA).atStartOfDay();
        } catch (Exception e) {
            log.warn("Data de distribuição PROJUDI em formato inesperado: '{}'.", t);
            return null;
        }
    }

    /** Últimos 12 dígitos do token de sessão — a parte estável entre sessões. */
    static String sufixoEstavel(String idProcessoToken) {
        if (idProcessoToken == null || idProcessoToken.length() < TAMANHO_SUFIXO_ESTAVEL) {
            return null;
        }
        return idProcessoToken.substring(idProcessoToken.length() - TAMANHO_SUFIXO_ESTAVEL);
    }

    /**
     * Posição da última página, do href do link "Última". Numa página única o link aponta
     * para 0; sem link nenhum, assume 0.
     */
    private static int extrairPosicaoUltimaPagina(Document doc) {
        for (Element a : doc.select("a[href*=Paginacao=true]")) {
            if (!a.text().trim().equalsIgnoreCase("Última")) {
                continue;
            }
            Matcher m = PADRAO_POSICAO.matcher(a.attr("href"));
            if (m.find()) {
                return Integer.parseInt(m.group(1));
            }
        }
        return 0;
    }

    private static boolean pareceSemResultado(Document doc) {
        String texto = doc.text().toLowerCase(Locale.ROOT);
        return texto.contains("nenhum registro")
                || texto.contains("nenhum processo")
                || texto.contains("não foi encontrado")
                || texto.contains("nao foi encontrado")
                || texto.contains("não foram encontrados")
                || texto.contains("nao foram encontrados");
    }

    /** Valor do {@code <span>} imediatamente após um {@code <div>rotulo</div>} do detalhe. */
    private static String valorAposRotulo(Document doc, String rotulo) {
        for (Element div : doc.select("div")) {
            if (!div.text().trim().equalsIgnoreCase(rotulo)) {
                continue;
            }
            Element span = div.nextElementSibling();
            while (span != null && !span.tagName().equals("span")) {
                span = span.nextElementSibling();
            }
            if (span != null && !span.text().isBlank()) {
                return span.text().trim();
            }
        }
        return null;
    }

    private static String sufixoDoc(String digitos) {
        return digitos == null || digitos.length() < 4 ? "?" : digitos.substring(digitos.length() - 4);
    }
}
