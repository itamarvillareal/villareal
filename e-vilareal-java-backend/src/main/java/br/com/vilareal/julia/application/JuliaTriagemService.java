package br.com.vilareal.julia.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.ClaudeApiService;
import br.com.vilareal.julia.domain.JuliaPrazoDateUtil;
import br.com.vilareal.julia.domain.JuliaStatusCaixa;
import br.com.vilareal.julia.infrastructure.persistence.entity.JuliaTriagemEntity;
import br.com.vilareal.julia.infrastructure.persistence.repository.JuliaTriagemRepository;
import br.com.vilareal.agenda.api.dto.AgendaEventoWriteRequest;
import br.com.vilareal.agenda.application.AgendaApplicationService;
import br.com.vilareal.julia.triagem.TriagemEnactOpcoes;
import br.com.vilareal.julia.triagem.TriagemResultado;
import br.com.vilareal.julia.triagem.TriagemRunResponse;
import br.com.vilareal.julia.api.dto.JuliaBacklogAnaliseResponse;
import br.com.vilareal.julia.api.dto.JuliaBacklogAnaliseResponse.JuliaBacklogAnaliseItem;
import br.com.vilareal.julia.api.dto.JuliaBacklogJanelaResponse;
import br.com.vilareal.julia.api.dto.JuliaBacklogJanelaResponse.JuliaBacklogJanelaItem;
import br.com.vilareal.processo.api.dto.ProcessoAndamentoWriteRequest;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.api.dto.ProcessoPrazoWriteRequest;
import br.com.vilareal.processo.api.dto.ProcessoResponse;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.application.ProcessoDiagnosticoNumeroBuscaUtil;
import br.com.vilareal.processo.domain.ProcessoAtivoUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoPrazoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import br.com.vilareal.usuario.application.JuliaAssistenteContextService;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import br.com.vilareal.usuario.model.TipoUsuario;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.ObjectProvider;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.BigInteger;
import java.math.RoundingMode;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.Set;

@Service
public class JuliaTriagemService {

    private static final Logger log = LoggerFactory.getLogger(JuliaTriagemService.class);

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter FMT_DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final int MAX_TRIAGENS_ANTERIORES = 10;
    private static final int MAX_HISTORICO_RECENTES = 30;
    private static final int MAX_HISTORICO_ANTIGOS = 5;
    private static final int MAX_DETALHE_HISTORICO = 400;

    static final String ORIGEM_ANDAMENTO_TRIAGEM = "JULIA_TRIAGEM";
    static final String ORIGEM_AGENDA_PRAZO_TRIAGEM = "julia-triagem-prazo";
    static final String ORIGEM_AGENDA_AUDIENCIA_TRIAGEM = "processos-audiencia";
    static final String OBS_CAIXA_SEM_RESPONSAVEL_AGENDA = "Sem responsável — agenda não criada";
    static final int MAX_CLASSIFICACAO_COL = 255;
    static final int DEDUP_TRIAGEM_HORAS = 72;
    static final int DEDUP_ANDAMENTO_HORAS = 168;

    static final String SYSTEM_PROMPT_TRIAGEM =
            """
            Você é Júlia, advogada assistente do escritório Villa Real. Faça triagem PROFISSIONAL de uma \
            movimentação: leia o e-mail, cruze com os PDFs da pasta Movimentações (quando fornecidos) e o \
            histórico do processo. Responda SOMENTE com JSON puro (sem markdown).
            PROIBIDO entregar classificação genérica copiada do aviso do PROJUDI (ex.: apenas \
            "Intimação/citação" ou "Informação de intimação/citação"). O resumo deve explicar o ATO \
            concreto (despacho, certidão, designação de audiência, sentença, etc.) com fatos extraídos dos \
            documentos.
            - classificacao: rótulo jurídico específico do ato (ex.: "Designação de audiência de instrução \
            e julgamento — videoconferência Zoom").
            - resumo: 2–4 frases objetivas; cite partes, datas, horas, prazos e consequências práticas para \
            o cliente do escritório (papelCliente no contexto).
            - impactoCliente: FAVORAVEL | DESFAVORAVEL | NEUTRO | INDEFINIDO + baseImpacto fundamentada.
            - prazo.natureza: ATIVO só se o prazo já corre; CONDICIONAL se depende de evento futuro. \
            Sentença/acordo extintivo sem prazo novo → prazo.existe=false.
            - audiencia: preencha quando houver designação/agendamento de audiência nos PDFs ou no teor; \
            data/hora em ISO (AAAA-MM-DD e HH:mm). Se o e-mail só avisa e o PDF confirma a audiência, use \
            os dados do PDF. confianca 0..1 para audiência.
            - providenciaCliente: texto (nunca boolean). acaoSugerida: próximo passo do escritório.
            - confianca geral: baixa se faltar PDF citado no e-mail ou texto ilegível.
            - Não repita análise idêntica já feita pela Júlia no histórico recente (mesmo fato).
            Schema: {classificacao, resumo, impactoCliente, baseImpacto, prazo:{existe, natureza, tipo, \
            gatilho, diasUteis, dataReal, dataTrabalho}, providenciaCliente, prioridade, acaoSugerida, \
            confianca, audiencia:{existe, data, hora, tipo, meio, confianca}}""";

    private final ClaudeApiService claudeApiService;
    private final ObjectMapper objectMapper;
    private final PublicacaoRepository publicacaoRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final ProcessoPrazoRepository prazoRepository;
    private final ProcessoAndamentoRepository andamentoRepository;
    private final JuliaTriagemRepository juliaTriagemRepository;
    private final JuliaAssistenteContextService juliaAssistenteContextService;
    private final AgendaApplicationService agendaApplicationService;
    private final UsuarioRepository usuarioRepository;
    private final JuliaTriagemContextoDriveService contextoDriveService;
    private final String modelo;
    private final boolean triagemAutoEnabled;
    private final double audienciaConfiancaMinima;
    private final ObjectProvider<JuliaTriagemService> self;

    public JuliaTriagemService(
            ClaudeApiService claudeApiService,
            ObjectMapper objectMapper,
            PublicacaoRepository publicacaoRepository,
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService,
            ProcessoPrazoRepository prazoRepository,
            ProcessoAndamentoRepository andamentoRepository,
            JuliaTriagemRepository juliaTriagemRepository,
            JuliaAssistenteContextService juliaAssistenteContextService,
            AgendaApplicationService agendaApplicationService,
            UsuarioRepository usuarioRepository,
            JuliaTriagemContextoDriveService contextoDriveService,
            ObjectProvider<JuliaTriagemService> self,
            @Value("${anthropic.api.model}") String modelo,
            @Value("${julia.triagem.auto.enabled:false}") boolean triagemAutoEnabled,
            @Value("${julia.triagem.audiencia.confianca-minima:0.72}") double audienciaConfiancaMinima) {
        this.claudeApiService = claudeApiService;
        this.objectMapper = objectMapper;
        this.publicacaoRepository = publicacaoRepository;
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
        this.prazoRepository = prazoRepository;
        this.andamentoRepository = andamentoRepository;
        this.juliaTriagemRepository = juliaTriagemRepository;
        this.juliaAssistenteContextService = juliaAssistenteContextService;
        this.agendaApplicationService = agendaApplicationService;
        this.usuarioRepository = usuarioRepository;
        this.contextoDriveService = contextoDriveService;
        this.self = self;
        this.modelo = modelo;
        this.triagemAutoEnabled = triagemAutoEnabled;
        this.audienciaConfiancaMinima = audienciaConfiancaMinima;
    }

