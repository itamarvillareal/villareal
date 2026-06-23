package br.com.vilareal.projudi;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.Base64;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.function.Consumer;

/**
 * Protocolo de petição no PROJUDI-GO (Fase 1 — núcleo, sem persistência).
 * Sequência capturada do fluxo real; corpos fixos em ISO-8859-1 / UTF-8 conforme endpoint.
 */
@Service
public class ProjudiPeticaoService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiPeticaoService.class);

    private static final String REF_BUSCA = "https://projudi.tjgo.jus.br/BuscaProcesso";
    private static final String REF_PETICIONAMENTO_P4 = "https://projudi.tjgo.jus.br/Peticionamento?PaginaAtual=4";
    private static final String REF_PETICIONAMENTO = "https://projudi.tjgo.jus.br/Peticionamento";

    private static final String CORPO_PASSO_5 =
            "PaginaAtual=1812&PaginaAnterior=4&TituloPagina=null&imaLocalizarMovimentacaoTipo="
                    + "&MovimentacaoTipo=&Id_MovimentacaoTipo=null&MovimentacaoComplemento=&assinado=true"
                    + "&gerarAssinatura=false&ArquivoTipo=&Id_ArquivoTipo=&files%5B%5D=&Id_Modelo=null"
                    + "&Modelo=&nomeArquivo=&TextoEditor=&arquivo=";

    private static final String CORPO_PASSO_7 =
            "Id_MovimentacaoTipo=260&MovimentacaoTipo=Juntada+-%3E+Peti%E7%E3o+%28CNJ%3A85%29"
                    + "&PaginaAtual=-1&PaginaAnterior=1812&tempFluxo1=null&tempFluxo2=null"
                    + "&PassoEditar=null&ParteTipo=null&Viewstate=null&nomeBusca1=";

    private static final String CORPO_PASSO_11 =
            "PaginaAtual=5&__Pedido__=-2147483647&PaginaAnterior=-2&TituloPagina=null&imgConcluir=Concluir";

    private static final int RESPOSTA_BRUTA_MAX = 4000;

    /** Id PROJUDI → rótulo do tipo de arquivo (extensível). */
    private static final Map<Integer, String> NOMES_TIPO_ARQUIVO = Map.of(
            16, "Petição",
            1, "Outros");

    private final ProjudiSessionService sessionService;
    private final ObjectMapper objectMapper;

    public ProjudiPeticaoService(ProjudiSessionService sessionService, ObjectMapper objectMapper) {
        this.sessionService = sessionService;
        this.objectMapper = objectMapper;
    }

    /** Arquivo P7S a juntar na mesma petição. {@code nomeArquivo} é o nome enviado ao PROJUDI (ex.: {@code doc.pdf.p7s}). */
    public record ArquivoPeticao(byte[] bytesP7s, int idArquivoTipo, String nomeArquivo) {}

    /**
     * Executa a sequência completa de peticionamento na mesma sessão autenticada.
     * O passo Concluir é irreversível — não há retry automático.
     */
    /** Executa passos 1–10 no PROJUDI (upload incluído) sem o passo 11 (Concluir). */
    public ResultadoProtocoloPeticao validarProtocoloSemConcluir(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            List<ArquivoPeticao> arquivos) {
        return executarFluxoProtocolo(credencialId, numeroProcesso, complemento, arquivos, false);
    }

    public ResultadoProtocoloPeticao protocolarPeticao(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            List<ArquivoPeticao> arquivos) {
        return protocolarPeticao(credencialId, numeroProcesso, complemento, arquivos, null);
    }

    /**
     * Igual a {@link #protocolarPeticao(Long, String, String, List)}, mas reporta cada etapa do robô
     * (login, busca, upload de cada arquivo, concluir...) via {@code progresso}, para exibição ao vivo.
     */
    public ResultadoProtocoloPeticao protocolarPeticao(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            List<ArquivoPeticao> arquivos,
            Consumer<String> progresso) {
        return executarFluxoProtocolo(credencialId, numeroProcesso, complemento, arquivos, true, progresso);
    }

    private ResultadoProtocoloPeticao executarFluxoProtocolo(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            List<ArquivoPeticao> arquivos,
            boolean executarConcluir) {
        return executarFluxoProtocolo(credencialId, numeroProcesso, complemento, arquivos, executarConcluir, null);
    }

    private ResultadoProtocoloPeticao executarFluxoProtocolo(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            List<ArquivoPeticao> arquivos,
            boolean executarConcluir,
            Consumer<String> progresso) {
        if (credencialId == null) {
            return falha("credencialId é obrigatório.", "");
        }
        if (!StringUtils.hasText(numeroProcesso)) {
            return falha("numeroProcesso é obrigatório.", "");
        }
        if (arquivos == null || arquivos.isEmpty()) {
            return falha("arquivos é obrigatório (ao menos um P7S).", "");
        }
        for (int i = 0; i < arquivos.size(); i++) {
            ArquivoPeticao arq = arquivos.get(i);
            if (arq == null || arq.bytesP7s() == null || arq.bytesP7s().length == 0) {
                return falha("arquivos[" + i + "].bytesP7s é obrigatório.", "");
            }
        }

        String processo = numeroProcesso.trim();
        String complementoIso = encIso8859(complemento == null ? "" : complemento);
        long epochMillis = System.currentTimeMillis();

        emitir(progresso, "Conectando ao PROJUDI…");

        try {
            // 1) busca — reaproveita sessão em cache/disco (TTL projudi.session.ttl-min); login+OTP só se expirada
            emitir(progresso, "Buscando o processo…");
            var busca = sessionService.buscarProcessoConsulta(credencialId, processo);
            if (pareceFalhaLeitura(busca.statusCode(), busca.body())) {
                return falha("Passo 1 (busca processo) falhou.", busca.body());
            }

            // 2)
            var p2 = sessionService.getAutenticadoAjaxComReferer(
                    credencialId, "Processo?AJAX=ajax&Passo=1&PaginaAtual=1", REF_BUSCA);
            if (pareceFalhaLeitura(p2.statusCode(), p2.body())) {
                return falha("Passo 2 (Processo AJAX) falhou.", p2.body());
            }

            // 3)
            var p3 = sessionService.getAutenticadoAjaxComReferer(
                    credencialId,
                    "MovimentacaoTipoMovimentacaoTipoClasse?AJAX=ajax&PaginaAtual=7",
                    REF_BUSCA);
            if (pareceFalhaLeitura(p3.statusCode(), p3.body())) {
                return falha("Passo 3 (MovimentacaoTipo) falhou.", p3.body());
            }

            // 4)
            emitir(progresso, "Processo localizado — preparando juntada…");
            var p4 = sessionService.getAutenticadoComReferer(
                    credencialId, "Peticionamento?PaginaAtual=4", REF_BUSCA);
            if (pareceFalhaLeitura(p4.statusCode(), p4.body())) {
                return falha("Passo 4 (Peticionamento p.4) falhou.", p4.body());
            }

            // 5)
            HttpResponse<String> p5 = sessionService.postPeticionamento(
                    credencialId,
                    "Peticionamento",
                    null,
                    CORPO_PASSO_5,
                    StandardCharsets.ISO_8859_1,
                    REF_PETICIONAMENTO_P4);
            if (pareceFalhaPost(p5)) {
                return falha("Passo 5 (Peticionamento p.1812) falhou.", corpoResposta(p5));
            }

            // 6)
            var p6 = sessionService.getAutenticadoAjaxComReferer(
                    credencialId,
                    "Peticionamento?AJAX=ajax&Passo=1&PaginaAtual=1812&nomeBusca1=&PosicaoPaginaAtual=0"
                            + "&tempFluxo1=null&tempFluxo2=null",
                    REF_PETICIONAMENTO);
            if (pareceFalhaLeitura(p6.statusCode(), p6.body())) {
                return falha("Passo 6 (Peticionamento AJAX p.1812) falhou.", p6.body());
            }

            // 7)
            HttpResponse<String> p7 = sessionService.postPeticionamento(
                    credencialId,
                    "Peticionamento",
                    null,
                    CORPO_PASSO_7,
                    StandardCharsets.ISO_8859_1,
                    REF_PETICIONAMENTO);
            if (pareceFalhaPost(p7)) {
                return falha("Passo 7 (tipo movimentação) falhou.", corpoResposta(p7));
            }

            // 8) upload de cada arquivo + GET fluxo=9 por arquivo
            var initInsercao = sessionService.getAutenticadoAjaxComReferer(
                    credencialId,
                    "InsercaoArquivo?AJAX=ajax&PaginaAtual=3&fluxo=9",
                    REF_PETICIONAMENTO);
            if (pareceFalhaLeitura(initInsercao.statusCode(), initInsercao.body())) {
                return falha("Passo 8 (InsercaoArquivo fluxo=9 inicial) falhou.", initInsercao.body());
            }

            Map<Integer, String> nomesGerados = new HashMap<>();
            int totalArquivos = arquivos.size();
            for (int i = 0; i < arquivos.size(); i++) {
                ArquivoPeticao arquivo = arquivos.get(i);
                String nomeP7s = resolverNomeArquivoUpload(arquivo.nomeArquivo(), processo, epochMillis, i);
                nomesGerados.put(i, nomeP7s);

                emitir(progresso, "Enviando arquivo " + (i + 1) + " de " + totalArquivos + ": " + nomeP7s);
                String corpoInsercao = montarCorpoInsercaoArquivo(nomeP7s, arquivo);
                HttpResponse<String> p8a = sessionService.postPeticionamento(
                        credencialId,
                        "InsercaoArquivo",
                        "AJAX=ajax&PaginaAtual=3&fluxo=4",
                        corpoInsercao,
                        StandardCharsets.UTF_8,
                        REF_PETICIONAMENTO);
                String corpoP8a = corpoResposta(p8a);
                if (pareceFalhaPost(p8a)) {
                    return falha("Passo 8a (InsercaoArquivo, arquivo " + i + ") falhou.", corpoP8a);
                }
                String erroInsercao = validarRespostaInsercaoArquivo(corpoP8a);
                if (erroInsercao != null) {
                    return falha(erroInsercao, corpoP8a);
                }

                var p8b = sessionService.getAutenticadoAjaxComReferer(
                        credencialId,
                        "InsercaoArquivo?AJAX=ajax&PaginaAtual=3&fluxo=9",
                        REF_PETICIONAMENTO);
                if (pareceFalhaLeitura(p8b.statusCode(), p8b.body())) {
                    return falha("Passo 8b (InsercaoArquivo fluxo 9, arquivo " + i + ") falhou.", p8b.body());
                }
            }

            // 9) Avançar — espelha o último arquivo
            emitir(progresso, "Revisando a juntada…");
            int ultimoIdx = arquivos.size() - 1;
            ArquivoPeticao ultimo = arquivos.get(ultimoIdx);
            String nomeUltimo = nomesGerados.get(ultimoIdx);
            String corpoAvancar = montarCorpoAvancar(complementoIso, nomeUltimo, ultimo);
            HttpResponse<String> p9 = sessionService.postPeticionamento(
                    credencialId,
                    "Peticionamento",
                    null,
                    corpoAvancar,
                    StandardCharsets.ISO_8859_1,
                    REF_PETICIONAMENTO);
            if (pareceFalhaPost(p9)) {
                return falha("Passo 9 (Avançar) falhou.", corpoResposta(p9));
            }

            // 10)
            var p10 = sessionService.getAutenticadoAjaxComReferer(
                    credencialId,
                    "InsercaoArquivo?AJAX=ajax&PaginaAtual=3&fluxo=9",
                    REF_PETICIONAMENTO);
            if (pareceFalhaLeitura(p10.statusCode(), p10.body())) {
                return falha("Passo 10 (InsercaoArquivo fluxo 9 pós-Avançar) falhou.", p10.body());
            }

            if (!executarConcluir) {
                log.info(
                        "Validação PROJUDI OK até passo 10 (processo={}, arquivos={}, nomes={}) — Concluir não executado.",
                        processo,
                        arquivos.size(),
                        nomesGerados.values());
                return new ResultadoProtocoloPeticao(
                        true,
                        "Passos 1–10 concluídos com sucesso (Concluir não executado).",
                        truncarRespostaBruta("nomesUpload=" + nomesGerados.values()));
            }

            // 11) irreversível
            emitir(progresso, "Concluindo o protocolo (irreversível)…");
            HttpResponse<String> p11 = sessionService.postPeticionamento(
                    credencialId,
                    "Peticionamento",
                    null,
                    CORPO_PASSO_11,
                    StandardCharsets.ISO_8859_1,
                    REF_PETICIONAMENTO);
            emitir(progresso, "Confirmando o envio…");
            String corpoP11 = corpoResposta(p11);
            String location = p11.headers().firstValue("Location").orElse("");
            if (protocoloConfirmado(location, corpoP11)) {
                log.info(
                        "Petição protocolada no PROJUDI (processo={}, arquivos={}, nomes={}).",
                        processo,
                        arquivos.size(),
                        nomesGerados.values());
                return new ResultadoProtocoloPeticao(
                        true,
                        "Petição enviada com sucesso.",
                        truncarRespostaBruta("location=" + location + "\n" + corpoP11));
            }
            return falha(
                    "Passo 11 (Concluir) não confirmou sucesso — verifique respostaBruta (não repetir automaticamente).",
                    "location=" + location + "\n" + corpoP11);

        } catch (Exception e) {
            log.warn("Falha no protocolo PROJUDI (processo={}): {}", numeroProcesso, e.getMessage());
            return falha(e.getClass().getSimpleName() + ": " + e.getMessage(), "");
        }
    }

    /** Reporta a etapa atual sem deixar o protocolo falhar por erro de telemetria. */
    private static void emitir(Consumer<String> progresso, String etapa) {
        if (progresso == null) {
            return;
        }
        try {
            progresso.accept(etapa);
        } catch (RuntimeException e) {
            log.debug("Falha ao reportar etapa do protocolo ('{}'): {}", etapa, e.getMessage());
        }
    }

    /** Atalho single-file (tipo 16 = Petição). */
    public ResultadoProtocoloPeticao protocolarPeticao(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            byte[] bytesP7s) {
        return protocolarPeticao(
                credencialId, numeroProcesso, complemento, List.of(new ArquivoPeticao(bytesP7s, 16, null)));
    }

    static String resolverNomeArquivoUpload(
            String nomeOriginal, String numeroProcesso, long epochMillis, int indice) {
        if (StringUtils.hasText(nomeOriginal)) {
            String nome = nomeOriginal.trim();
            int barra = Math.max(nome.lastIndexOf('/'), nome.lastIndexOf('\\'));
            if (barra >= 0 && barra + 1 < nome.length()) {
                nome = nome.substring(barra + 1);
            }
            if (!nome.isBlank()) {
                return nome;
            }
        }
        return gerarNomeP7s(numeroProcesso, epochMillis, indice);
    }

    static String gerarNomeP7s(String numeroProcesso, long epochMillis, int indice) {
        String digitos = numeroProcesso.replaceAll("\\D", "");
        if (digitos.isEmpty()) {
            digitos = "0";
        }
        return "peticao_" + digitos + "_" + epochMillis + "_" + indice + ".pdf.p7s";
    }

    public static String nomeTipoArquivo(int idArquivoTipo) {
        return NOMES_TIPO_ARQUIVO.getOrDefault(idArquivoTipo, idArquivoTipo == 16 ? "Petição" : "Outros");
    }

    private static String montarCorpoInsercaoArquivo(String nomeP7s, ArquivoPeticao arquivo) {
        String base64 = Base64.getEncoder().encodeToString(arquivo.bytesP7s());
        String dataUri = "data:application/pkcs7-signature;base64," + base64;
        String arquivoEncoded = encFormComponent(dataUri);
        String nomeTipoUtf8 = encUtf8(nomeTipoArquivo(arquivo.idArquivoTipo()));
        return "id=-1&id_ArquivoTipo="
                + arquivo.idArquivoTipo()
                + "&arquivoTipo="
                + nomeTipoUtf8
                + "&nomeArquivo="
                + nomeP7s
                + "&arquivo="
                + arquivoEncoded
                + "&assinado=true&gerarAssinatura=false&senhaCertificado=&salvarSenha="
                + "&contentType="
                + encFormComponent("application/pkcs7-signature");
    }

    /** Equivalente ao {@code encodeURIComponent} do jQuery (campo {@code arquivo} do PROJUDI). */
    static String encFormComponent(String valor) {
        if (valor == null) {
            return "";
        }
        StringBuilder out = new StringBuilder(valor.length() + 16);
        for (int i = 0; i < valor.length(); ) {
            int cp = valor.codePointAt(i);
            if ((cp >= '0' && cp <= '9')
                    || (cp >= 'A' && cp <= 'Z')
                    || (cp >= 'a' && cp <= 'z')
                    || "-_.!~*'()".indexOf(cp) >= 0) {
                out.appendCodePoint(cp);
            } else if (cp == ' ') {
                out.append("%20");
            } else if (cp < 128) {
                out.append(String.format("%%%02X", cp));
            } else {
                byte[] bytes = new String(Character.toChars(cp)).getBytes(StandardCharsets.UTF_8);
                for (byte b : bytes) {
                    out.append(String.format("%%%02X", b & 0xff));
                }
            }
            i += Character.charCount(cp);
        }
        return out.toString();
    }

    private static String montarCorpoAvancar(String complementoIso, String nomeP7s, ArquivoPeticao ultimo) {
        String nomeTipoIso = encIso8859(nomeTipoArquivo(ultimo.idArquivoTipo()));
        return "PaginaAtual=-2&PaginaAnterior=-1&TituloPagina=null"
                + "&MovimentacaoTipo=Juntada+-%3E+Peti%E7%E3o+%28CNJ%3A85%29"
                + "&Id_MovimentacaoTipo=260&MovimentacaoComplemento="
                + complementoIso
                + "&assinado=true&gerarAssinatura=false&ArquivoTipo="
                + nomeTipoIso
                + "&Id_ArquivoTipo="
                + ultimo.idArquivoTipo()
                + "&files%5B%5D="
                + encIso8859(nomeP7s)
                + "&Id_Modelo=null&Modelo=&nomeArquivo=&TextoEditor=&arquivo=&imgConcluir=Avan%E7ar";
    }

    private String validarRespostaInsercaoArquivo(String corpo) {
        if (!StringUtils.hasText(corpo)) {
            // Fluxo=4 bem-sucedido costuma responder 200 com corpo vazio (captura real PROJUDI).
            return null;
        }
        try {
            JsonNode root = objectMapper.readTree(corpo);
            String arquivoNome = root.path("arquivo_nome").asText(null);
            if (StringUtils.hasText(arquivoNome)) {
                return null;
            }
            String msg = root.path("mensagem").asText(null);
            if (StringUtils.hasText(msg)) {
                return "InsercaoArquivo: " + msg;
            }
            String erro = root.path("erro").asText(null);
            if (StringUtils.hasText(erro)) {
                return "InsercaoArquivo: " + erro;
            }
            return "InsercaoArquivo sem arquivo_nome na resposta JSON.";
        } catch (Exception e) {
            return "InsercaoArquivo retornou JSON inválido: " + e.getMessage();
        }
    }

    private static boolean protocoloConfirmado(String location, String corpo) {
        return protocoloConfirmadoParaTeste(location, corpo);
    }

    static boolean protocoloConfirmadoParaTeste(String location, String corpo) {
        String loc = location == null ? "" : location.toLowerCase(Locale.ROOT);
        if (loc.contains("enviada com sucesso") || loc.contains("enviada+com+sucesso")) {
            return true;
        }
        if (corpo == null || corpo.isBlank()) {
            return false;
        }
        String corpoLower = corpo.toLowerCase(Locale.ROOT);
        return corpoLower.contains("enviada com sucesso") || corpoLower.contains("enviada+com+sucesso");
    }

    private static boolean pareceFalhaLeitura(int status, String body) {
        if (status < 200 || status >= 400) {
            return true;
        }
        return ProjudiSessionService.pareceNaoLogado(body);
    }

    private static boolean pareceFalhaPost(HttpResponse<String> resp) {
        if (resp == null) {
            return true;
        }
        int status = resp.statusCode();
        if (status < 200 || status >= 500) {
            return true;
        }
        return ProjudiSessionService.pareceNaoLogado(corpoResposta(resp));
    }

    private static String corpoResposta(HttpResponse<String> resp) {
        return resp.body() == null ? "" : resp.body();
    }

    private static String encIso8859(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.ISO_8859_1);
    }

    private static String encUtf8(String valor) {
        return URLEncoder.encode(valor, StandardCharsets.UTF_8);
    }

    private static ResultadoProtocoloPeticao falha(String mensagem, String bruta) {
        return new ResultadoProtocoloPeticao(false, mensagem, truncarRespostaBruta(bruta));
    }

    static String truncarRespostaBruta(String bruta) {
        if (bruta == null) {
            return "";
        }
        return bruta.length() <= RESPOSTA_BRUTA_MAX
                ? bruta
                : bruta.substring(0, RESPOSTA_BRUTA_MAX) + "...[truncado]";
    }

    public record ResultadoProtocoloPeticao(boolean sucesso, String mensagem, String respostaBruta) {}
}
