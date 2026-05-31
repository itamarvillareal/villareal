package br.com.vilareal.projudi;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Leitura do teor de processos no PROJUDI-GO: lista as movimentações e baixa os
 * documentos (bytes) na mesma sessão que gerou os autos.
 *
 * <p><b>SOMENTE LEITURA/CONSULTA:</b> usa apenas os acessos GET e a consulta de
 * busca do {@link ProjudiSessionService}. Nunca acessa painel de intimações
 * pendentes nem qualquer ação de ciência/peticionamento.</p>
 *
 * <p><b>Sessão:</b> o token {@code Id_Movimentacao} e os {@code id}/{@code hash}
 * da listagem só valem na mesma sessão da busca; listar+baixar deve ocorrer
 * juntos — não persistir esses tokens para uso posterior.</p>
 */
@Service
public class ProjudiTeorService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiTeorService.class);

    /** Extrai o Id_Movimentacao (token de sessão) de buscarArquivosMovimentacaoJSON('...'). */
    private static final Pattern PADRAO_ID_MOVIMENTACAO =
            Pattern.compile("buscarArquivosMovimentacaoJSON\\('([^']+)'");

    private final ProjudiSessionService sessionService;
    private final ObjectMapper objectMapper;

    public ProjudiTeorService(ProjudiSessionService sessionService, ObjectMapper objectMapper) {
        this.sessionService = sessionService;
        this.objectMapper = objectMapper;
    }

    /**
     * Lista as movimentações do processo. A tabela (table#TabelaArquivos) vem na própria
     * RESPOSTA do POST de busca; por isso parseamos o corpo de
     * {@link ProjudiSessionService#buscarProcessoConsulta} diretamente (a página
     * "BuscaProcesso?PaginaAtual=4" é só o formulário de busca, sem movimentações).
     */
    public List<MovimentacaoProjudi> listarMovimentacoes(Long credencialId, String numeroProcesso) {
        String html = sessionService.buscarProcessoConsulta(credencialId, numeroProcesso).body();

        Document doc = Jsoup.parse(html);
        if (doc.selectFirst("table#TabelaArquivos") == null) {
            log.warn("Tabela de movimentações (table#TabelaArquivos) não encontrada (processo={}). Corpo (300): {}",
                    numeroProcesso, html == null ? "" : html.substring(0, Math.min(html.length(), 300)));
        }
        Elements linhas = doc.select("table#TabelaArquivos tbody#tabListaProcesso > tr[movi_codigo]");

        List<MovimentacaoProjudi> movimentacoes = new ArrayList<>();
        for (Element tr : linhas) {
            // Ignora linhas ocultas (detalhes) cujo id começa em "linha_".
            if (tr.id() != null && tr.id().startsWith("linha_")) {
                continue;
            }

            String moviCodigo = tr.attr("movi_codigo").trim();
            Elements tds = tr.select("> td");
            if (tds.size() < 6) {
                log.warn("Linha de movimentação com menos de 6 células (processo={}, moviCodigo={}, tds={}); ignorada.",
                        numeroProcesso, moviCodigo, tds.size());
                continue;
            }

            String numero = tds.get(0).text().trim();

            Element cTipo = tds.get(1);
            String tipo = Optional.ofNullable(cTipo.selectFirst("span.filtro_tipo_movimentacao"))
                    .map(e -> e.text().trim())
                    .orElse("");
            String descricao = cTipo.ownText().trim();

            String dataHora = tds.get(2).text().trim();
            String usuario = tds.get(3).text().trim();

            Element link = tr.selectFirst("a[href*=buscarArquivosMovimentacaoJSON]");
            boolean temDocumento = link != null;
            String idMovimentacaoArquivo = null;
            if (link != null) {
                Matcher m = PADRAO_ID_MOVIMENTACAO.matcher(link.attr("href"));
                if (m.find()) {
                    idMovimentacaoArquivo = m.group(1);
                }
            }

            Element drop = tr.selectFirst("div.dropMovimentacao");
            String idMovi = drop != null ? drop.attr("id_movi").trim() : null;

            movimentacoes.add(new MovimentacaoProjudi(
                    numero, tipo, descricao, dataHora, usuario,
                    moviCodigo, idMovi, idMovimentacaoArquivo, temDocumento));
        }
        log.info("Movimentações PROJUDI lidas (processo={}, total={}).", numeroProcesso, movimentacoes.size());
        return movimentacoes;
    }

    /**
     * Baixa os arquivos de uma movimentação na <b>mesma sessão</b> em que o token
     * {@code idMovimentacaoToken} foi obtido (via busca). Não sobe pro Drive — fica
     * a cargo do orquestrador.
     *
     * @param idMovimentacaoToken valor de {@code Id_Movimentacao} extraído de
     *                            {@code buscarArquivosMovimentacaoJSON('...')} (não é
     *                            {@code Id_MovimentacaoArquivo}).
     */
    public List<ArquivoTeor> baixarDocumentos(Long credencialId, String idMovimentacaoToken) {
        var list = sessionService.getAutenticadoAjax(
                credencialId,
                "MovimentacaoArquivo?AJAX=ajax&PaginaAtual=8&Id_Movimentacao=" + idMovimentacaoToken);
        if (list.statusCode() != 200) {
            log.warn("Listagem de arquivos PROJUDI falhou (status={}, token={}).",
                    list.statusCode(), idMovimentacaoToken);
            return List.of();
        }

        JsonNode root;
        try {
            root = objectMapper.readTree(list.body() == null ? "[]" : list.body());
        } catch (Exception e) {
            log.warn("Listagem de arquivos PROJUDI não é JSON válido (token={}): {}",
                    idMovimentacaoToken, e.getMessage());
            return List.of();
        }
        if (!root.isArray()) {
            log.warn("Listagem de arquivos PROJUDI não é array JSON (token={}).", idMovimentacaoToken);
            return List.of();
        }

        List<ArquivoTeor> arquivos = new ArrayList<>();
        for (JsonNode item : root) {
            if (!acessivel(item)) {
                log.debug("Arquivo PROJUDI ignorado (sem acesso ou inválido): id={}, valido={}",
                        item.path("id").asText(null), item.path("valido").asText(null));
                continue;
            }

            String id = item.path("id").asText(null);
            String hash = item.path("hash").asText(null);
            if (id == null || id.isBlank() || hash == null || hash.isBlank()) {
                log.debug("Arquivo PROJUDI sem id/hash; ignorado.");
                continue;
            }

            String nome = item.path("nome_arquivo").asText("");
            if (nome.endsWith(".p7s")) {
                nome = nome.substring(0, nome.length() - 4);
            }
            String tipo = item.path("arquivo_tipo").asText("");

            byte[] bytes = sessionService.getAutenticadoBytes(
                    credencialId,
                    "BuscaProcesso?PaginaAtual=6&Id_MovimentacaoArquivo=" + id + "&hash=" + hash)
                    .body();
            arquivos.add(new ArquivoTeor(nome, tipo, id, hash, bytes));
        }

        log.info("Arquivos PROJUDI baixados (token={}, total={}).", idMovimentacaoToken, arquivos.size());
        return arquivos;
    }

    private static boolean acessivel(JsonNode item) {
        if (!"true".equals(item.path("valido").asText(null))) {
            return false;
        }
        try {
            int acessoUsuario = Integer.parseInt(item.path("AcessoUsuario").asText("0").trim());
            int acessoArquivo = Integer.parseInt(item.path("AcessoArquivo").asText("0").trim());
            return acessoUsuario >= acessoArquivo;
        } catch (NumberFormatException e) {
            return false;
        }
    }

    /** Movimentação do processo, conforme a grade da consulta PROJUDI. */
    public record MovimentacaoProjudi(
            String numero,
            String tipo,
            String descricao,
            String dataHora,
            String usuario,
            String moviCodigo,
            String idMovi,
            String idMovimentacaoArquivo,
            boolean temDocumento) {
    }

    /** Arquivo baixado do PROJUDI (conteúdo em memória; válido só na sessão corrente). */
    public record ArquivoTeor(
            String nomeArquivo,
            String arquivoTipo,
            String idMovimentacaoArquivo,
            String hash,
            byte[] conteudo) {
    }
}