    /**
     * Triagem manual a partir de um processo (UI ou API). Exige publicação vinculada ao processo;
     * com {@code publicacaoId} omitido, usa a publicação mais recente do processo.
     *
     * @param forcar remove {@code julia_triagem} existente da publicação antes de reexecutar (ex.: PDFs
     *     novos no Drive após a triagem automática).
     */
    @Transactional
    public TriagemRunResponse triarPublicacaoNoProcesso(
            Long processoId, Long publicacaoId, boolean dryRun, boolean forcar) {
        if (processoId == null || processoId < 1) {
            throw new BusinessRuleException("processoId inválido.");
        }
        ProcessoEntity processo = processoRepository
                .findById(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        if (!ProcessoAtivoUtil.processoEstaAtivo(processo)) {
            throw new BusinessRuleException("Processo inativo — triagem manual não permitida.");
        }

        final PublicacaoEntity publicacao;
        if (publicacaoId != null) {
            publicacao = publicacaoRepository
                    .findById(publicacaoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Publicação não encontrada: " + publicacaoId));
            Long processoDaPublicacao =
                    publicacao.getProcesso() != null ? publicacao.getProcesso().getId() : null;
            if (!processoId.equals(processoDaPublicacao)) {
                throw new BusinessRuleException(
                        "Publicação id=" + publicacaoId + " não está vinculada ao processo id=" + processoId + ".");
            }
        } else {
            publicacao = publicacaoRepository
                    .findTop1ByProcesso_IdOrderByCreatedAtDescIdDesc(processoId)
                    .orElseThrow(() -> new BusinessRuleException(
                            "Processo id=" + processoId + " não possui publicação vinculada para triagem."));
        }
        final Long publicacaoIdEfetivo = publicacao.getId();

        if (!StringUtils.hasText(publicacao.getTeor())) {
            throw new BusinessRuleException(
                    "Publicação id=" + publicacaoIdEfetivo + " sem teor — não é possível triar.");
        }

        if (forcar) {
            juliaTriagemRepository.findByPublicacao_Id(publicacaoIdEfetivo).ifPresent(existing -> {
                juliaTriagemRepository.delete(existing);
                log.info(
                        "Julia triagem manual: registro anterior removido (triagemId={}, publicacaoId={})",
                        existing.getId(),
                        publicacaoIdEfetivo);
            });
        }

        log.info(
                "Julia triagem manual processoId={} publicacaoId={} dryRun={} forcar={}",
                processoId,
                publicacaoIdEfetivo,
                dryRun,
                forcar);
        return triarComOpcoes(null, null, publicacaoIdEfetivo, processoId, !dryRun, !dryRun);
    }

    /**
     * Gatilho pós-vínculo (ingestão/UI). Nunca propaga erro — falha de triagem não afeta ingestão.
     */
    public void triarPublicacaoSeElegivel(Long publicacaoId) {
        if (!triagemAutoEnabled) {
            log.debug(
                    "Julia auto-triagem desabilitada (julia.triagem.auto.enabled=false), publicacaoId={}",
                    publicacaoId);
            return;
        }
        if (publicacaoId == null || publicacaoId < 1) {
            log.warn("Julia auto-triagem: publicacaoId inválido ({})", publicacaoId);
            return;
        }
        try {
            if (!publicacaoRepository.existsById(publicacaoId)) {
                log.warn("Julia auto-triagem: publicação id={} não encontrada", publicacaoId);
                return;
            }
            Optional<Long> processoIdOpt = publicacaoRepository.findProcessoIdByPublicacaoId(publicacaoId);
            if (processoIdOpt.isEmpty()) {
                log.info("Julia auto-triagem: publicação id={} sem processo vinculado — ignorada", publicacaoId);
                return;
            }
            Long processoId = processoIdOpt.get();
            ProcessoEntity processo = processoRepository.findById(processoId).orElse(null);
            if (!ProcessoAtivoUtil.processoEstaAtivo(processo)) {
                log.info(
                        "Julia auto-triagem: publicacaoId={} processo Status=Inativo (processoId={}), pulando",
                        publicacaoId,
                        processoId);
                return;
            }
            if (juliaTriagemRepository.findByPublicacao_Id(publicacaoId).isPresent()) {
                log.info("Julia auto-triagem: publicação id={} já triada — ignorada", publicacaoId);
                return;
            }

            TriagemRunResponse resp =
                    self.getObject().triarComOpcoes(null, null, publicacaoId, null, false, true);
            log.info(
                    "Julia auto-triagem concluída publicacaoId={} andamentoId={} prazoId={} agendaEventoId={}",
                    publicacaoId,
                    resp.andamentoId(),
                    resp.prazoId(),
                    resp.agendaEventoId());
        } catch (Exception ex) {
            log.error(
                    "Julia auto-triagem falhou publicacaoId={}: {}",
                    publicacaoId,
                    ex.getMessage(),
                    ex);
        }
    }

    @Transactional
    public TriagemResultado triar(
            String teor,
            String cnj,
            Long publicacaoId,
            Long processoIdHint,
            boolean persistir) {
        PublicacaoEntity publicacao = null;
        String teorEfetivo = teor;
        String cnjEfetivo = cnj;

        if (publicacaoId != null) {
            publicacao =
                    publicacaoRepository.findById(publicacaoId).orElseThrow(() -> new ResourceNotFoundException(
                            "Publicação não encontrada: " + publicacaoId));
            if (StringUtils.hasText(publicacao.getTeor())) {
                teorEfetivo = publicacao.getTeor();
            }
            if (StringUtils.hasText(publicacao.getNumeroProcessoEncontrado())) {
                cnjEfetivo = publicacao.getNumeroProcessoEncontrado();
            }
        }

        if (!StringUtils.hasText(teorEfetivo)) {
            throw new BusinessRuleException("Teor da movimentação é obrigatório.");
        }

        Long processoId = resolverProcessoId(publicacao, processoIdHint, cnjEfetivo);
        String contexto = montarContexto(teorEfetivo, cnjEfetivo, publicacao, processoId, null);

        String respostaIA = claudeApiService.enviarMensagem(SYSTEM_PROMPT_TRIAGEM, contexto);
        TriagemResultado parseado = parsearResposta(respostaIA);
        TriagemResultado resultado = normalizarPrazo(parseado);

        if (persistir) {
            persistirTriagem(publicacao, processoId, resultado);
        }

        return resultado;
    }

    @Transactional
    public TriagemRunResponse triarComOpcoes(
            String teor,
            String cnj,
            Long publicacaoId,
            Long processoIdHint,
            boolean persistir,
            boolean enact) {
        if (enact) {
            return triarEnact(teor, cnj, publicacaoId, processoIdHint);
        }
        TriagemResultado resultado = triar(teor, cnj, publicacaoId, processoIdHint, persistir);
        return TriagemRunResponse.dryRun(resultado);
    }

    @Transactional
    public TriagemRunResponse triarEnact(
            String teor, String cnj, Long publicacaoId, Long processoIdHint) {
        return triarEnact(teor, cnj, publicacaoId, processoIdHint, TriagemEnactOpcoes.padrao());
    }

    @Transactional
    public TriagemRunResponse triarEnact(
            String teor,
            String cnj,
            Long publicacaoId,
            Long processoIdHint,
            TriagemEnactOpcoes opcoes) {
        TriagemEnactOpcoes efectivas = opcoes != null ? opcoes : TriagemEnactOpcoes.padrao();
        if (publicacaoId != null) {
            Optional<JuliaTriagemEntity> existente = juliaTriagemRepository.findByPublicacao_Id(publicacaoId);
            if (existente.isPresent()) {
                TriagemResultado resultado = carregarResultadoPersistido(existente.get());
                return TriagemRunResponse.idempotente(resultado);
            }
        }

        PublicacaoEntity publicacao = null;
        if (publicacaoId != null) {
            publicacao = publicacaoRepository
                    .findById(publicacaoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Publicação não encontrada: " + publicacaoId));
        }

        TriagemResultado resultado =
                triarComContexto(teor, cnj, publicacaoId, processoIdHint, efectivas.contextoAdicional());
        String cnjEfetivo = cnj;
        if (publicacao != null && StringUtils.hasText(publicacao.getNumeroProcessoEncontrado())) {
            cnjEfetivo = publicacao.getNumeroProcessoEncontrado();
        }
        Long processoId = resolverProcessoId(publicacao, processoIdHint, cnjEfetivo);
        if (processoId == null) {
            throw new BusinessRuleException(
                    "Enactment exige processo vinculado (publicação com processo_id ou CNJ unívoco).");
        }

        Optional<TriagemResultado> dupSemantica =
                buscarTriagemSemanticaRecente(processoId, publicacaoId, publicacao, resultado);
        if (dupSemantica.isPresent()) {
            log.info(
                    "Julia triagem semântica duplicada ignorada (processoId={}, publicacaoId={})",
                    processoId,
                    publicacaoId);
            return TriagemRunResponse.idempotenteSemantica(dupSemantica.get());
        }

        JuliaTriagemEntity triagem = persistirTriagem(publicacao, processoId, resultado);

        return juliaAssistenteContextService.executarComoJulia(() -> {
            EnactmentIds ids =
                    aplicarTriagem(processoId, resultado, publicacaoId, efectivas.analiseSemPrazo());
            marcarCaixaSeAgendaOmitida(triagem, ids);
            return TriagemRunResponse.enact(
                    resultado,
                    ids.andamentoId(),
                    ids.prazoId(),
                    ids.agendaEventoId(),
                    ids.prazoFatalCabecalhoAtualizado(),
                    ids.duplicataPrazo(),
                    false,
                    ids.duplicataAndamento(),
                    ids.audienciaProcessoAtualizada(),
                    ids.agendaAudienciaReplicada());
        });
    }

    /**
     * Backlog: processos <strong>ativos</strong> com {@code prazo_fatal} vencido e publicação vinculada —
     * triagem + andamento + caixa, sem criar prazo/agenda ({@link TriagemEnactOpcoes#analiseSemPrazo()}).
     */
    public JuliaBacklogAnaliseResponse analisarBacklogPrazoFatalVencidos() {
        LocalDate hoje = LocalDate.now(ZONA_BR);
        List<Long> processoIds = processoRepository.findIdsComPrazoFatalVencidoComPublicacao(hoje);
        List<JuliaBacklogAnaliseItem> itens = new ArrayList<>();
        int analisados = 0;
        int cards = 0;
        int idempotentes = 0;
        int erros = 0;

        for (Long processoId : processoIds) {
            ProcessoEntity processo = processoRepository.findById(processoId).orElse(null);
            if (!ProcessoAtivoUtil.processoEstaAtivo(processo) || processo.getPrazoFatal() == null) {
                continue;
            }
            Optional<PublicacaoEntity> pubOpt =
                    publicacaoRepository.findTop1ByProcesso_IdOrderByCreatedAtDescIdDesc(processoId);
            if (pubOpt.isEmpty()) {
                continue;
            }
            PublicacaoEntity pub = pubOpt.get();
            String numeroCnj = StringUtils.hasText(processo.getNumeroCnj())
                    ? processo.getNumeroCnj()
                    : pub.getNumeroProcessoEncontrado();

            Optional<JuliaTriagemEntity> existente = juliaTriagemRepository.findByPublicacao_Id(pub.getId());
            if (existente.isPresent()) {
                idempotentes++;
                TriagemResultado prev = carregarResultadoPersistido(existente.get());
                itens.add(itemBacklog(processoId, numeroCnj, pub.getId(), prev, true));
                continue;
            }

            try {
                String aviso = montarAvisoPrazoFatalVencido(processo.getPrazoFatal());
                TriagemRunResponse resp = self.getObject()
                        .triarEnact(
                                null,
                                null,
                                pub.getId(),
                                processoId,
                                TriagemEnactOpcoes.analiseBacklog(aviso));
                analisados++;
                cards++;
                itens.add(itemBacklog(processoId, numeroCnj, pub.getId(), resp.resultado(), false));
            } catch (Exception ex) {
                erros++;
                log.error(
                        "Julia backlog: falha processoId={} publicacaoId={}: {}",
                        processoId,
                        pub.getId(),
                        ex.getMessage(),
                        ex);
            }
        }

        return new JuliaBacklogAnaliseResponse(
                processoIds.size(), analisados, cards, idempotentes, erros, itens);
    }

    /**
     * Janela de {@code prazo_fatal}: processos <strong>ativos</strong> entre (hoje − diasAntes) e
     * (hoje + diasDepois). Entrada principal = histórico de andamentos; publicação recente opcional.
     * Idempotência por {@code processo_id}.
     */
    public JuliaBacklogJanelaResponse analisarBacklogJanela(int diasAntes, int diasDepois) {
        if (diasAntes < 0 || diasDepois < 0) {
            throw new BusinessRuleException("diasAntes e diasDepois devem ser >= 0.");
        }
        LocalDate hoje = LocalDate.now(ZONA_BR);
        LocalDate inicio = hoje.minusDays(diasAntes);
        LocalDate fim = hoje.plusDays(diasDepois);
        List<Long> processoIds = processoRepository.findIdsComPrazoFatalNaJanela(inicio, fim);

        List<JuliaBacklogJanelaItem> itens = new ArrayList<>();
        int puladosPorInativo = 0;
        int puladosPorSemConteudo = 0;
        int cardsCriados = 0;
        int idempotentes = 0;
        int erros = 0;
        int ativos = 0;

        for (Long processoId : processoIds) {
            ProcessoEntity processo = processoRepository.findById(processoId).orElse(null);
            if (processo == null || processo.getPrazoFatal() == null) {
                continue;
            }
            if (!ProcessoAtivoUtil.processoEstaAtivo(processo)) {
                puladosPorInativo++;
                continue;
            }
            ativos++;

            Optional<PublicacaoEntity> pubOpt =
                    publicacaoRepository.findTop1ByProcesso_IdOrderByCreatedAtDescIdDesc(processoId);
            if (!processoTemConteudoParaJanela(processoId, pubOpt.orElse(null))) {
                puladosPorSemConteudo++;
                continue;
            }

            String numeroCnj = resolverNumeroCnj(processo, pubOpt.orElse(null));
            LocalDate prazoFatal = processo.getPrazoFatal();
            Long publicacaoId = pubOpt.map(PublicacaoEntity::getId).orElse(null);

            List<JuliaTriagemEntity> triagensExistentes =
                    juliaTriagemRepository.findByProcesso_IdOrderByCriadoEmDescIdDesc(processoId);
            if (!triagensExistentes.isEmpty()) {
                idempotentes++;
                TriagemResultado prev = carregarResultadoPersistido(triagensExistentes.getFirst());
                itens.add(itemJanela(processoId, numeroCnj, prazoFatal, prev, true));
                continue;
            }

            try {
                String aviso = montarAvisoPrazoFatalJanela(prazoFatal, hoje);
                String teor = resolverTeorParaJanela(pubOpt.orElse(null), processoId, processo);
                String cnj = StringUtils.hasText(processo.getNumeroCnj())
                        ? processo.getNumeroCnj()
                        : pubOpt.map(PublicacaoEntity::getNumeroProcessoEncontrado).orElse(null);
                TriagemRunResponse resp = self.getObject()
                        .triarEnactJanelaProcesso(
                                processoId,
                                publicacaoId,
                                teor,
                                cnj,
                                TriagemEnactOpcoes.analiseBacklog(aviso));
                cardsCriados++;
                itens.add(itemJanela(processoId, numeroCnj, prazoFatal, resp.resultado(), false));
            } catch (Exception ex) {
                erros++;
                log.error("Julia backlog janela: falha processoId={}: {}", processoId, ex.getMessage(), ex);
            }
        }

        return new JuliaBacklogJanelaResponse(
                processoIds.size(),
                ativos,
                puladosPorInativo,
                puladosPorSemConteudo,
                cardsCriados,
                idempotentes,
                erros,
                itens);
    }

    @Transactional
    public TriagemRunResponse triarEnactJanelaProcesso(
            Long processoId,
            Long publicacaoId,
            String teor,
            String cnj,
            TriagemEnactOpcoes opcoes) {
        TriagemEnactOpcoes efectivas = opcoes != null ? opcoes : TriagemEnactOpcoes.analiseBacklog(null);
        if (processoId == null || processoId < 1) {
            throw new BusinessRuleException("processoId é obrigatório para enactment de janela.");
        }
        if (!StringUtils.hasText(teor)) {
            throw new BusinessRuleException("Teor da movimentação é obrigatório.");
        }

        List<JuliaTriagemEntity> existentes =
                juliaTriagemRepository.findByProcesso_IdOrderByCriadoEmDescIdDesc(processoId);
        if (!existentes.isEmpty()) {
            return TriagemRunResponse.idempotente(carregarResultadoPersistido(existentes.getFirst()));
        }

        PublicacaoEntity publicacao = null;
        if (publicacaoId != null) {
            publicacao = publicacaoRepository
                    .findById(publicacaoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Publicação não encontrada: " + publicacaoId));
        }

        TriagemResultado resultado =
                triarComContexto(teor, cnj, publicacaoId, processoId, efectivas.contextoAdicional());
        JuliaTriagemEntity triagem = persistirTriagem(publicacao, processoId, resultado);

        return juliaAssistenteContextService.executarComoJulia(() -> {
            EnactmentIds ids = aplicarTriagem(processoId, resultado, publicacaoId, efectivas.analiseSemPrazo());
            marcarCaixaSeAgendaOmitida(triagem, ids);
            return TriagemRunResponse.enact(
                    resultado,
                    ids.andamentoId(),
                    ids.prazoId(),
                    ids.agendaEventoId(),
                    ids.prazoFatalCabecalhoAtualizado(),
                    ids.duplicataPrazo(),
                    false,
                    ids.duplicataAndamento(),
                    ids.audienciaProcessoAtualizada(),
                    ids.agendaAudienciaReplicada());
        });
    }

    private boolean processoTemConteudoParaJanela(Long processoId, PublicacaoEntity publicacao) {
        if (publicacao != null) {
            return true;
        }
        return andamentoRepository.countByProcesso_Id(processoId) > 0;
    }

    private static String resolverNumeroCnj(ProcessoEntity processo, PublicacaoEntity publicacao) {
        if (processo != null && StringUtils.hasText(processo.getNumeroCnj())) {
            return processo.getNumeroCnj().trim();
        }
        if (publicacao != null && StringUtils.hasText(publicacao.getNumeroProcessoEncontrado())) {
            return publicacao.getNumeroProcessoEncontrado().trim();
        }
        return null;
    }

    private String resolverTeorParaJanela(PublicacaoEntity publicacao, Long processoId, ProcessoEntity processo) {
        if (publicacao != null && StringUtils.hasText(publicacao.getTeor())) {
            return publicacao.getTeor().trim();
        }
        List<ProcessoAndamentoEntity> andamentos =
                andamentoRepository.findByProcesso_IdOrderByMovimentoEmDescIdDesc(processoId);
        for (ProcessoAndamentoEntity a : andamentos) {
            StringBuilder sb = new StringBuilder();
            if (StringUtils.hasText(a.getTitulo())) {
                sb.append(a.getTitulo().trim());
            }
            if (StringUtils.hasText(a.getDetalhe())) {
                if (!sb.isEmpty()) {
                    sb.append(" — ");
                }
                sb.append(a.getDetalhe().trim());
            }
            if (!sb.isEmpty()) {
                return sb.toString();
            }
        }
        return "Revisão de situação processual (prazo fatal "
                + processo.getPrazoFatal().format(FMT_DATA_BR)
                + "). Consulte o HISTÓRICO DO PROCESSO abaixo.";
    }

    static String montarAvisoPrazoFatalJanela(LocalDate prazoFatal, LocalDate hoje) {
        if (prazoFatal == null) {
            return "ATENÇÃO: avalie a situação processual à luz do prazo fatal do cabeçalho.";
        }
        if (prazoFatal.isBefore(hoje)) {
            return montarAvisoPrazoFatalVencido(prazoFatal);
        }
        if (prazoFatal.isAfter(hoje)) {
            return "ATENÇÃO: o cabeçalho deste processo tem prazo fatal em "
                    + prazoFatal.format(FMT_DATA_BR)
                    + " — avalie se há providência antes do vencimento.";
        }
        return "ATENÇÃO: o prazo fatal deste processo é HOJE ("
                + prazoFatal.format(FMT_DATA_BR)
                + ") — avalie urgência e providências.";
    }

    private static JuliaBacklogJanelaItem itemJanela(
            Long processoId,
            String numeroCnj,
            LocalDate prazoFatal,
            TriagemResultado resultado,
            boolean idempotente) {
        return new JuliaBacklogJanelaItem(
                processoId,
                numeroCnj,
                prazoFatal,
                resultado != null ? resultado.impactoCliente() : null,
                resultado != null ? resultado.prioridade() : null,
                toConfiancaDecimal(resultado != null ? resultado.confianca() : null),
                idempotente);
    }

    private static JuliaBacklogAnaliseItem itemBacklog(
            Long processoId,
            String numeroCnj,
            Long publicacaoId,
            TriagemResultado resultado,
            boolean idempotente) {
        return new JuliaBacklogAnaliseItem(
                processoId,
                numeroCnj,
                publicacaoId,
                resultado != null ? resultado.impactoCliente() : null,
                resultado != null ? resultado.prioridade() : null,
                toConfiancaDecimal(resultado != null ? resultado.confianca() : null),
                idempotente);
    }

    static String montarAvisoPrazoFatalVencido(LocalDate prazoFatal) {
        if (prazoFatal == null) {
            return "ATENÇÃO: o cabeçalho deste processo tem prazo fatal VENCIDO — avalie a situação à luz disso.";
        }
        return "ATENÇÃO: o cabeçalho deste processo tem prazo fatal VENCIDO em "
                + prazoFatal.format(FMT_DATA_BR)
                + " — avalie a situação à luz disso.";
    }

    private TriagemResultado triarComContexto(
            String teor, String cnj, Long publicacaoId, Long processoIdHint, String contextoAdicional) {
        PublicacaoEntity publicacao = null;
        String teorEfetivo = teor;
        String cnjEfetivo = cnj;

        if (publicacaoId != null) {
            publicacao = publicacaoRepository
                    .findById(publicacaoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Publicação não encontrada: " + publicacaoId));
            if (StringUtils.hasText(publicacao.getTeor())) {
                teorEfetivo = publicacao.getTeor();
            }
            if (StringUtils.hasText(publicacao.getNumeroProcessoEncontrado())) {
                cnjEfetivo = publicacao.getNumeroProcessoEncontrado();
            }
        }

        if (!StringUtils.hasText(teorEfetivo)) {
            throw new BusinessRuleException("Teor da movimentação é obrigatório.");
        }

        Long processoId = resolverProcessoId(publicacao, processoIdHint, cnjEfetivo);
        String contexto = montarContexto(teorEfetivo, cnjEfetivo, publicacao, processoId, contextoAdicional);

        String respostaIA = claudeApiService.enviarMensagem(SYSTEM_PROMPT_TRIAGEM, contexto);
        TriagemResultado parseado = parsearResposta(respostaIA);
        return normalizarPrazo(parseado);
    }

    Optional<TriagemResultado> buscarTriagemSemanticaRecente(
            Long processoId, Long publicacaoIdAtual, PublicacaoEntity publicacao, TriagemResultado candidato) {
        if (processoId == null) {
            return Optional.empty();
        }
        Instant desde = Instant.now().minus(DEDUP_TRIAGEM_HORAS, ChronoUnit.HOURS);
        String fpNovo =
                JuliaTriagemDedupUtil.fingerprintMovimentacao(publicacao, candidato.classificacao(), candidato.resumo());
        for (JuliaTriagemEntity t : juliaTriagemRepository.findRecentesPorProcesso(processoId, desde)) {
            if (publicacaoIdAtual != null
                    && t.getPublicacao() != null
                    && publicacaoIdAtual.equals(t.getPublicacao().getId())) {
                continue;
            }
            try {
                TriagemResultado prev = carregarResultadoPersistido(t);
                String fpPrev = JuliaTriagemDedupUtil.fingerprintMovimentacao(
                        t.getPublicacao(), prev.classificacao(), prev.resumo());
                if (fpNovo.equals(fpPrev)) {
                    return Optional.of(prev);
                }
                if (JuliaTriagemDedupUtil.classificacaoEhGenerica(candidato.classificacao())
                        && JuliaTriagemDedupUtil.classificacaoEhGenerica(prev.classificacao())) {
                    return Optional.of(prev);
                }
            } catch (Exception ignore) {
                /* payload legado */
            }
        }
        return Optional.empty();
    }

    EnactmentIds aplicarTriagem(Long processoId, TriagemResultado resultado, Long publicacaoId) {
        return aplicarTriagem(processoId, resultado, publicacaoId, false);
    }

    EnactmentIds aplicarTriagem(
            Long processoId, TriagemResultado resultado, Long publicacaoId, boolean analiseSemPrazo) {
        ProcessoEntity processo = processoRepository
                .findByIdForJuliaEnactment(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));

        Long juliaId = juliaAssistenteContextService.idJuliaAssistente();

        TriagemResultado.Prazo prazo = resultado.prazo();
        LocalDate dataReal = prazo != null ? prazo.dataRealAsLocalDate() : null;
        LocalDate dataTrabalho = prazo != null ? prazo.dataTrabalhoAsLocalDate() : null;
        boolean prazoAtivoComData = prazo != null
                && Boolean.TRUE.equals(prazo.existe())
                && "ATIVO".equalsIgnoreCase(trim(prazo.natureza()))
                && dataReal != null;

        boolean duplicataPrazo = false;
        if (prazoAtivoComData
                && prazoRepository.countPrazoFatalDaJuliaNaData(
                                processoId, dataReal, ORIGEM_ANDAMENTO_TRIAGEM)
                        > 0) {
            duplicataPrazo = true;
            log.info(
                    "dedup: prazo fatal da Julia ja existe processo={} data={}, pulando prazo/agenda (publicacaoId={})",
                    processoId,
                    dataReal,
                    publicacaoId);
        }

        boolean agendaOmitidaSemResponsavel = false;
        Optional<UsuarioEntity> destinatarioAgenda = Optional.empty();
        if (!analiseSemPrazo && prazoAtivoComData && !duplicataPrazo && dataTrabalho != null) {
            destinatarioAgenda = resolverDestinatarioHumanoAgenda(processo);
            if (destinatarioAgenda.isEmpty()) {
                agendaOmitidaSemResponsavel = true;
            }
        }

        String titulo = tituloAndamento(resultado);
        boolean duplicataAndamento = existeAndamentoJuliaSimilarRecente(processoId, titulo);
        Long andamentoId = null;
        if (!duplicataAndamento) {
            ProcessoAndamentoWriteRequest andamentoReq = new ProcessoAndamentoWriteRequest();
            andamentoReq.setUsuarioId(juliaId);
            andamentoReq.setOrigem(ORIGEM_ANDAMENTO_TRIAGEM);
            andamentoReq.setOrigemAutomatica(true);
            andamentoReq.setTitulo(titulo);
            String detalhe = montarDetalheAndamento(resultado);
            if (duplicataPrazo) {
                detalhe = appendNotaDuplicataPrazo(detalhe, dataReal);
            }
            if (agendaOmitidaSemResponsavel) {
                detalhe = appendNotaSemResponsavelAgenda(detalhe);
            }
            andamentoReq.setDetalhe(detalhe);
            andamentoId = processoApplicationService.criarAndamento(processoId, andamentoReq).getId();
        } else {
            log.info(
                    "dedup: andamento Júlia omitido (processoId={}, título similar recente)",
                    processoId);
        }

        Long prazoId = null;
        Long agendaEventoId = null;
        boolean prazoFatalCabecalhoAtualizado = false;
        boolean audienciaProcessoAtualizada = false;
        Integer agendaAudienciaReplicada = null;

        if (!analiseSemPrazo && prazoAtivoComData && !duplicataPrazo) {
            ProcessoPrazoWriteRequest prazoReq = new ProcessoPrazoWriteRequest();
            prazoReq.setAndamentoId(andamentoId);
            prazoReq.setDataFim(dataReal);
            prazoReq.setPrazoFatal(true);
            prazoReq.setDescricao(StringUtils.hasText(prazo.tipo()) ? prazo.tipo().trim() : "Prazo processual");
            prazoReq.setStatus("PENDENTE");
            prazoId = processoApplicationService.criarPrazo(processoId, prazoReq).getId();

            prazoFatalCabecalhoAtualizado = atualizarPrazoFatalCabecalhoSeNecessario(processo, dataReal);

            if (dataTrabalho == null) {
                log.warn(
                        "Julia enact processoId={}: prazo ATIVO sem dataTrabalho (dataReal={}) — lembrete de agenda omitido",
                        processoId,
                        dataReal);
            } else if (destinatarioAgenda.isPresent()) {
                UsuarioEntity destinatario = destinatarioAgenda.get();
                agendaEventoId = criarLembreteAgendaPrazo(processo, prazo, dataReal, dataTrabalho, destinatario);
                log.info(
                        "Julia enact processoId={}: lembrete agenda id={} em {} para usuarioId={} (origem={})",
                        processoId,
                        agendaEventoId,
                        dataTrabalho,
                        destinatario.getId(),
                        ORIGEM_AGENDA_PRAZO_TRIAGEM);
            }
        }

        AudienciaEnactment audienciaEnact = aplicarAudienciaSeElegivel(processo, resultado);
        audienciaProcessoAtualizada = audienciaEnact.processoAtualizado();
        agendaAudienciaReplicada = audienciaEnact.agendaReplicada();

        return new EnactmentIds(
                andamentoId,
                prazoId,
                agendaEventoId,
                prazoFatalCabecalhoAtualizado,
                duplicataPrazo,
                agendaOmitidaSemResponsavel,
                duplicataAndamento,
                audienciaProcessoAtualizada,
                agendaAudienciaReplicada);
    }

    boolean existeAndamentoJuliaSimilarRecente(Long processoId, String titulo) {
        Instant desde = Instant.now().minus(DEDUP_ANDAMENTO_HORAS, ChronoUnit.HOURS);
        for (ProcessoAndamentoEntity a :
                andamentoRepository.findRecentesPorOrigem(processoId, ORIGEM_ANDAMENTO_TRIAGEM, desde)) {
            if (JuliaTriagemDedupUtil.titulosAndamentoEquivalentes(a.getTitulo(), titulo)) {
                return true;
            }
        }
        return false;
    }

    record AudienciaEnactment(boolean processoAtualizado, Integer agendaReplicada) {}

    AudienciaEnactment aplicarAudienciaSeElegivel(ProcessoEntity processo, TriagemResultado resultado) {
        TriagemResultado.Audiencia aud = resultado.audiencia();
        if (aud == null || !Boolean.TRUE.equals(aud.existe())) {
            return new AudienciaEnactment(false, null);
        }
        LocalDate data = aud.dataAsLocalDate();
        if (data == null) {
            log.warn("Julia enact: audiência indicada sem data parseável (processoId={})", processo.getId());
            return new AudienciaEnactment(false, null);
        }
        double conf = aud.confianca() != null ? aud.confianca() : resultado.confianca() != null ? resultado.confianca() : 0;
        if (conf < audienciaConfiancaMinima) {
            log.info(
                    "Julia enact: audiência não aplicada por confiança {} < {} (processoId={})",
                    conf,
                    audienciaConfiancaMinima,
                    processo.getId());
            return new AudienciaEnactment(false, null);
        }
        String hora = normalizarHoraTriagem(aud.hora());
        String tipo = StringUtils.hasText(aud.tipo()) ? aud.tipo().trim() : "Audiência";
        processoApplicationService.aplicarAudienciaIdentificadaAssistente(
                processo.getId(), data, hora, tipo);
        int replicados = replicarAudienciaAgendaColaboradores(processo, data, hora, tipo, aud.meio());
        log.info(
                "Julia enact: audiência aplicada processoId={} data={} hora={} agendaReplicada={}",
                processo.getId(),
                data,
                hora,
                replicados);
        return new AudienciaEnactment(true, replicados > 0 ? replicados : null);
    }

    static String normalizarHoraTriagem(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String t = raw.trim().replace('.', ':');
        if (t.matches("^\\d{1,2}:\\d{2}$")) {
            String[] p = t.split(":");
            int h = Integer.parseInt(p[0]);
            int m = Integer.parseInt(p[1]);
            if (h >= 0 && h <= 23 && m >= 0 && m <= 59) {
                return String.format(java.util.Locale.ROOT, "%02d:%02d", h, m);
            }
        }
        if (t.matches("^\\d{3,4}$")) {
            String d = t.length() == 3 ? "0" + t : t;
            return d.substring(0, 2) + ":" + d.substring(2);
        }
        return null;
    }

    int replicarAudienciaAgendaColaboradores(
            ProcessoEntity processo, LocalDate data, String hora, String tipo, String meio) {
        String processoRef = montarProcessoRef(processo);
        if (!StringUtils.hasText(processoRef)) {
            return 0;
        }
        String descricao = montarDescricaoAgendaAudiencia(processo, tipo, meio);
        int ok = 0;
        for (UsuarioEntity u : usuarioRepository.findColaboradoresHumanosAtivos()) {
            if (u == null || u.getId() == null) {
                continue;
            }
            try {
                AgendaEventoWriteRequest req = new AgendaEventoWriteRequest();
                req.setUsuarioId(u.getId());
                req.setDataEvento(data);
                req.setHoraEvento(hora);
                req.setDescricao(descricao);
                req.setProcessoRef(processoRef);
                req.setOrigem(ORIGEM_AGENDA_AUDIENCIA_TRIAGEM);
                agendaApplicationService.upsertAudiencia(req);
                ok++;
            } catch (Exception e) {
                log.warn(
                        "Julia enact: falha upsert audiência agenda usuarioId={}: {}",
                        u.getId(),
                        e.getMessage());
            }
        }
        return ok;
    }

    private static String montarDescricaoAgendaAudiencia(ProcessoEntity processo, String tipo, String meio) {
        StringBuilder sb = new StringBuilder();
        sb.append(StringUtils.hasText(tipo) ? tipo.trim() : "Audiência");
        if (processo.getNumeroCnj() != null && StringUtils.hasText(processo.getNumeroCnj())) {
            sb.append(" — ").append(processo.getNumeroCnj().trim());
        }
        if (StringUtils.hasText(meio)) {
            sb.append(" (").append(meio.trim()).append(')');
        }
        return sb.toString();
    }

    Optional<UsuarioEntity> resolverDestinatarioHumanoAgenda(ProcessoEntity processo) {
        UsuarioEntity responsavel = processo.getUsuarioResponsavel();
        if (responsavel != null) {
            if (responsavel.getTipo() == TipoUsuario.ASSISTENTE_IA) {
                log.warn(
                        "Julia enact processoId={}: responsável é assistente IA — lembrete de agenda omitido",
                        processo.getId());
                return Optional.empty();
            }
            return Optional.of(responsavel);
        }

        Optional<UsuarioEntity> porConsultor = resolverHumanoPorConsultor(processo.getConsultor());
        if (porConsultor.isPresent()) {
            log.info(
                    "Julia enact processoId={}: destinatário agenda resolvido via consultor \"{}\" → usuarioId={}",
                    processo.getId(),
                    processo.getConsultor(),
                    porConsultor.get().getId());
            return porConsultor;
        }

        log.warn(
                "Julia enact processoId={}: sem responsável humano — lembrete de agenda omitido (triagem segue)",
                processo.getId());
        return Optional.empty();
    }

    Optional<UsuarioEntity> resolverHumanoPorConsultor(String consultor) {
        if (!StringUtils.hasText(consultor)) {
            return Optional.empty();
        }
        String nome = consultor.trim();
        Optional<UsuarioEntity> porLogin = usuarioRepository.findWithPerfilByLoginIgnoreCase(nome);
        if (porLogin.isPresent() && isHumanoAtivo(porLogin.get())) {
            return porLogin;
        }

        String loginGuess = nome.toLowerCase().replaceAll("\\s+", ".").replaceAll("[^a-z0-9.]", "");
        if (StringUtils.hasText(loginGuess)) {
            Optional<UsuarioEntity> porGuess = usuarioRepository.findWithPerfilByLoginIgnoreCase(loginGuess);
            if (porGuess.isPresent() && isHumanoAtivo(porGuess.get())) {
                return porGuess;
            }
        }

        String primeiroToken = nome.split("\\s+")[0];
        for (UsuarioEntity u : usuarioRepository.findColaboradoresHumanosAtivos()) {
            if (loginCorrespondeConsultor(u.getLogin(), nome, primeiroToken)) {
                return Optional.of(u);
            }
            if (StringUtils.hasText(u.getApelido())
                    && u.getApelido().trim().equalsIgnoreCase(nome)) {
                return Optional.of(u);
            }
        }
        return Optional.empty();
    }

    private static boolean isHumanoAtivo(UsuarioEntity u) {
        return u.getTipo() == TipoUsuario.HUMANO && Boolean.TRUE.equals(u.getAtivo());
    }

    private static boolean loginCorrespondeConsultor(String login, String consultor, String primeiroToken) {
        if (!StringUtils.hasText(login)) {
            return false;
        }
        String l = login.trim().toLowerCase();
        String c = consultor.trim().toLowerCase();
        String t = primeiroToken.trim().toLowerCase();
        if (l.equals(c)) {
            return true;
        }
        if (l.startsWith(t + ".") || l.equals(t)) {
            return true;
        }
        return l.replace(".", " ").equals(c);
    }

    private boolean atualizarPrazoFatalCabecalhoSeNecessario(ProcessoEntity processo, LocalDate novaData) {
        LocalDate atual = processo.getPrazoFatal();
        boolean atualizar = deveAtualizarPrazoFatalCabecalho(atual, novaData);
        log.info(
                "Julia enact prazoFatal cabeçalho processoId={}: atual={}, novo={}, atualizar={}",
                processo.getId(),
                atual,
                novaData,
                atualizar);
        if (!atualizar) {
            return false;
        }
        processo.setPrazoFatal(novaData);
        processoRepository.save(processo);
        return true;
    }

    private Long criarLembreteAgendaPrazo(
            ProcessoEntity processo,
            TriagemResultado.Prazo prazo,
            LocalDate dataReal,
            LocalDate dataTrabalho,
            UsuarioEntity destinatario) {
        String processoRef = montarProcessoRef(processo);
        if (!StringUtils.hasText(processoRef)) {
            throw new BusinessRuleException(
                    "Processo id="
                            + processo.getId()
                            + " sem código cliente/nº interno — não foi possível vincular lembrete na agenda.");
        }
        String tipo = StringUtils.hasText(prazo.tipo()) ? prazo.tipo().trim() : "Prazo processual";
        String dataRealFmt = dataReal.format(FMT_DATA_BR);
        AgendaEventoWriteRequest req = new AgendaEventoWriteRequest();
        req.setUsuarioId(destinatario.getId());
        req.setDataEvento(dataTrabalho);
        req.setDescricao("Prazo se aproximando: " + tipo + " (fatal em " + dataRealFmt + ")");
        req.setProcessoRef(processoRef);
        req.setOrigem(ORIGEM_AGENDA_PRAZO_TRIAGEM);
        return agendaApplicationService.criar(req).getId();
    }

    static boolean deveAtualizarPrazoFatalCabecalho(LocalDate atual, LocalDate nova) {
        if (nova == null) {
            return false;
        }
        return atual == null || nova.isBefore(atual);
    }

    static String montarProcessoRef(ProcessoEntity processo) {
        if (processo == null || processo.getNumeroInterno() == null || processo.getNumeroInterno() < 1) {
            return null;
        }
        String codigo = null;
        if (processo.getCliente() != null && StringUtils.hasText(processo.getCliente().getCodigoCliente())) {
            codigo = processo.getCliente().getCodigoCliente().trim();
        }
        if (!StringUtils.hasText(codigo)) {
            return null;
        }
        return codigo + "|" + processo.getNumeroInterno();
    }

    static String montarDetalheAndamento(TriagemResultado resultado) {
        StringBuilder sb = new StringBuilder();
        appendSecaoDetalhe(sb, "Resumo", resultado.resumo());
        appendSecaoDetalhe(sb, "Impacto para o cliente", resultado.impactoCliente());
        appendSecaoDetalhe(sb, "Base do impacto", resultado.baseImpacto());
        if (resultado.audiencia() != null && Boolean.TRUE.equals(resultado.audiencia().existe())) {
            TriagemResultado.Audiencia aud = resultado.audiencia();
            String audTxt = String.join(
                    " ",
                    aud.data() != null ? aud.data() : "",
                    aud.hora() != null ? aud.hora() : "",
                    aud.tipo() != null ? aud.tipo() : "",
                    aud.meio() != null ? "(" + aud.meio() + ")" : "");
            appendSecaoDetalhe(sb, "Audiência identificada", audTxt.trim());
        }
        appendSecaoDetalhe(sb, "Ação sugerida", resultado.acaoSugerida());
        return sb.toString().trim();
    }

    private static String appendNotaDuplicataPrazo(String detalhe, LocalDate dataReal) {
        String nota =
                "Provável duplicata de movimentação já triada — prazo fatal já registrado para "
                        + dataReal.format(FMT_DATA_BR)
                        + "; prazo não recriado.";
        if (!StringUtils.hasText(detalhe)) {
            return nota;
        }
        return detalhe + "\n\n" + nota;
    }

    private static String appendNotaSemResponsavelAgenda(String detalhe) {
        String nota = OBS_CAIXA_SEM_RESPONSAVEL_AGENDA + ".";
        if (!StringUtils.hasText(detalhe)) {
            return nota;
        }
        return detalhe + "\n\n" + nota;
    }

    private void marcarCaixaSeAgendaOmitida(JuliaTriagemEntity triagem, EnactmentIds ids) {
        if (triagem == null || ids == null || !ids.agendaOmitidaSemResponsavel()) {
            return;
        }
        triagem.setCategoria(OBS_CAIXA_SEM_RESPONSAVEL_AGENDA);
        juliaTriagemRepository.save(triagem);
    }

    private static void appendSecaoDetalhe(StringBuilder sb, String rotulo, String valor) {
        if (!StringUtils.hasText(valor)) {
            return;
        }
        if (!sb.isEmpty()) {
            sb.append("\n\n");
        }
        sb.append(rotulo).append(": ").append(valor.trim());
    }

    static String tituloAndamento(TriagemResultado resultado) {
        if (StringUtils.hasText(resultado.resumo())) {
            String resumo = resultado.resumo().trim().replaceAll("\\s+", " ");
            if (resumo.length() > 220) {
                int corte = resumo.lastIndexOf(' ', 200);
                resumo = (corte > 80 ? resumo.substring(0, corte) : resumo.substring(0, 200)) + "…";
            }
            if (JuliaTriagemDedupUtil.classificacaoEhGenerica(resultado.classificacao())) {
                return resumo;
            }
            if (StringUtils.hasText(resultado.classificacao())) {
                return resultado.classificacao().trim() + " — " + resumo;
            }
            return resumo;
        }
        if (StringUtils.hasText(resultado.classificacao())) {
            return resultado.classificacao().trim();
        }
        return "Triagem Júlia";
    }

    private TriagemResultado carregarResultadoPersistido(JuliaTriagemEntity entity) {
        if (!StringUtils.hasText(entity.getPayloadJson())) {
            throw new BusinessRuleException(
                    "Triagem já persistida (id=" + entity.getId() + ") sem payload_json.");
        }
        try {
            return objectMapper.readValue(entity.getPayloadJson(), TriagemResultado.class);
        } catch (Exception e) {
            throw new BusinessRuleException(
                    "Falha ao ler payload da triagem id=" + entity.getId() + ": " + e.getMessage());
        }
    }

    record EnactmentIds(
            Long andamentoId,
            Long prazoId,
            Long agendaEventoId,
            boolean prazoFatalCabecalhoAtualizado,
            boolean duplicataPrazo,
            boolean agendaOmitidaSemResponsavel,
            boolean duplicataAndamento,
            boolean audienciaProcessoAtualizada,
            Integer agendaAudienciaReplicada) {}

    private Long resolverProcessoId(PublicacaoEntity publicacao, Long processoIdHint, String cnj) {
        if (processoIdHint != null && processoIdHint > 0) {
            return processoIdHint;
        }
        if (publicacao != null
                && publicacao.getProcesso() != null
                && publicacao.getProcesso().getId() != null) {
            return publicacao.getProcesso().getId();
        }
        if (!StringUtils.hasText(cnj)) {
            return null;
        }
        String norm = ProcessoDiagnosticoNumeroBuscaUtil.normalizarSomenteDigitos(cnj);
        if (norm.length() < 20) {
            return null;
        }
        List<BigInteger> ids = processoRepository.findIdsByNumeroCnjNormalizadoDiagnostico(norm);
        if (ids.size() == 1) {
            return ids.getFirst().longValue();
        }
        return null;
    }

    private String montarContexto(
            String teor, String cnj, PublicacaoEntity publicacao, Long processoId, String contextoAdicional) {
        StringBuilder sb = new StringBuilder();
        if (StringUtils.hasText(contextoAdicional)) {
            sb.append("=== ATENÇÃO ===\n").append(contextoAdicional.trim()).append("\n\n");
        }
        sb.append("=== MOVIMENTAÇÃO ATUAL ===\n");
        if (StringUtils.hasText(cnj)) {
            sb.append("CNJ / número: ").append(cnj.trim()).append('\n');
        }
        if (publicacao != null) {
            if (StringUtils.hasText(publicacao.getTipoPublicacao())) {
                sb.append("Tipo publicação: ").append(publicacao.getTipoPublicacao().trim()).append('\n');
            }
            if (publicacao.getDataPublicacao() != null) {
                sb.append("Data publicação: ")
                        .append(publicacao.getDataPublicacao())
                        .append('\n');
            }
            if (publicacao.getId() != null) {
                sb.append("ID publicação: ").append(publicacao.getId()).append('\n');
            }
        }
        sb.append("\nTeor:\n").append(teor.trim()).append("\n\n");

        if (processoId != null) {
            ProcessoEntity processo =
                    processoRepository.findById(processoId).orElse(null);
            if (processo != null) {
                JuliaTriagemContextoDriveService.ContextoDriveDocumentos driveCtx =
                        contextoDriveService.montarContexto(processo, publicacao, teor);
                sb.append(driveCtx.blocoContexto()).append('\n');
            }
            appendContextoProcesso(sb, processoId);
        } else {
            sb.append("=== PROCESSO ===\n");
            sb.append("(Processo não vinculado ou CNJ ambíguo — triagem só com o teor acima.)\n\n");
        }

        return sb.toString();
    }

    private void appendContextoProcesso(StringBuilder sb, Long processoId) {
        ProcessoResponse proc = processoApplicationService.buscar(processoId);
        ProcessoPartesVinculoTexto partes =
                processoApplicationService.resolverTextosPartesVinculoEmLote(Set.of(processoId)).get(processoId);

        sb.append("=== PROCESSO ===\n");
        sb.append("ID processo: ").append(proc.getId()).append('\n');
        if (proc.getNumeroInterno() != null) {
            sb.append("Nº interno: ").append(proc.getNumeroInterno()).append('\n');
        }
        if (StringUtils.hasText(proc.getCodigoCliente())) {
            sb.append("Código cliente: ").append(proc.getCodigoCliente()).append('\n');
        }
        if (StringUtils.hasText(proc.getNumeroCnj())) {
            sb.append("CNJ cadastro: ").append(proc.getNumeroCnj()).append('\n');
        }
        sb.append("Status: ")
                .append(Boolean.TRUE.equals(proc.getAtivo()) ? "Ativo" : "Inativo")
                .append('\n');
        if (StringUtils.hasText(proc.getFase())) {
            sb.append("Fase (informativa, pode estar desatualizada): ")
                    .append(proc.getFase())
                    .append('\n');
        }
        if (StringUtils.hasText(proc.getPapelCliente())) {
            sb.append("Papel do cliente: ").append(proc.getPapelCliente()).append('\n');
        }
        if (StringUtils.hasText(proc.getNaturezaAcao())) {
            sb.append("Natureza: ").append(proc.getNaturezaAcao()).append('\n');
        }
        if (StringUtils.hasText(proc.getDescricaoAcao())) {
            sb.append("Descrição: ").append(proc.getDescricaoAcao()).append('\n');
        }
        sb.append('\n');

        sb.append("=== PARTES ===\n");
        if (partes != null) {
            sb.append("Parte cliente: ")
                    .append(StringUtils.hasText(partes.getParteCliente()) ? partes.getParteCliente() : "—")
                    .append('\n');
            sb.append("Parte oposta: ")
                    .append(StringUtils.hasText(partes.getParteOposta()) ? partes.getParteOposta() : "—")
                    .append('\n');
        } else {
            sb.append("(Partes não resolvidas.)\n");
        }
        sb.append('\n');

        appendHistoricoProcesso(sb, processoId);
        appendTriagensAnteriores(sb, processoId);
    }

    /**
     * Histórico completo do processo (cronológico). Se longo demais: alguns antigos + os 30 mais recentes.
     */
    private void appendHistoricoProcesso(StringBuilder sb, Long processoId) {
        sb.append("=== HISTÓRICO DO PROCESSO ===\n");
        List<ProcessoAndamentoEntity> todos =
                andamentoRepository.findByProcesso_IdOrderByMovimentoEmAscIdAsc(processoId);
        if (todos.isEmpty()) {
            sb.append("(Sem andamentos registrados.)\n\n");
            return;
        }

        int limiteTotal = MAX_HISTORICO_ANTIGOS + MAX_HISTORICO_RECENTES;
        if (todos.size() <= limiteTotal) {
            for (ProcessoAndamentoEntity a : todos) {
                appendLinhaHistoricoAndamento(sb, a);
            }
            sb.append('\n');
            return;
        }

        sb.append("(Histórico truncado: ")
                .append(MAX_HISTORICO_ANTIGOS)
                .append(" andamentos mais antigos + ")
                .append(MAX_HISTORICO_RECENTES)
                .append(" mais recentes, de ")
                .append(todos.size())
                .append(" no total.)\n");
        for (int i = 0; i < MAX_HISTORICO_ANTIGOS; i++) {
            appendLinhaHistoricoAndamento(sb, todos.get(i));
        }
        sb.append("… [")
                .append(todos.size() - MAX_HISTORICO_ANTIGOS - MAX_HISTORICO_RECENTES)
                .append(" andamentos intermediários omitidos] …\n");
        int inicioRecentes = todos.size() - MAX_HISTORICO_RECENTES;
        for (int i = inicioRecentes; i < todos.size(); i++) {
            appendLinhaHistoricoAndamento(sb, todos.get(i));
        }
        sb.append('\n');
    }

    private void appendLinhaHistoricoAndamento(StringBuilder sb, ProcessoAndamentoEntity a) {
        String data = a.getMovimentoEm() != null
                ? a.getMovimentoEm().atZone(ZONA_BR).format(FMT_DATA_BR)
                : "—";
        sb.append("- [").append(data).append("] ");
        sb.append('[').append(rotuloAutorAndamento(a)).append("] ");
        sb.append(StringUtils.hasText(a.getTitulo()) ? a.getTitulo().trim() : "Andamento");
        if (StringUtils.hasText(a.getDetalhe())) {
            String det = a.getDetalhe().trim();
            if (det.length() > MAX_DETALHE_HISTORICO) {
                det = det.substring(0, MAX_DETALHE_HISTORICO) + "…";
            }
            sb.append(" — ").append(det);
        }
        sb.append('\n');
    }

    private String rotuloAutorAndamento(ProcessoAndamentoEntity a) {
        if (a.getUsuario() == null) {
            return StringUtils.hasText(a.getOrigem()) ? a.getOrigem().trim() : "—";
        }
        if (a.getUsuario().getTipo() == TipoUsuario.ASSISTENTE_IA
                || ORIGEM_ANDAMENTO_TRIAGEM.equalsIgnoreCase(trim(a.getOrigem()))) {
            return "Júlia (IA)";
        }
        if (StringUtils.hasText(a.getUsuario().getApelido())) {
            return a.getUsuario().getApelido().trim();
        }
        if (StringUtils.hasText(a.getUsuario().getNome())) {
            return a.getUsuario().getNome().trim();
        }
        return "—";
    }

    private void appendTriagensAnteriores(StringBuilder sb, Long processoId) {
        sb.append("=== TRIAGENS ANTERIORES (JÚLIA) ===\n");
        List<JuliaTriagemEntity> anteriores =
                juliaTriagemRepository.findByProcesso_IdOrderByCriadoEmDescIdDesc(processoId);
        if (anteriores.isEmpty()) {
            sb.append("(Nenhuma triagem anterior persistida.)\n");
            return;
        }
        int limite = Math.min(anteriores.size(), MAX_TRIAGENS_ANTERIORES);
        for (int i = 0; i < limite; i++) {
            JuliaTriagemEntity t = anteriores.get(i);
            sb.append("- ");
            if (t.getCriadoEm() != null) {
                sb.append('[')
                        .append(t.getCriadoEm().atZone(ZONA_BR).format(FMT_DATA_BR))
                        .append("] ");
            }
            sb.append(StringUtils.hasText(t.getClassificacao()) ? t.getClassificacao() : "—");
            if (StringUtils.hasText(t.getImpactoCliente())) {
                sb.append(" | impacto=").append(t.getImpactoCliente());
            }
            appendResumoTriagemAnterior(sb, t);
            sb.append('\n');
        }
    }

    private void appendResumoTriagemAnterior(StringBuilder sb, JuliaTriagemEntity t) {
        if (!StringUtils.hasText(t.getPayloadJson())) {
            return;
        }
        try {
            TriagemResultado anterior = objectMapper.readValue(t.getPayloadJson(), TriagemResultado.class);
            if (StringUtils.hasText(anterior.resumo())) {
                String resumo = anterior.resumo().trim();
                if (resumo.length() > 200) {
                    resumo = resumo.substring(0, 200) + "…";
                }
                sb.append(" — ").append(resumo);
            }
        } catch (Exception ignored) {
            /* ignora payload legado/corrompido no contexto */
        }
    }

    private TriagemResultado parsearResposta(String respostaIA) {
        String jsonLimpo = limparJsonMarkdown(respostaIA);
        try {
            return objectMapper.readValue(jsonLimpo, TriagemResultado.class);
        } catch (Exception e) {
            throw new BusinessRuleException(
                    "Resposta da IA não é um JSON válido: " + e.getMessage() + " | Resposta: " + respostaIA);
        }
    }

    TriagemResultado normalizarPrazo(TriagemResultado resultado) {
        TriagemResultado.Prazo prazo = resultado.prazo();
        if (prazo == null || !Boolean.TRUE.equals(prazo.existe())) {
            return comPrioridadeNormalizada(resultado, resultado.prioridade());
        }
        LocalDate dataRealParsed = prazo.dataRealAsLocalDate();
        if (dataRealParsed == null && StringUtils.hasText(prazo.dataReal())) {
            log.warn(
                    "Julia triagem: dataReal não parseável \"{}\", segue sem prazo ativo",
                    prazo.dataReal().trim());
        }
        String prioridade = normalizarPrioridade(resultado.prioridade());
        if ("ATIVO".equalsIgnoreCase(trim(prazo.natureza())) && dataRealParsed != null) {
            LocalDate dataReal = JuliaPrazoDateUtil.avancarParaProximoDiaUtil(dataRealParsed);
            LocalDate dataTrabalho = JuliaPrazoDateUtil.subtrairDiasUteis(dataReal, 3);
            TriagemResultado.Prazo ajustado = new TriagemResultado.Prazo(
                    prazo.existe(),
                    prazo.natureza(),
                    prazo.tipo(),
                    prazo.gatilho(),
                    prazo.diasUteis(),
                    dataReal.toString(),
                    dataTrabalho.toString());
            return comPrioridadeNormalizada(resultado, prioridade, ajustado);
        }
        TriagemResultado.Prazo condicional = new TriagemResultado.Prazo(
                prazo.existe(),
                prazo.natureza(),
                prazo.tipo(),
                prazo.gatilho(),
                prazo.diasUteis(),
                dataRealParsed != null ? dataRealParsed.toString() : null,
                null);
        return comPrioridadeNormalizada(resultado, prioridade, condicional);
    }

    static String normalizarPrioridade(String prioridade) {
        if (!StringUtils.hasText(prioridade)) {
            return null;
        }
        String p = prioridade.trim().toUpperCase();
        return switch (p) {
            case "MÉDIA" -> "MEDIA";
            case "URGENTE", "ALTA", "MEDIA", "BAIXA" -> p;
            default -> p;
        };
    }

    private static TriagemResultado comPrioridadeNormalizada(TriagemResultado resultado, String prioridade) {
        return comPrioridadeNormalizada(resultado, prioridade, resultado.prazo());
    }

    private static TriagemResultado comPrioridadeNormalizada(
            TriagemResultado resultado, String prioridade, TriagemResultado.Prazo prazo) {
        return new TriagemResultado(
                resultado.classificacao(),
                resultado.resumo(),
                resultado.impactoCliente(),
                resultado.baseImpacto(),
                prazo,
                resultado.providenciaCliente(),
                prioridade,
                resultado.acaoSugerida(),
                resultado.confianca(),
                resultado.audiencia());
    }

    private JuliaTriagemEntity persistirTriagem(PublicacaoEntity publicacao, Long processoId, TriagemResultado resultado) {
        if (publicacao != null
                && publicacao.getId() != null
                && juliaTriagemRepository.findByPublicacao_Id(publicacao.getId()).isPresent()) {
            throw new BusinessRuleException(
                    "Triagem já persistida para a publicação id=" + publicacao.getId() + ".");
        }

        JuliaTriagemEntity entity = new JuliaTriagemEntity();
        entity.setPublicacao(publicacao);
        if (processoId != null) {
            ProcessoEntity processo = processoRepository
                    .findById(processoId)
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
            entity.setProcesso(processo);
        }
        entity.setClassificacao(truncarClassificacao(resultado.classificacao()));
        entity.setImpactoCliente(trimToNull(resultado.impactoCliente()));
        entity.setPrioridade(trimToNull(normalizarPrioridade(resultado.prioridade())));
        entity.setConfianca(toConfiancaDecimal(resultado.confianca()));
        entity.setModelo(modelo);
        entity.setStatusCaixa(JuliaStatusCaixa.AGUARDANDO_VOCE.name());
        try {
            entity.setPayloadJson(objectMapper.writeValueAsString(resultado));
        } catch (JsonProcessingException e) {
            throw new BusinessRuleException("Falha ao serializar resultado da triagem: " + e.getMessage());
        }
        return juliaTriagemRepository.save(entity);
    }

    static String truncarClassificacao(String classificacao) {
        String t = trimToNull(classificacao);
        if (t == null) {
            return null;
        }
        if (t.length() <= MAX_CLASSIFICACAO_COL) {
            return t;
        }
        return t.substring(0, MAX_CLASSIFICACAO_COL - 1) + "…";
    }

    private static BigDecimal toConfiancaDecimal(Double confianca) {
        if (confianca == null) {
            return null;
        }
        return BigDecimal.valueOf(confianca).setScale(3, RoundingMode.HALF_UP);
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        return s.trim();
    }

    private static String trim(String s) {
        return s != null ? s.trim() : "";
    }

    static String limparJsonMarkdown(String texto) {
        if (texto == null) {
            return "";
        }
        String t = texto.trim();
        if (t.startsWith("```")) {
            int primeiraLinha = t.indexOf('\n');
            if (primeiraLinha > 0) {
                t = t.substring(primeiraLinha + 1);
            } else {
                t = t.replaceFirst("^```(?:json)?\\s*", "");
            }
            int fim = t.lastIndexOf("```");
            if (fim >= 0) {
                t = t.substring(0, fim);
            }
        }
        return t.trim();
    }
}
