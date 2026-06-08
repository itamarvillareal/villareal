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
import java.util.Locale;

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

    private final ProjudiSessionService sessionService;
    private final ObjectMapper objectMapper;

    public ProjudiPeticaoService(ProjudiSessionService sessionService, ObjectMapper objectMapper) {
        this.sessionService = sessionService;
        this.objectMapper = objectMapper;
    }

    /**
     * Executa a sequência completa de peticionamento na mesma sessão autenticada.
     * O passo 11 (Concluir) é irreversível — não há retry automático.
     */
    public ResultadoProtocoloPeticao protocolarPeticao(
            Long credencialId,
            String numeroProcesso,
            String complemento,
            byte[] bytesP7s) {
        if (credencialId == null) {
            return falha("credencialId é obrigatório.", "");
        }
        if (!StringUtils.hasText(numeroProcesso)) {
            return falha("numeroProcesso é obrigatório.", "");
        }
        if (bytesP7s == null || bytesP7s.length == 0) {
            return falha("bytesP7s é obrigatório.", "");
        }

        String nomeP7s = gerarNomeP7s(numeroProcesso.trim());
        String complementoIso = encIso8859(complemento == null ? "" : complemento);

        try {
            // 1) busca — estabelece processo na sessão
            var busca = sessionService.buscarProcessoConsulta(credencialId, numeroProcesso.trim());
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

            // 8)
            String corpoPasso8 = montarCorpoInsercaoArquivo(nomeP7s, bytesP7s);
            HttpResponse<String> p8 = sessionService.postPeticionamento(
                    credencialId,
                    "InsercaoArquivo",
                    "AJAX=ajax&PaginaAtual=3&fluxo=4",
                    corpoPasso8,
                    StandardCharsets.UTF_8,
                    REF_PETICIONAMENTO);
            String corpoP8 = corpoResposta(p8);
            if (pareceFalhaPost(p8)) {
                return falha("Passo 8 (InsercaoArquivo) falhou.", corpoP8);
            }
            String erroInsercao = validarRespostaInsercaoArquivo(corpoP8);
            if (erroInsercao != null) {
                return falha(erroInsercao, corpoP8);
            }

            // 9)
            var p9 = sessionService.getAutenticadoAjaxComReferer(
                    credencialId,
                    "InsercaoArquivo?AJAX=ajax&PaginaAtual=3&fluxo=9",
                    REF_PETICIONAMENTO);
            if (pareceFalhaLeitura(p9.statusCode(), p9.body())) {
                return falha("Passo 9 (InsercaoArquivo fluxo 9) falhou.", p9.body());
            }

            // 10)
            String corpoPasso10 = montarCorpoPasso10(complementoIso, nomeP7s);
            HttpResponse<String> p10 = sessionService.postPeticionamento(
                    credencialId,
                    "Peticionamento",
                    null,
                    corpoPasso10,
                    StandardCharsets.ISO_8859_1,
                    REF_PETICIONAMENTO);
            if (pareceFalhaPost(p10)) {
                return falha("Passo 10 (Avançar) falhou.", corpoResposta(p10));
            }

            // 11) irreversível
            HttpResponse<String> p11 = sessionService.postPeticionamento(
                    credencialId,
                    "Peticionamento",
                    null,
                    CORPO_PASSO_11,
                    StandardCharsets.ISO_8859_1,
                    REF_PETICIONAMENTO);
            String corpoP11 = corpoResposta(p11);
            String location = p11.headers().firstValue("Location").orElse("");
            if (protocoloConfirmado(location, corpoP11)) {
                log.info("Petição protocolada no PROJUDI (processo={}, nomeP7s={}).",
                        numeroProcesso.trim(), nomeP7s);
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

    static String gerarNomeP7s(String numeroProcesso) {
        String digitos = numeroProcesso.replaceAll("\\D", "");
        if (digitos.isEmpty()) {
            digitos = "0";
        }
        return "peticao_" + digitos + "_" + System.currentTimeMillis() + ".pdf.p7s";
    }

    private static String montarCorpoInsercaoArquivo(String nomeP7s, byte[] bytesP7s) {
        String base64 = Base64.getEncoder().encodeToString(bytesP7s);
        String dataUri = "data:application/pkcs7-signature;base64," + base64;
        String arquivoEncoded = URLEncoder.encode(dataUri, StandardCharsets.UTF_8);
        return "id=-1&id_ArquivoTipo=16&arquivoTipo=Peti%C3%A7%C3%A3o&nomeArquivo="
                + nomeP7s
                + "&arquivo="
                + arquivoEncoded;
    }

    private static String montarCorpoPasso10(String complementoIso, String nomeP7s) {
        return "PaginaAtual=-2&PaginaAnterior=-1&TituloPagina=null"
                + "&MovimentacaoTipo=Juntada+-%3E+Peti%E7%E3o+%28CNJ%3A85%29"
                + "&Id_MovimentacaoTipo=260&MovimentacaoComplemento="
                + complementoIso
                + "&assinado=true&gerarAssinatura=false&ArquivoTipo=Peti%E7%E3o&Id_ArquivoTipo=16"
                + "&files%5B%5D="
                + nomeP7s
                + "&Id_Modelo=null&Modelo=&nomeArquivo=&TextoEditor=&arquivo=&imgConcluir=Avan%E7ar";
    }

    private String validarRespostaInsercaoArquivo(String corpo) {
        if (!StringUtils.hasText(corpo)) {
            return "InsercaoArquivo retornou corpo vazio.";
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
        String loc = location == null ? "" : location.toLowerCase(Locale.ROOT);
        if (loc.contains("enviada com sucesso")) {
            return true;
        }
        if (corpo == null || corpo.isBlank()) {
            return false;
        }
        return corpo.toLowerCase(Locale.ROOT).contains("enviada com sucesso");
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

    public record ResultadoProtocoloPeticao(boolean sucesso, String mensagem, String respostaBruta) {
    }
}
