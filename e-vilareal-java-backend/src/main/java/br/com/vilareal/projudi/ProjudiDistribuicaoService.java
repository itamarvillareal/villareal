package br.com.vilareal.projudi;

import br.com.vilareal.documento.QualificacaoPessoaUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiParteResolverService.ParteProjudiResolvida;
import br.com.vilareal.projudi.ProjudiPeticaoService.ArquivoPeticao;
import br.com.vilareal.projudi.ProjudiProcessoCivelHtmlUtil.TokensFluxo;
import br.com.vilareal.projudi.ProjudiProcessoCivelRevisaoHtmlUtil.ExtracaoNumero;
import br.com.vilareal.projudi.ProjudiProcessoCivelRevisaoHtmlUtil.FormularioRevisao;
import br.com.vilareal.projudi.ProjudiSessionService.RespostaProjudi;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.net.URLEncoder;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.regex.Pattern;

/**
 * Assistente do fluxo {@code /ProcessoCivel} até a revisão (Passo 3). Não distribui o processo.
 */
@Service
public class ProjudiDistribuicaoService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiDistribuicaoService.class);

    private static final int DETALHE_MAX = 500;
    private static final int DIAGNOSTICO_MAX = 800;
    private static final int RESPOSTA_DIAGNOSTICO_MAX = 1600;
    private static final int HASH_DIAG_MAX = 1600;

    private static final Pattern SENSIVEL_DETALHE = Pattern.compile(
            "(?i)(senha|password|otp|c[oó]digo\\s*otp|cookie|jsessionid|set-cookie|sessionid|"
                    + "authtoken|bearer\\s+[a-z0-9._-]+)([^\\s&;\"']{0,120})");

    private static final String REF_INICIAL =
            "https://projudi.tjgo.jus.br/ProcessoCivel?PaginaAtual=4&dependente=false&fisico=false";
    private static final String REF_PROCESSO_CIVEL = "https://projudi.tjgo.jus.br/ProcessoCivel";

    private final ProjudiSessionService sessionService;
    private final ProjudiParteResolverService parteResolverService;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final ObjectMapper objectMapper;

    public ProjudiDistribuicaoService(
            ProjudiSessionService sessionService,
            ProjudiParteResolverService parteResolverService,
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            ObjectMapper objectMapper) {
        this.sessionService = sessionService;
        this.parteResolverService = parteResolverService;
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.objectMapper = objectMapper;
    }

    public record InicialRequest(
            String valorCausa,
            List<Integer> idAssuntos,
            Long pessoaIdAutor,
            List<Long> pessoaIdsReu,
            List<ArquivoPeticao> arquivos,
            ProjudiClasseProcessoInicial classe,
            ProjudiInicialOpcoesPasso3 opcoesPasso3,
            Boolean prioridadeMaior60Anos,
            Long processoIdOrigem) {

        public ProjudiClasseProcessoInicial classeEfetiva() {
            return classe != null ? classe : ProjudiClasseProcessoInicial.JEC;
        }

        public ProjudiInicialOpcoesPasso3 opcoesPasso3Efetivas() {
            return opcoesPasso3 != null ? opcoesPasso3 : ProjudiInicialOpcoesPasso3.PADRAO;
        }

        public ProjudiPrioridadeProcessoInicial prioridadeEfetiva() {
            return prioridadeEfetiva(null);
        }

        public ProjudiPrioridadeProcessoInicial prioridadeEfetiva(Integer idProcessoPrioridadeMaior60Resolvido) {
            return ProjudiPrioridadeProcessoInicial.deAutorMaiorDe60Anos(
                    Boolean.TRUE.equals(prioridadeMaior60Anos), idProcessoPrioridadeMaior60Resolvido);
        }
    }

    public record PendenciaParte(String papel, Long pessoaId, List<String> pendencias) {}

    public record PassoLog(int ordem, String passo, Integer httpStatus, boolean ok, String detalhe) {}

    public record ResultadoPreparacaoInicial(
            boolean ok,
            String passoAlcancado,
            String hashFluxo,
            List<PendenciaParte> pendenciasPartes,
            String respostaBruta,
            List<PassoLog> passos) {}

    public record ResultadoDistribuicaoInicial(
            boolean ok,
            String passoAlcancado,
            String numeroProcessoGerado,
            boolean numeroGravadoCadastro,
            String respostaBruta,
            List<PassoLog> passos) {

        static ResultadoDistribuicaoInicial dePreparacao(ResultadoPreparacaoInicial prep) {
            return new ResultadoDistribuicaoInicial(
                    prep.ok(),
                    prep.passoAlcancado(),
                    null,
                    false,
                    prep.respostaBruta(),
                    prep.passos());
        }
    }

    public record ValidacaoProntidaoInicial(
            boolean pronta,
            List<String> bloqueios,
            List<PendenciaParte> pendenciasPartes,
            ParteProjudiResolvida autor,
            List<ParteProjudiResolvida> reus,
            Boolean autorMaiorDe60Anos) {}

    private static final class HtmlRevisaoHolder {
        String html;
    }

    private static final class TrilhaExecucao {
        private final List<PassoLog> passos = new ArrayList<>();
        private int ordem = 0;

        void falhaSemResposta(String passo, String detalhe) {
            passos.add(new PassoLog(++ordem, passo, null, false, sanitizarDetalhe(detalhe)));
        }

        void okSemResposta(String passo, String detalhe) {
            passos.add(new PassoLog(++ordem, passo, null, true, sanitizarDetalhe(detalhe)));
        }

        void ok(String passo, RespostaProjudi resp, String detalhe) {
            registrar(passo, resp, true, detalhe);
        }

        void ok(String passo, HttpResponse<String> resp, String detalhe) {
            registrar(passo, resp, true, detalhe);
        }

        void falha(String passo, RespostaProjudi resp, String detalhe) {
            registrar(passo, resp, false, detalhe);
        }

        void falha(String passo, HttpResponse<String> resp, String detalhe) {
            registrar(passo, resp, false, detalhe);
        }

        void registrar(String passo, RespostaProjudi resp, boolean ok, String detalhe) {
            Integer status = resp != null ? resp.statusCode() : null;
            passos.add(new PassoLog(++ordem, passo, status, ok, sanitizarDetalhe(detalhe)));
        }

        void registrar(String passo, HttpResponse<String> resp, boolean ok, String detalhe) {
            Integer status = resp != null ? resp.statusCode() : null;
            passos.add(new PassoLog(++ordem, passo, status, ok, sanitizarDetalhe(detalhe)));
        }

        void registrarDiagnostico(String passo, String detalhe) {
            passos.add(new PassoLog(++ordem, passo, null, false, sanitizarDetalhe(detalhe, DIAGNOSTICO_MAX)));
        }

        void registrarInstrumentacao(String passo, String detalhe) {
            passos.add(new PassoLog(++ordem, passo, null, true, sanitizarDetalhe(detalhe, HASH_DIAG_MAX)));
        }

        List<PassoLog> passos() {
            return List.copyOf(passos);
        }
    }

    /**
     * Valida se a inicial pode ser preparada/distribuída, com motivos explícitos de bloqueio.
     * Não executa o fluxo PROJUDI — apenas checagens locais e resolução de partes.
     */
    /** Sem {@code @Transactional}: chama {@link ProjudiParteResolverService#resolver} que pode falhar
     *  (ex.: credencial PROJUDI inválida); a exceção é convertida em bloqueio — transação externa
     *  marcaria rollback-only e geraria 500 ao commit. */
    public ValidacaoProntidaoInicial validarProntidao(
            Long credencialId,
            String valorCausa,
            List<Integer> idAssuntos,
            Long pessoaIdAutor,
            List<Long> pessoaIdsReu,
            int quantidadeAnexos,
            Long processoIdOrigem) {
        List<String> bloqueios = new ArrayList<>();
        List<PendenciaParte> pendenciasPartes = new ArrayList<>();
        List<Long> idsReu = pessoaIdsReu != null ? pessoaIdsReu : List.of();

        if (credencialId == null) {
            bloqueios.add("Credencial PROJUDI não informada.");
        }
        if (!StringUtils.hasText(valorCausa)) {
            bloqueios.add("Valor da causa não informado.");
        }
        if (idAssuntos == null || idAssuntos.isEmpty()) {
            bloqueios.add("Nenhum assunto PROJUDI selecionado.");
        }
        if (pessoaIdAutor == null) {
            bloqueios.add("Autor não selecionado.");
        }
        if (idsReu.isEmpty()) {
            bloqueios.add("Ao menos um réu deve ser selecionado.");
        }
        if (quantidadeAnexos <= 0) {
            bloqueios.add("Nenhum anexo .p7s adicionado.");
        }

        ParteProjudiResolvida autor = null;
        List<ParteProjudiResolvida> reus = new ArrayList<>();
        Boolean autorMaiorDe60Anos = null;
        if (credencialId != null && pessoaIdAutor != null) {
            autorMaiorDe60Anos = parteResolverService.autorMaiorDe60Anos(pessoaIdAutor);
            autor = resolverParteComBloqueios(
                    bloqueios,
                    pendenciasPartes,
                    "AUTOR",
                    pessoaIdAutor,
                    credencialId,
                    enderecoIdDaParteNoProcesso(processoIdOrigem, pessoaIdAutor));
        }
        if (credencialId != null && !idsReu.isEmpty()) {
            int totalReus = idsReu.size();
            for (int i = 0; i < idsReu.size(); i++) {
                Long pessoaIdReu = idsReu.get(i);
                if (pessoaIdReu == null) {
                    bloqueios.add(rotuloReu(i, totalReus) + ": pessoa não informada.");
                    continue;
                }
                ParteProjudiResolvida reu =
                        resolverParteComBloqueios(
                                bloqueios,
                                pendenciasPartes,
                                papelReu(i, totalReus),
                                pessoaIdReu,
                                credencialId,
                                enderecoIdDaParteNoProcesso(processoIdOrigem, pessoaIdReu));
                if (reu != null) {
                    reus.add(reu);
                }
            }
        }

        return new ValidacaoProntidaoInicial(
                bloqueios.isEmpty(),
                List.copyOf(bloqueios),
                List.copyOf(pendenciasPartes),
                autor,
                List.copyOf(reus),
                autorMaiorDe60Anos);
    }

    /** Endereço escolhido em «Detalhes das partes» para a pessoa neste processo (petição/protocolo). */
    public Long enderecoIdDaParteNoProcesso(Long processoId, Long pessoaId) {
        if (processoId == null || pessoaId == null) {
            return null;
        }
        return processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId).stream()
                .filter(parte -> parte.getPessoa() != null && pessoaId.equals(parte.getPessoa().getId()))
                .map(QualificacaoPessoaUtil::enderecoIdDaParte)
                .filter(java.util.Objects::nonNull)
                .findFirst()
                .orElse(null);
    }

    private ParteProjudiResolvida resolverParteComBloqueios(
            List<String> bloqueios,
            List<PendenciaParte> pendenciasPartes,
            String papel,
            Long pessoaId,
            Long credencialId,
            Long pessoaEnderecoId) {
        try {
            ParteProjudiResolvida parte = parteResolverService.resolver(pessoaId, credencialId, pessoaEnderecoId);
            if (!parte.prontaParaInserir()) {
                pendenciasPartes.add(new PendenciaParte(papel, pessoaId, parte.pendencias()));
                if (parte.pendencias() != null && !parte.pendencias().isEmpty()) {
                    for (String pendencia : parte.pendencias()) {
                        bloqueios.add(rotuloPapel(papel) + ": " + pendencia);
                    }
                } else {
                    bloqueios.add(
                            rotuloPapel(papel)
                                    + ": endereço não resolvido no PROJUDI (Estado/Cidade/Bairro pendente).");
                }
            }
            return parte;
        } catch (RuntimeException e) {
            log.warn("validarProntidao {} pessoaId={}: {}", papel, pessoaId, e.getMessage());
            bloqueios.add(rotuloPapel(papel) + ": falha ao resolver no PROJUDI — " + e.getMessage());
            return null;
        }
    }

    private static String rotuloPapel(String papel) {
        if ("AUTOR".equalsIgnoreCase(papel)) {
            return "Autor";
        }
        if ("REU".equalsIgnoreCase(papel) || papel.startsWith("REU_")) {
            if (papel.startsWith("REU_")) {
                try {
                    int indice = Integer.parseInt(papel.substring(4)) - 1;
                    return rotuloReu(indice, indice + 2);
                } catch (NumberFormatException ignored) {
                    // fallthrough
                }
            }
            return "Réu";
        }
        return papel;
    }

    private static String rotuloReu(int indice, int total) {
        return total <= 1 ? "Réu" : "Réu " + (indice + 1);
    }

    private static String papelReu(int indice, int total) {
        return total <= 1 ? "REU" : "REU_" + (indice + 1);
    }

    /**
     * Executa o fluxo capturado até a tela de revisão. Para antes de qualquer POST de distribuição final.
     */
    public ResultadoPreparacaoInicial prepararInicial(Long credencialId, InicialRequest request) {
        return prepararInicialInterno(credencialId, request, null, null);
    }

    /**
     * Prepara até REVISAO e, se {@code confirmar=true}, envia o POST final de distribuição (irreversível).
     */
    @Transactional
    public ResultadoDistribuicaoInicial distribuirInicial(
            Long credencialId, InicialRequest request, boolean confirmar, Long processoIdOrigem) {
        Long processoIdGravacao =
                request.processoIdOrigem() != null ? request.processoIdOrigem() : processoIdOrigem;
        TrilhaExecucao trilha = new TrilhaExecucao();
        HtmlRevisaoHolder htmlOut = new HtmlRevisaoHolder();
        ResultadoPreparacaoInicial prep = prepararInicialInterno(credencialId, request, trilha, htmlOut);
        if (!prep.ok() || !"REVISAO".equals(prep.passoAlcancado())) {
            return ResultadoDistribuicaoInicial.dePreparacao(prep);
        }
        if (!confirmar) {
            return new ResultadoDistribuicaoInicial(
                    true,
                    "REVISAO",
                    null,
                    false,
                    sanitizarDetalhe(truncar(htmlOut.html)),
                    trilha.passos());
        }
        Optional<FormularioRevisao> formOpt =
                ProjudiProcessoCivelRevisaoHtmlUtil.extrairFormularioDistribuicao(htmlOut.html);
        if (formOpt.isEmpty()) {
            trilha.falhaSemResposta(
                    "Scraping Passo3",
                    "Formulário de revisão ou botão Confirmar/Distribuir não encontrado no HTML.");
            return falhaDistribuicao(
                    "REVISAO",
                    "Não foi possível montar o POST final a partir da tela de revisão.",
                    htmlOut.html,
                    trilha);
        }
        FormularioRevisao form = formOpt.get();
        FormularioRevisao formComOpcoes = form.comOpcoesPasso3(request.opcoesPasso3Efetivas());
        trilha.okSemResposta(
                "Scraping Passo3",
                "action="
                        + formComOpcoes.action()
                        + " botão="
                        + formComOpcoes.botaoNome()
                        + "="
                        + formComOpcoes.botaoValor()
                        + " hidden+checkbox="
                        + formComOpcoes.campos().size()
                        + " nomes="
                        + String.join(",", formComOpcoes.campos().keySet()));
        String corpoEnvio = formComOpcoes.montarCorpoPostIso8859();
        trilha.registrarInstrumentacao(
                "Corpo Passo3 (envio)",
                ProjudiProcessoCivelRevisaoHtmlUtil.formatarCorpoPasso3(formComOpcoes));
        trilha.registrarInstrumentacao(
                "Corpo Passo3 (ISO-8859-1)",
                sanitizarDetalhe(corpoEnvio, HASH_DIAG_MAX));
        String pedidoForm = ProjudiProcessoCivelRevisaoHtmlUtil.pedidoValorNoFormulario(formComOpcoes);
        String hashRevisaoHtml = ProjudiProcessoCivelHtmlUtil.hashFluxoPreferidoNoHtml(htmlOut.html);
        trilha.registrarInstrumentacao(
                "Controle Passo3",
                "__Pedido__ no corpo="
                        + nvDiag(pedidoForm)
                        + " | hashFluxo (URL/HTML, fora do corpo)="
                        + nvDiag(hashRevisaoHtml)
                        + " | prep.hashFluxo="
                        + nvDiag(prep.hashFluxo()));
        try {
            HttpResponse<String> respDist = postProcessoCivelComTrilha(
                    trilha, "POST Passo3 distribuir", credencialId, corpoEnvio, REF_PROCESSO_CIVEL);
            int statusDist = respDist.statusCode();
            String corpoDist = corpo(respDist);
            String location = respDist.headers().firstValue("Location").orElse("").trim();

            if (pareceRedirectPost(statusDist)) {
                return processarRedirectPosDistribuicao(
                        trilha, credencialId, processoIdGravacao, respDist, statusDist, location);
            }

            trilha.registrar(
                    "POST Passo3 distribuir",
                    respDist,
                    parecePostDistribuicaoAceito(respDist),
                    String.valueOf(statusDist));

            if (!parecePostDistribuicaoAceito(respDist)) {
                trilha.falha(
                        "POST Passo3 distribuir",
                        respDist,
                        "Resposta inesperada ao distribuir (status=" + statusDist + ")");
                return falhaDistribuicao(
                        "DISTRIBUIR",
                        "POST de distribuição não retornou sucesso reconhecível.",
                        corpoDist,
                        trilha);
            }

            Optional<ExtracaoNumero> numeroOpt =
                    ProjudiProcessoCivelRevisaoHtmlUtil.extrairNumeroProcessoGerado(corpoDist, null);

            if (numeroOpt.isEmpty()) {
                trilha.falhaSemResposta(
                        "Extrair número",
                        "Resposta 200 mas CNJ não encontrado no corpo. POST NÃO será reenviado.");
                return falhaDistribuicao(
                        "DISTRIBUIR",
                        "Distribuição não confirmada — número do processo não reconhecido na resposta.",
                        corpoDist,
                        trilha);
            }

            ExtracaoNumero numero = numeroOpt.get();
            trilha.okSemResposta("Número extraído", numero.detalhe() + " → " + numero.numero());
            boolean gravado = gravarNumeroNoProcesso(processoIdGravacao, numero.numero());
            log.info(
                    "PROJUDI inicial DISTRIBUIDA (credencialId={}, numero={}, processoIdOrigem={}, gravado={}).",
                    credencialId,
                    numero.numero(),
                    processoIdGravacao,
                    gravado);
            String respostaBruta = corpoDist;
            return new ResultadoDistribuicaoInicial(
                    true,
                    "DISTRIBUIDO",
                    numero.numero(),
                    gravado,
                    sanitizarDetalhe(truncar(respostaBruta)),
                    trilha.passos());
        } catch (Exception e) {
            log.warn("Falha ao distribuir inicial PROJUDI (credencialId={}): {}", credencialId, e.getMessage());
            trilha.falhaSemResposta("EXCECAO distribuir", e.getClass().getSimpleName() + ": " + e.getMessage());
            return falhaDistribuicao(
                    "EXCECAO",
                    e.getClass().getSimpleName() + ": " + e.getMessage(),
                    null,
                    trilha);
        }
    }

    private ResultadoPreparacaoInicial prepararInicialInterno(
            Long credencialId, InicialRequest request, TrilhaExecucao trilhaIn, HtmlRevisaoHolder htmlOut) {
        TrilhaExecucao trilha = trilhaIn != null ? trilhaIn : new TrilhaExecucao();

        if (credencialId == null) {
            return falha("CREDENCIAL", "credencialId é obrigatório.", null, List.of(), trilha, "Validação", null);
        }
        if (request == null) {
            return falha("VALIDACAO", "request é obrigatório.", null, List.of(), trilha, "Validação", null);
        }
        if (!StringUtils.hasText(request.valorCausa())) {
            return falha("VALIDACAO", "valorCausa é obrigatório.", null, List.of(), trilha, "Validação", null);
        }
        if (request.idAssuntos() == null || request.idAssuntos().isEmpty()) {
            return falha("VALIDACAO", "idAssuntos é obrigatório (ao menos um).", null, List.of(), trilha, "Validação", null);
        }
        List<Long> idsReu = request.pessoaIdsReu() != null ? request.pessoaIdsReu() : List.of();
        if (request.pessoaIdAutor() == null || idsReu.isEmpty()) {
            return falha(
                    "VALIDACAO",
                    "pessoaIdAutor e ao menos um pessoaIdsReu são obrigatórios.",
                    null,
                    List.of(),
                    trilha,
                    "Validação",
                    null);
        }
        if (request.arquivos() == null || request.arquivos().isEmpty()) {
            return falha(
                    "VALIDACAO",
                    "arquivos é obrigatório (ao menos um P7S).",
                    null,
                    List.of(),
                    trilha,
                    "Validação",
                    null);
        }

        Long processoIdOrigem = request.processoIdOrigem();
        List<PendenciaParte> pendenciasPartes = new ArrayList<>();
        ParteProjudiResolvida autor = parteResolverService.resolver(
                request.pessoaIdAutor(),
                credencialId,
                enderecoIdDaParteNoProcesso(processoIdOrigem, request.pessoaIdAutor()));
        if (!autor.prontaParaInserir()) {
            pendenciasPartes.add(new PendenciaParte("AUTOR", request.pessoaIdAutor(), autor.pendencias()));
        }
        List<ParteProjudiResolvida> reusResolvidos = new ArrayList<>();
        int totalReus = idsReu.size();
        for (int i = 0; i < idsReu.size(); i++) {
            Long pessoaIdReu = idsReu.get(i);
            if (pessoaIdReu == null) {
                pendenciasPartes.add(new PendenciaParte(papelReu(i, totalReus), null, List.of("Pessoa não informada.")));
                continue;
            }
            ParteProjudiResolvida reu = parteResolverService.resolver(
                    pessoaIdReu,
                    credencialId,
                    enderecoIdDaParteNoProcesso(processoIdOrigem, pessoaIdReu));
            if (!reu.prontaParaInserir()) {
                pendenciasPartes.add(new PendenciaParte(papelReu(i, totalReus), pessoaIdReu, reu.pendencias()));
            }
            reusResolvidos.add(reu);
        }
        if (!pendenciasPartes.isEmpty()) {
            trilha.falhaSemResposta(
                    "Validação partes",
                    "Resolução de partes incompleta — corrija pendências antes de continuar.");
            return new ResultadoPreparacaoInicial(
                    false,
                    "PARTES_PENDENTES",
                    null,
                    List.copyOf(pendenciasPartes),
                    sanitizarDetalhe("Resolução de partes incompleta — corrija pendências antes de continuar."),
                    trilha.passos());
        }

        try {
            var g1 = sessionService.getAutenticadoComReferer(
                    credencialId, "ProcessoCivel?PaginaAtual=4&dependente=false&fisico=false", REF_INICIAL);
            if (pareceFalhaLeitura(g1.statusCode(), g1.body())) {
                return falha(
                        "GET_INICIAL",
                        "Falha ao abrir ProcessoCivel (PaginaAtual=4).",
                        g1.body(),
                        List.of(),
                        trilha,
                        "GET ProcessoCivel?PaginaAtual=4",
                        g1);
            }
            trilha.ok("GET ProcessoCivel?PaginaAtual=4", g1, "Formulário inicial carregado");
            registrarHashFluxoHtml(trilha, "GET ProcessoCivel?PaginaAtual=4", g1.body());

            HttpResponse<String> nav1 = postProcessoCivelComTrilha(
                    trilha,
                    "POST wizard inicial",
                    credencialId,
                    ProjudiProcessoCivelInicialCorpoUtil.montarCorpoWizardInicial("4"),
                    REF_INICIAL);
            if (pareceFalhaPost(nav1)) {
                return falha(
                        "NAV_WIZARD",
                        "Falha na navegação inicial do wizard.",
                        corpo(nav1),
                        List.of(),
                        trilha,
                        "POST wizard inicial",
                        nav1);
            }
            trilha.ok("POST wizard inicial", nav1, "Wizard aberto");
            registrarHashFluxoHtml(trilha, "POST wizard inicial", corpo(nav1));

            HttpResponse<String> nav2 = postProcessoCivelComTrilha(
                    trilha,
                    "POST tipo cível/assistência",
                    credencialId,
                    ProjudiProcessoCivelInicialCorpoUtil.montarCorpoTipoAssistencia(),
                    REF_PROCESSO_CIVEL);
            if (pareceFalhaPost(nav2)) {
                return falha(
                        "NAV_TIPO",
                        "Falha ao selecionar tipo cível/assistência.",
                        corpo(nav2),
                        List.of(),
                        trilha,
                        "POST tipo cível/assistência",
                        nav2);
            }
            trilha.ok("POST tipo cível/assistência", nav2, "Tipo selecionado");
            registrarHashFluxoHtml(trilha, "POST tipo cível/assistência", corpo(nav2));

            HttpResponse<String> navCustas = postProcessoCivelComTrilha(
                    trilha,
                    "POST custas/dependência",
                    credencialId,
                    ProjudiProcessoCivelInicialCorpoUtil.montarCorpoCustasSemDependencia(),
                    REF_PROCESSO_CIVEL);
            if (pareceFalhaPost(navCustas)) {
                return falha(
                        "NAV_CUSTAS",
                        "Falha ao selecionar custas e dependência do processo.",
                        corpo(navCustas),
                        List.of(),
                        trilha,
                        "POST custas/dependência",
                        navCustas);
            }
            trilha.ok("POST custas/dependência", navCustas, "custaTipo=3 dependenciaProcesso=2");
            registrarHashFluxoHtml(trilha, "POST custas/dependência", corpo(navCustas));

            Optional<ProjudiPrioridadeProcessoInicial> prioridadePasso1Opt =
                    resolverPrioridadePasso1(trilha, request, corpo(navCustas), credencialId);
            if (prioridadePasso1Opt.isEmpty()) {
                return new ResultadoPreparacaoInicial(
                        false,
                        "PASSO1",
                        null,
                        List.of(),
                        sanitizarDetalhe(
                                "Não foi possível mapear a prioridade «Maior de 60 Anos» no PROJUDI (Passo 1)."),
                        trilha.passos());
            }
            ProjudiPrioridadeProcessoInicial prioridadePasso1 = prioridadePasso1Opt.get();

            String corpoPasso1 = ProjudiProcessoCivelInicialCorpoUtil.montarCorpoPasso1Area(
                    request.valorCausa(), "2852", "-1", request.classeEfetiva(), prioridadePasso1);
            HttpResponse<String> pPasso1 = postProcessoCivelComTrilha(
                    trilha, "POST Passo1", credencialId, corpoPasso1, REF_PROCESSO_CIVEL);
            if (pareceFalhaPost(pPasso1)) {
                return falha(
                        "PASSO1",
                        "Falha no POST Passo 1 (dados do processo).",
                        corpo(pPasso1),
                        List.of(),
                        trilha,
                        "POST Passo1",
                        pPasso1);
            }
            trilha.ok(
                    "POST Passo1",
                    pPasso1,
                    "Dados do processo enviados (Id_ProcessoPrioridade="
                            + prioridadePasso1.idProcessoPrioridade()
                            + ")");
            registrarHashFluxoHtml(trilha, "POST Passo1", corpo(pPasso1));
            trilha.registrarInstrumentacao(
                    "Prioridades HTML Passo1",
                    ProjudiProcessoCivelHtmlUtil.formatarOpcoesProcessoPrioridade(corpo(pPasso1)));
            TokensFluxo tokens = ProjudiProcessoCivelHtmlUtil.extrairTokens(corpo(pPasso1));
            String paginaAssuntos = StringUtils.hasText(tokens.paginaAtual()) ? tokens.paginaAtual() : "2852";

            for (Integer idAssunto : request.idAssuntos()) {
                if (idAssunto == null) {
                    continue;
                }
                String nomeAssunto = "POST Assunto " + idAssunto;
                String corpoAssunto = "Id_Assunto="
                        + idAssunto
                        + "&Assunto=&PaginaAtual=-1&PaginaAnterior="
                        + encIso(paginaAssuntos)
                        + "&tempFluxo1=null&tempFluxo2=null&PassoEditar=-1&ParteTipo=0&Viewstate=null"
                        + "&nomeBusca1=&nomeBusca2=";
                HttpResponse<String> pAssunto = postProcessoCivelComTrilha(
                        trilha, nomeAssunto, credencialId, corpoAssunto, REF_PROCESSO_CIVEL);
                if (pareceFalhaPost(pAssunto)) {
                    return falha(
                            "ASSUNTO",
                            "Falha ao incluir assunto Id_Assunto=" + idAssunto + ".",
                            corpo(pAssunto),
                            List.of(),
                            trilha,
                            nomeAssunto,
                            pAssunto);
                }
                trilha.ok(nomeAssunto, pAssunto, "Assunto incluído");
                registrarHashFluxoHtml(trilha, nomeAssunto, corpo(pAssunto));
            }

            tokens = inserirParte(
                    credencialId,
                    request.valorCausa(),
                    request.classeEfetiva(),
                    prioridadePasso1,
                    tokens,
                    1,
                    autor,
                    "AUTOR",
                    trilha);
            if (tokens == null) {
                return new ResultadoPreparacaoInicial(
                        false,
                        "PARTE_AUTOR",
                        null,
                        List.of(),
                        sanitizarDetalhe("Falha ao inserir parte autor."),
                        trilha.passos());
            }

            for (int i = 0; i < reusResolvidos.size(); i++) {
                ParteProjudiResolvida reu = reusResolvidos.get(i);
                String papel = papelReu(i, totalReus);
                tokens = inserirParte(
                        credencialId,
                        request.valorCausa(),
                        request.classeEfetiva(),
                        prioridadePasso1,
                        tokens,
                        0,
                        reu,
                        papel,
                        trilha);
                if (tokens == null) {
                    return new ResultadoPreparacaoInicial(
                            false,
                            totalReus <= 1 ? "PARTE_REU" : "PARTE_REU_" + (i + 1),
                            null,
                            List.of(),
                            sanitizarDetalhe("Falha ao inserir " + rotuloReu(i, totalReus).toLowerCase() + "."),
                            trilha.passos());
                }
            }

            HttpResponse<String> pAnexos = postProcessoCivelComTrilha(
                    trilha,
                    "POST avançar anexos",
                    credencialId,
                    ProjudiProcessoCivelInicialCorpoUtil.montarCorpoAvancarAnexos(
                            request.valorCausa(), request.classeEfetiva(), prioridadePasso1),
                    REF_PROCESSO_CIVEL);
            if (pareceFalhaPost(pAnexos)) {
                return falha(
                        "ANEXOS_NAV",
                        "Falha ao avançar para anexos.",
                        corpo(pAnexos),
                        List.of(),
                        trilha,
                        "POST avançar anexos",
                        pAnexos);
            }
            trilha.ok("POST avançar anexos", pAnexos, "Navegação para anexos");
            registrarHashFluxoHtml(trilha, "POST avançar anexos", corpo(pAnexos));

            var initInsercao = sessionService.getAutenticadoAjaxComReferer(
                    credencialId, "InsercaoArquivo?AJAX=ajax&PaginaAtual=3&fluxo=9", REF_PROCESSO_CIVEL);
            if (pareceFalhaLeitura(initInsercao.statusCode(), initInsercao.body())) {
                return falha(
                        "ANEXOS_INIT",
                        "Falha no GET InsercaoArquivo fluxo=9 inicial.",
                        initInsercao.body(),
                        List.of(),
                        trilha,
                        "GET InsercaoArquivo fluxo=9",
                        initInsercao);
            }
            trilha.ok("GET InsercaoArquivo fluxo=9", initInsercao, "Upload inicializado");

            long epoch = System.currentTimeMillis();
            List<String> nomesUpload = new ArrayList<>();
            for (int i = 0; i < request.arquivos().size(); i++) {
                ArquivoPeticao arquivo = request.arquivos().get(i);
                String nomeP7s = ProjudiPeticaoService.resolverNomeArquivoUpload(
                        arquivo.nomeArquivo(), "inicial", epoch, i);
                nomesUpload.add(nomeP7s);
                int idxArquivo = i + 1;

                String corpoInsercao = ProjudiPeticaoService.montarCorpoInsercaoArquivo(nomeP7s, arquivo);
                HttpResponse<String> up = sessionService.postPeticionamento(
                        credencialId,
                        "InsercaoArquivo",
                        "AJAX=ajax&PaginaAtual=3&fluxo=4",
                        corpoInsercao,
                        StandardCharsets.UTF_8,
                        REF_PROCESSO_CIVEL);
                String corpoUp = corpo(up);
                if (pareceFalhaPost(up)) {
                    return falha(
                            "ANEXOS_UPLOAD",
                            "Falha no upload do arquivo " + idxArquivo + ".",
                            corpoUp,
                            List.of(),
                            trilha,
                            "InsercaoArquivo " + idxArquivo + " upload",
                            up);
                }
                String erro = ProjudiPeticaoService.validarRespostaInsercaoArquivo(corpoUp, objectMapper);
                if (erro != null) {
                    return falha(
                            "ANEXOS_UPLOAD",
                            erro,
                            corpoUp,
                            List.of(),
                            trilha,
                            "InsercaoArquivo " + idxArquivo + " upload",
                            up);
                }
                trilha.ok("InsercaoArquivo " + idxArquivo + " upload", up, nomeP7s);

                var pos = sessionService.getAutenticadoAjaxComReferer(
                        credencialId, "InsercaoArquivo?AJAX=ajax&PaginaAtual=3&fluxo=9", REF_PROCESSO_CIVEL);
                if (pareceFalhaLeitura(pos.statusCode(), pos.body())) {
                    return falha(
                            "ANEXOS_POS",
                            "Falha no GET InsercaoArquivo fluxo=9 após arquivo " + idxArquivo + ".",
                            pos.body(),
                            List.of(),
                            trilha,
                            "InsercaoArquivo " + idxArquivo + " fluxo=9",
                            pos);
                }
                trilha.ok("InsercaoArquivo " + idxArquivo + " fluxo=9", pos, "Lista de anexos atualizada");
            }

            String corpoPasso2 =
                    ProjudiProcessoCivelInicialCorpoUtil.montarCorpoConcluirAnexos(nomesUpload);

            HttpResponse<String> respPasso2 = postProcessoCivelComTrilha(
                    trilha, "POST Passo2 Concluir", credencialId, corpoPasso2, REF_PROCESSO_CIVEL);
            String htmlPasso2 = corpo(respPasso2);
            if (pareceFalhaPost(respPasso2)) {
                return falha(
                        "PASSO2",
                        "Falha no POST Passo 2 (Concluir anexos).",
                        htmlPasso2,
                        List.of(),
                        trilha,
                        "POST Passo2",
                        respPasso2);
            }
            if (!ProjudiProcessoCivelHtmlUtil.pareceRevisao(htmlPasso2)) {
                return falha(
                        "REVISAO",
                        "Passo 2 concluído, mas a resposta não parece a tela de revisão (Passo 3).",
                        htmlPasso2,
                        List.of(),
                        trilha,
                        "POST Passo2",
                        respPasso2);
            }
            trilha.ok("POST Passo2", respPasso2, "Tela de revisão detectada");
            registrarHashFluxoHtml(trilha, "POST Passo2 (revisão)", htmlPasso2);

            TokensFluxo revisao = ProjudiProcessoCivelHtmlUtil.extrairTokens(htmlPasso2);
            String hashFluxo = ProjudiProcessoCivelHtmlUtil.hashFluxoPreferido(revisao);
            if (hashFluxo == null) {
                hashFluxo = ProjudiProcessoCivelHtmlUtil.hashFluxoPreferido(tokens);
            }
            trilha.registrarInstrumentacao(
                    "hashFluxo resumo REVISAO",
                    "hashFluxo preferido(prep)="
                            + nvDiag(hashFluxo)
                            + " | htmlPasso2: "
                            + ProjudiProcessoCivelHtmlUtil.formatarLinhaHashFluxoHtml(htmlPasso2)
                            + " | tokensPasso1 Hash="
                            + nvDiag(tokens != null ? tokens.hash() : null)
                            + " __Pedido__="
                            + nvDiag(tokens != null ? tokens.pedido() : null));

            log.info(
                    "PROJUDI inicial preparada até REVISAO (credencialId={}, assuntos={}, arquivos={}, hashFluxo={}).",
                    credencialId,
                    request.idAssuntos().size(),
                    request.arquivos().size(),
                    hashFluxo);

            if (htmlOut != null) {
                htmlOut.html = htmlPasso2;
            }

            return new ResultadoPreparacaoInicial(
                    true,
                    "REVISAO",
                    hashFluxo,
                    List.of(),
                    sanitizarDetalhe(truncar(htmlPasso2)),
                    trilha.passos());
        } catch (Exception e) {
            log.warn("Falha ao preparar inicial PROJUDI (credencialId={}): {}", credencialId, e.getMessage());
            trilha.falhaSemResposta("EXCECAO", e.getClass().getSimpleName() + ": " + e.getMessage());
            return new ResultadoPreparacaoInicial(
                    false,
                    "EXCECAO",
                    null,
                    List.of(),
                    sanitizarDetalhe(e.getClass().getSimpleName() + ": " + e.getMessage()),
                    trilha.passos());
        }
    }

    private TokensFluxo inserirParte(
            Long credencialId,
            String valorCausa,
            ProjudiClasseProcessoInicial classe,
            ProjudiPrioridadeProcessoInicial prioridade,
            TokensFluxo tokens,
            int parteTipo,
            ParteProjudiResolvida parte,
            String papel,
            TrilhaExecucao trilha)
            throws Exception {
        String localizar =
                parteTipo == 0 ? "&imaLocalizarPartePromovido=" : "&imaLocalizarPartePromovente=";
        HttpResponse<String> abrir = postProcessoCivelComTrilha(
                trilha,
                "Parte " + papel + " abrir busca",
                credencialId,
                ProjudiProcessoCivelInicialCorpoUtil.montarCorpoAbrirBuscaParte(
                        valorCausa, parteTipo, localizar, classe, prioridade),
                REF_PROCESSO_CIVEL);
        if (pareceFalhaPost(abrir)) {
            trilha.falha("Parte " + papel + " abrir busca", abrir, truncar(corpo(abrir)));
            return null;
        }
        trilha.ok("Parte " + papel + " abrir busca", abrir, "Formulário de busca aberto");
        registrarHashFluxoHtml(trilha, "Parte " + papel + " abrir busca", corpo(abrir));

        TokensFluxo tBusca = ProjudiProcessoCivelHtmlUtil.extrairTokens(corpo(abrir));
        String hash = coalesce(tBusca.hash(), tokens != null ? tokens.hash() : null);
        String hashParte = coalesce(tBusca.hashParte(), tokens != null ? tokens.hashParte() : null);
        if (!StringUtils.hasText(hash) || !StringUtils.hasText(hashParte)) {
            trilha.falha("Parte " + papel + " tokens", abrir, "Hash/HashParte ausentes");
            return null;
        }

        boolean cnpj = "CNPJ".equalsIgnoreCase(parte.tipoDoc());
        String docBusca = cnpj
                ? ProjudiProcessoCivelHtmlUtil.formatarCnpjBusca(parte.documento())
                : ProjudiProcessoCivelHtmlUtil.formatarCpfBusca(parte.documento());
        String corpoBusca = "PassoEditar=2&ParteTipo="
                + parteTipo
                + "&__Pedido__=null&Hash="
                + encIso(hash)
                + "&HashParte="
                + encIso(hashParte)
                + "&filtroCpfCnpj="
                + (cnpj ? "cnpj" : "cpf")
                + "&cpf="
                + (cnpj ? "" : encIso(docBusca))
                + "&cnpj="
                + (cnpj ? encIso(docBusca) : "")
                + "&Rg=&Ctps=&TituloEleitor=&Pis=&imgSubmeter=Buscar";

        HttpResponse<String> busca = postProcessoCivelComTrilha(
                trilha, "Parte " + papel + " busca", credencialId, corpoBusca, REF_PROCESSO_CIVEL);
        if (pareceFalhaPost(busca)) {
            trilha.falha("Parte " + papel + " busca", busca, truncar(corpo(busca)));
            return null;
        }
        trilha.ok("Parte " + papel + " busca", busca, "Busca por documento");
        registrarHashFluxoHtml(trilha, "Parte " + papel + " busca", corpo(busca));

        String uf = ProjudiUfPorExtensoUtil.siglaPorNomeExtenso(parte.estado().labelProjudi());
        if (uf == null) {
            uf = "GO";
        }
        String corpoInsert = montarCorpoInsertParte(parteTipo, hash, hashParte, parte, uf);
        HttpResponse<String> insert = postProcessoCivelComTrilha(
                trilha, "Parte " + papel + " insert", credencialId, corpoInsert, REF_PROCESSO_CIVEL);
        if (pareceFalhaPost(insert)) {
            trilha.falha("Parte " + papel + " insert", insert, truncar(corpo(insert)));
            return null;
        }
        trilha.ok("Parte " + papel + " insert", insert, "Parte inserida");
        registrarHashFluxoHtml(trilha, "Parte " + papel + " insert", corpo(insert));
        return ProjudiProcessoCivelHtmlUtil.extrairTokens(corpo(insert));
    }

    private static String montarCorpoInsertParte(
            int parteTipo, String hash, String hashParte, ParteProjudiResolvida p, String uf) {
        boolean cnpj = "CNPJ".equalsIgnoreCase(p.tipoDoc());
        StringBuilder sb = new StringBuilder();
        sb.append("Hash=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(hash));
        sb.append("&HashParte=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(hashParte));
        sb.append("&PaginaAtual=-1&PassoEditar=3&ParteTipo=").append(parteTipo);
        sb.append("&__Pedido__=null&parteEnderecoDesconhecido=false&justificandoCpfCnpj=false");
        sb.append("&parteLocomocoes=null&pessoaFisica=&tentativaSubmissao=0");
        sb.append("&Nome=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(p.nome()));
        if (cnpj) {
            sb.append("&Cnpj=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(digitos(p.documento())));
        } else {
            sb.append("&Cpf=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(digitos(p.documento())));
        }
        sb.append("&Telefone=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(texto(p.telefone())));
        sb.append("&Celular=&EMail=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(texto(p.email())));
        sb.append("&Logradouro=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(p.logradouro()));
        sb.append("&Numero=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(p.numero()));
        sb.append("&Complemento=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(texto(p.complemento())));
        sb.append("&Estado=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(p.estado().labelProjudi()));
        sb.append("&UF=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(uf));
        sb.append("&Id_Estado=").append(p.estado().idProjudi());
        sb.append("&BairroCidade=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(p.cidade().labelProjudi()));
        sb.append("&Id_BairroCidade=").append(p.cidade().idProjudi());
        sb.append("&Bairro=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(p.bairro().labelProjudi()));
        sb.append("&Id_Bairro=").append(p.bairro().idProjudi());
        sb.append("&Cep=").append(ProjudiProcessoCivelInicialCorpoUtil.encIso(digitos(p.cep())));
        sb.append("&imgInserir=Inserir");
        return sb.toString();
    }

    private HttpResponse<String> postProcessoCivelComTrilha(
            TrilhaExecucao trilha, String passo, Long credencialId, String corpo, String referer) {
        if (trilha != null) {
            trilha.registrarInstrumentacao("Corpo " + passo, sanitizarDetalhe(corpo, HASH_DIAG_MAX));
        }
        return postProcessoCivel(credencialId, corpo, referer);
    }

    /**
     * Resolve o {@code Id_ProcessoPrioridade} de «Maior de 60 Anos» a partir do HTML do PROJUDI.
     * O id {@code 6} do rascunho manual (.projudi) corresponde a «Réu Preso» na Vara Cível — não reutilizar fixo.
     */
    private Optional<ProjudiPrioridadeProcessoInicial> resolverPrioridadePasso1(
            TrilhaExecucao trilha,
            InicialRequest request,
            String htmlReferencia,
            Long credencialId) {
        if (!Boolean.TRUE.equals(request.prioridadeMaior60Anos())) {
            return Optional.of(request.prioridadeEfetiva());
        }

        trilha.registrarInstrumentacao(
                "Prioridades HTML custas",
                ProjudiProcessoCivelHtmlUtil.formatarOpcoesProcessoPrioridade(htmlReferencia));

        Optional<Integer> idResolvido = ProjudiProcessoCivelHtmlUtil.idProcessoPrioridadePorRotulo(
                htmlReferencia, ProjudiPrioridadeProcessoInicial.MAIOR_60_ANOS.rotulo());

        if (idResolvido.isEmpty()) {
            String corpoProbe = ProjudiProcessoCivelInicialCorpoUtil.montarCorpoPasso1Area(
                    request.valorCausa(),
                    "2852",
                    "-1",
                    request.classeEfetiva(),
                    ProjudiPrioridadeProcessoInicial.NORMAL);
            HttpResponse<String> probePasso1 = postProcessoCivelComTrilha(
                    trilha, "POST Passo1 probe prioridade", credencialId, corpoProbe, REF_PROCESSO_CIVEL);
            if (!pareceFalhaPost(probePasso1)) {
                String htmlProbe = corpo(probePasso1);
                trilha.registrarInstrumentacao(
                        "Prioridades HTML probe Passo1",
                        ProjudiProcessoCivelHtmlUtil.formatarOpcoesProcessoPrioridade(htmlProbe)
                                + " | trecho="
                                + ProjudiProcessoCivelHtmlUtil.extrairTrechoPrioridade(htmlProbe));
                idResolvido = ProjudiProcessoCivelHtmlUtil.idProcessoPrioridadePorRotulo(
                        htmlProbe, ProjudiPrioridadeProcessoInicial.MAIOR_60_ANOS.rotulo());
            } else {
                trilha.falha("POST Passo1 probe prioridade", probePasso1, "Falha ao carregar opções de prioridade.");
            }
        }

        if (idResolvido.isEmpty()) {
            trilha.falhaSemResposta(
                    "Prioridade Passo1",
                    "Não foi possível mapear «Maior de 60 Anos» no select Id_ProcessoPrioridade do PROJUDI.");
            return Optional.empty();
        }

        ProjudiPrioridadeProcessoInicial prioridade =
                request.prioridadeEfetiva(idResolvido.get());
        trilha.okSemResposta(
                "Prioridade Passo1",
                "Maior de 60 Anos → Id_ProcessoPrioridade=" + prioridade.idProcessoPrioridade());
        return Optional.of(prioridade);
    }

    private HttpResponse<String> postProcessoCivel(Long credencialId, String corpo, String referer) {
        return sessionService.postPeticionamento(
                credencialId, "ProcessoCivel", null, corpo, StandardCharsets.ISO_8859_1, referer);
    }

    private ResultadoDistribuicaoInicial processarRedirectPosDistribuicao(
            TrilhaExecucao trilha,
            Long credencialId,
            Long processoIdOrigem,
            HttpResponse<String> respDist,
            int statusDist,
            String location) {
        String classificacao =
                ProjudiProcessoCivelRevisaoHtmlUtil.rotuloClassificacaoRedirect302Distribuicao(location);
        trilha.registrarDiagnostico(
                "302 classificação", "Location=" + location + " | classificação=" + classificacao);

        if (ProjudiProcessoCivelRevisaoHtmlUtil.pareceRedirect302DescarteUsuario(location)) {
            trilha.registrar(
                    "POST Passo3 distribuir",
                    respDist,
                    false,
                    statusDist + " redirect DESCARTE — volta à Área do Advogado");
            String trechoDestino = lerTrechoDestino302(trilha, credencialId, location);
            log.warn(
                    "PROJUDI inicial distribuição DESCARTADA (credencialId={}, Location={}).",
                    credencialId,
                    location);
            String respostaBruta = montarRespostaDiagnostico302(statusDist, location, trechoDestino);
            return new ResultadoDistribuicaoInicial(
                    false,
                    "DISTRIBUIR",
                    null,
                    false,
                    sanitizarDetalhe(respostaBruta, RESPOSTA_DIAGNOSTICO_MAX),
                    trilha.passos());
        }

        trilha.registrar(
                "POST Passo3 distribuir",
                respDist,
                false,
                statusDist + " redirect SUCESSO_PROVAVEL — lendo destino (POST não será reenviado)");

        String caminhoGet = ProjudiProcessoCivelRevisaoHtmlUtil.caminhoGetPosRedirect(location);
        if (!StringUtils.hasText(caminhoGet)) {
            trilha.registrarDiagnostico("Destino 302", "(Location não parseável para GET)");
            return falhaDistribuicaoAmbigua302(trilha, credencialId, statusDist, location, "(Location não parseável para GET)");
        }

        var paginaDestino = sessionService.getAutenticadoComReferer(credencialId, caminhoGet, REF_PROCESSO_CIVEL);
        if (pareceFalhaLeitura(paginaDestino.statusCode(), paginaDestino.body())) {
            String trechoDestino = "Falha ao ler destino (status=" + paginaDestino.statusCode() + ")";
            trilha.falha("GET destino 302", paginaDestino, trechoDestino);
            return falhaDistribuicaoAmbigua302(trilha, credencialId, statusDist, location, trechoDestino);
        }

        String htmlDestino = paginaDestino.body();
        trilha.registrarDiagnostico(
                "Destino 302",
                ProjudiProcessoCivelRevisaoHtmlUtil.extrairTrechoDiagnosticoDestino302(htmlDestino));

        Optional<ExtracaoNumero> numeroOpt =
                ProjudiProcessoCivelRevisaoHtmlUtil.extrairNumeroProcessoGerado(htmlDestino, location);
        if (numeroOpt.isPresent()) {
            ExtracaoNumero numero = numeroOpt.get();
            trilha.ok("GET destino 302", paginaDestino, "CNJ extraído: " + numero.numero());
            trilha.okSemResposta("Número extraído", numero.detalhe() + " → " + numero.numero());
            trilha.registrar(
                    "POST Passo3 distribuir",
                    respDist,
                    true,
                    statusDist + " redirect SUCESSO — CNJ confirmado no destino");
            boolean gravado = gravarNumeroNoProcesso(processoIdOrigem, numero.numero());
            log.info(
                    "PROJUDI inicial DISTRIBUIDA via 302 (credencialId={}, numero={}, processoIdOrigem={}, gravado={}, Location={}).",
                    credencialId,
                    numero.numero(),
                    processoIdOrigem,
                    gravado,
                    location);
            return new ResultadoDistribuicaoInicial(
                    true,
                    "DISTRIBUIDO",
                    numero.numero(),
                    gravado,
                    sanitizarDetalhe(truncar(htmlDestino)),
                    trilha.passos());
        }

        String trechoDestino =
                ProjudiProcessoCivelRevisaoHtmlUtil.extrairTrechoDiagnosticoDestino302(htmlDestino);
        return falhaDistribuicaoAmbigua302(trilha, credencialId, statusDist, location, trechoDestino);
    }

    private String lerTrechoDestino302(TrilhaExecucao trilha, Long credencialId, String location) {
        if (!StringUtils.hasText(location)) {
            trilha.registrarDiagnostico("Destino 302", "(header Location ausente)");
            return "(header Location ausente)";
        }
        String caminhoGet = ProjudiProcessoCivelRevisaoHtmlUtil.caminhoGetPosRedirect(location);
        if (!StringUtils.hasText(caminhoGet)) {
            trilha.registrarDiagnostico("Destino 302", "(Location não parseável para GET)");
            return "(Location não parseável para GET)";
        }
        var paginaDestino = sessionService.getAutenticadoComReferer(credencialId, caminhoGet, REF_PROCESSO_CIVEL);
        if (pareceFalhaLeitura(paginaDestino.statusCode(), paginaDestino.body())) {
            String trechoDestino = "Falha ao ler destino (status=" + paginaDestino.statusCode() + ")";
            trilha.falha("GET destino 302", paginaDestino, trechoDestino);
            return trechoDestino;
        }
        String trechoDestino =
                ProjudiProcessoCivelRevisaoHtmlUtil.extrairTrechoDiagnosticoDestino302(paginaDestino.body());
        trilha.registrarDiagnostico("Destino 302", trechoDestino);
        return trechoDestino;
    }

    private ResultadoDistribuicaoInicial falhaDistribuicaoAmbigua302(
            TrilhaExecucao trilha,
            Long credencialId,
            int statusDist,
            String location,
            String trechoDestino) {
        String msg =
                "302 não-descarte sem CNJ reconhecido — CONFERIR MANUALMENTE no PROJUDI antes de redistribuir";
        log.warn(
                "PROJUDI inicial 302 ambíguo (credencialId={}, Location={}, trecho={})",
                credencialId,
                location,
                trechoDestino);
        trilha.falhaSemResposta("POST Passo3 distribuir", msg);
        String respostaBruta = montarRespostaDiagnostico302Ambiguo(statusDist, location, trechoDestino);
        return falhaDistribuicao("DISTRIBUIR", msg, respostaBruta, trilha);
    }

    private boolean gravarNumeroNoProcesso(Long processoIdOrigem, String numeroProcessoGerado) {
        if (processoIdOrigem == null || !StringUtils.hasText(numeroProcessoGerado)) {
            return false;
        }
        Optional<ProcessoEntity> opt = processoRepository.findById(processoIdOrigem);
        if (opt.isEmpty()) {
            log.warn("processoIdOrigem={} não encontrado — número {} não gravado.", processoIdOrigem, numeroProcessoGerado);
            return false;
        }
        ProcessoEntity processo = opt.get();
        processo.setNumeroCnj(numeroProcessoGerado.trim());
        processoRepository.save(processo);
        return true;
    }

    private static ResultadoDistribuicaoInicial falhaDistribuicao(
            String passoAlcancado, String msg, String bruta, TrilhaExecucao trilha) {
        String resposta =
                sanitizarDetalhe(truncar(msg + (bruta != null && !bruta.isBlank() ? "\n" + bruta : "")));
        return new ResultadoDistribuicaoInicial(false, passoAlcancado, null, false, resposta, trilha.passos());
    }

    private static ResultadoPreparacaoInicial falha(
            String passoAlcancado,
            String msg,
            String bruta,
            List<PendenciaParte> pendencias,
            TrilhaExecucao trilha,
            String nomePassoLog,
            Object resp) {
        if (trilha != null && StringUtils.hasText(nomePassoLog)) {
            String detalhe = msg;
            if (StringUtils.hasText(bruta)) {
                detalhe = msg + " — " + truncar(bruta);
            }
            if (resp instanceof RespostaProjudi rp) {
                trilha.falha(nomePassoLog, rp, detalhe);
            } else if (resp instanceof HttpResponse<?> hr) {
                @SuppressWarnings("unchecked")
                HttpResponse<String> hs = (HttpResponse<String>) hr;
                trilha.falha(nomePassoLog, hs, detalhe);
            } else {
                trilha.falhaSemResposta(nomePassoLog, detalhe);
            }
        }
        String resposta =
                sanitizarDetalhe(truncar(msg + (bruta != null && !bruta.isBlank() ? "\n" + bruta : "")));
        return new ResultadoPreparacaoInicial(
                false,
                passoAlcancado,
                null,
                pendencias != null ? pendencias : List.of(),
                resposta,
                trilha != null ? trilha.passos() : List.of());
    }

    static String sanitizarDetalhe(String raw) {
        return sanitizarDetalhe(raw, DETALHE_MAX);
    }

    static String sanitizarDetalhe(String raw, int maxLen) {
        if (!StringUtils.hasText(raw)) {
            return "";
        }
        String s = SENSIVEL_DETALHE.matcher(raw).replaceAll("$1=[REDACTED]");
        if (s.length() > maxLen) {
            return s.substring(0, maxLen - 3) + "...";
        }
        return s;
    }

    private static boolean pareceRedirectPost(int status) {
        return status == 301 || status == 302 || status == 303 || status == 307 || status == 308;
    }

    private static String montarRespostaDiagnostico302(int status, String location, String trechoDestino) {
        StringBuilder sb = new StringBuilder();
        sb.append("HTTP ").append(status).append(" — redirect DESCARTE (processo NÃO confirmado)\n");
        sb.append("Location: ").append(location != null ? location : "").append('\n');
        sb.append("Destino: ").append(trechoDestino != null ? trechoDestino : "");
        return sb.toString();
    }

    private static String montarRespostaDiagnostico302Ambiguo(int status, String location, String trechoDestino) {
        StringBuilder sb = new StringBuilder();
        sb.append("HTTP ")
                .append(status)
                .append(" — redirect não-descarte, CNJ NÃO confirmado (não redistribuir)\n");
        sb.append("Location: ").append(location != null ? location : "").append('\n');
        sb.append("Destino: ").append(trechoDestino != null ? trechoDestino : "");
        return sb.toString();
    }

    private static void registrarHashFluxoHtml(TrilhaExecucao trilha, String passo, String html) {
        if (trilha == null || !StringUtils.hasText(html)) {
            return;
        }
        trilha.registrarInstrumentacao(passo, ProjudiProcessoCivelHtmlUtil.formatarLinhaHashFluxoHtml(html));
    }

    private static String nvDiag(String valor) {
        return StringUtils.hasText(valor) ? valor.trim() : "(ausente)";
    }

    private static String corpo(HttpResponse<String> resp) {
        return resp == null || resp.body() == null ? "" : resp.body();
    }

    private static String digitos(String s) {
        return s == null ? "" : s.replaceAll("\\D+", "");
    }

    private static String texto(String s) {
        return s == null ? "" : s.trim();
    }

    private static String coalesce(String a, String b) {
        return StringUtils.hasText(a) ? a : b;
    }

    private static String encIso(String valor) {
        if (valor == null) {
            return "";
        }
        return URLEncoder.encode(valor, StandardCharsets.ISO_8859_1);
    }

    private static String truncar(String bruta) {
        return ProjudiPeticaoService.truncarRespostaBruta(bruta);
    }

    private static boolean pareceFalhaLeitura(int status, String body) {
        if (status < 200 || status >= 400) {
            return true;
        }
        return ProjudiSessionService.pareceNaoLogado(body);
    }

    private static boolean parecePostDistribuicaoAceito(HttpResponse<String> resp) {
        if (resp == null) {
            return false;
        }
        int status = resp.statusCode();
        if (pareceRedirectPost(status)) {
            return false;
        }
        if (status < 200 || status >= 500) {
            return false;
        }
        return !ProjudiSessionService.pareceNaoLogado(corpo(resp));
    }

    private static boolean pareceFalhaPost(HttpResponse<String> resp) {
        if (resp == null) {
            return true;
        }
        int status = resp.statusCode();
        if (status < 200 || status >= 500) {
            return true;
        }
        return ProjudiSessionService.pareceNaoLogado(corpo(resp));
    }
}
