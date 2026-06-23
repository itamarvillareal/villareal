package br.com.vilareal.publicacao.application;

import br.com.vilareal.agenda.application.PrazoAgendaLembreteService;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.DocumentoPastaAssinarService;
import br.com.vilareal.julia.api.dto.JuliaCaixaPatchRequest;
import br.com.vilareal.julia.application.JuliaCaixaApplicationService;
import br.com.vilareal.julia.domain.JuliaPrazoDateUtil;
import br.com.vilareal.julia.infrastructure.persistence.entity.JuliaTriagemEntity;
import br.com.vilareal.julia.infrastructure.persistence.repository.JuliaTriagemRepository;
import br.com.vilareal.julia.triagem.TriagemResultado;
import br.com.vilareal.processo.api.dto.ProcessoAndamentoWriteRequest;
import br.com.vilareal.processo.api.dto.ProcessoPrazoWriteRequest;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoPrazoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.publicacao.api.dto.JuliaTriagemDicaResponse;
import br.com.vilareal.publicacao.api.dto.PublicacaoSugestaoPrazoResponse;
import br.com.vilareal.publicacao.api.dto.PublicacaoStatusPatchRequest;
import br.com.vilareal.publicacao.api.dto.TratarPublicacaoRequest;
import br.com.vilareal.publicacao.api.dto.TratarPublicacaoResponse;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import br.com.vilareal.tarefa.api.dto.TarefaOperacionalWriteRequest;
import br.com.vilareal.tarefa.application.TarefaOperacionalApplicationService;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.Optional;

@Service
public class TratarPublicacaoService {

    static final String ORIGEM_ANDAMENTO = "TRATAMENTO_PUBLICACAO";
    static final String ORIGEM_AGENDA_PRAZO = "tratamento-publicacao-prazo";
    static final String ORIGEM_TAREFA = "TRATAMENTO_PUBLICACAO";

    private static final ZoneId ZONA_BR = ZoneId.of("America/Sao_Paulo");
    private static final DateTimeFormatter FMT_DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final PublicacaoRepository publicacaoRepository;
    private final PublicacaoApplicationService publicacaoApplicationService;
    private final ProcessoRepository processoRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final ProcessoPrazoRepository processoPrazoRepository;
    private final PrazoSugestaoService prazoSugestaoService;
    private final PrazoAgendaLembreteService prazoAgendaLembreteService;
    private final JuliaTriagemRepository juliaTriagemRepository;
    private final JuliaCaixaApplicationService juliaCaixaApplicationService;
    private final TarefaOperacionalApplicationService tarefaOperacionalApplicationService;
    private final UsuarioRepository usuarioRepository;
    private final ObjectMapper objectMapper;

    public TratarPublicacaoService(
            PublicacaoRepository publicacaoRepository,
            PublicacaoApplicationService publicacaoApplicationService,
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService,
            ProcessoPrazoRepository processoPrazoRepository,
            PrazoSugestaoService prazoSugestaoService,
            PrazoAgendaLembreteService prazoAgendaLembreteService,
            JuliaTriagemRepository juliaTriagemRepository,
            JuliaCaixaApplicationService juliaCaixaApplicationService,
            TarefaOperacionalApplicationService tarefaOperacionalApplicationService,
            UsuarioRepository usuarioRepository,
            ObjectMapper objectMapper) {
        this.publicacaoRepository = publicacaoRepository;
        this.publicacaoApplicationService = publicacaoApplicationService;
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
        this.processoPrazoRepository = processoPrazoRepository;
        this.prazoSugestaoService = prazoSugestaoService;
        this.prazoAgendaLembreteService = prazoAgendaLembreteService;
        this.juliaTriagemRepository = juliaTriagemRepository;
        this.juliaCaixaApplicationService = juliaCaixaApplicationService;
        this.tarefaOperacionalApplicationService = tarefaOperacionalApplicationService;
        this.usuarioRepository = usuarioRepository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public PublicacaoSugestaoPrazoResponse sugestaoPrazo(Long publicacaoId) {
        PublicacaoEntity pub = requirePublicacao(publicacaoId);
        LocalDate dataBase = pub.getDataPublicacao() != null
                ? pub.getDataPublicacao()
                : pub.getDataDisponibilizacao() != null
                        ? pub.getDataDisponibilizacao()
                        : LocalDate.now(ZONA_BR);
        PrazoSugestaoResultado sugestao = prazoSugestaoService.sugerir(pub.getTeor(), dataBase);
        JuliaTriagemDicaResponse dica = juliaTriagemRepository
                .findByPublicacao_Id(publicacaoId)
                .map(this::montarDicaJulia)
                .orElse(null);
        return new PublicacaoSugestaoPrazoResponse(
                sugestao.identificado(),
                sugestao.origem(),
                sugestao.dias(),
                sugestao.dataBase(),
                sugestao.dataFatal(),
                sugestao.explicacao(),
                dica);
    }

    @Transactional
    public TratarPublicacaoResponse tratar(Long publicacaoId, TratarPublicacaoRequest comando) {
        if (comando == null || !StringUtils.hasText(comando.tipo())) {
            throw new BusinessRuleException("tipo é obrigatório.");
        }
        TratarPublicacaoTipo tipo;
        try {
            tipo = TratarPublicacaoTipo.parse(comando.tipo());
        } catch (IllegalArgumentException e) {
            throw new BusinessRuleException("tipo inválido: " + comando.tipo());
        }

        PublicacaoEntity pub = requirePublicacao(publicacaoId);
        ProcessoEntity processo = pub.getProcesso();
        if (processo == null || processo.getId() == null) {
            throw new BusinessRuleException("Publicação sem processo vinculado — não é possível tratar.");
        }
        Long processoId = processo.getId();
        processo = processoRepository
                .findByIdForJuliaEnactment(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));

        PublicacaoStatusPatchRequest statusReq = new PublicacaoStatusPatchRequest();
        statusReq.setStatus("TRATADA");
        publicacaoApplicationService.patchStatus(publicacaoId, statusReq);

        String descricaoAndamento = resolverDescricaoAndamento(tipo, comando.observacaoFase(), pub);
        ProcessoAndamentoWriteRequest andamentoReq = new ProcessoAndamentoWriteRequest();
        andamentoReq.setOrigem(ORIGEM_ANDAMENTO);
        andamentoReq.setOrigemAutomatica(false);
        andamentoReq.setTitulo(truncarTitulo(descricaoAndamento));
        andamentoReq.setDetalhe(montarDetalheAndamento(pub, comando.observacaoFase()));
        resolverUsuarioAtual().ifPresent(u -> andamentoReq.setUsuarioId(u.getId()));
        Long andamentoId = processoApplicationService.criarAndamento(processoId, andamentoReq).getId();

        boolean cardConcluido = false;
        Optional<JuliaTriagemEntity> triagemOpt = juliaTriagemRepository.findByPublicacao_Id(publicacaoId);
        if (triagemOpt.isPresent()) {
            juliaCaixaApplicationService.atualizarCaixa(
                    triagemOpt.get().getId(), new JuliaCaixaPatchRequest("CONCLUIDO", null, null));
            cardConcluido = true;
        }

        Long prazoId = null;
        Long agendaEventoId = null;
        String avisoDedup = null;

        if ((tipo == TratarPublicacaoTipo.TERCEIRO || tipo == TratarPublicacaoTipo.CUMPRIR_DEPOIS)
                && comando.dataFatal() != null) {
            LocalDate dataFatal = JuliaPrazoDateUtil.avancarParaProximoDiaUtil(comando.dataFatal());
            if (processoPrazoRepository.countPrazoFatalNaData(processoId, dataFatal) > 0) {
                avisoDedup =
                        "Já existe prazo fatal em " + dataFatal.format(FMT_DATA_BR) + " — prazo não duplicado.";
            } else {
                ProcessoPrazoWriteRequest prazoReq = new ProcessoPrazoWriteRequest();
                prazoReq.setAndamentoId(andamentoId);
                prazoReq.setDataFim(dataFatal);
                prazoReq.setPrazoFatal(true);
                prazoReq.setDescricao(
                        StringUtils.hasText(comando.observacaoFase())
                                ? comando.observacaoFase().trim()
                                : "Prazo processual");
                prazoReq.setStatus("PENDENTE");
                prazoId = processoApplicationService.criarPrazo(processoId, prazoReq).getId();

                LocalDate dataTrabalho = JuliaPrazoDateUtil.subtrairDiasUteis(dataFatal, 3);
                Optional<UsuarioEntity> destinatario = prazoAgendaLembreteService.resolverDestinatarioHumanoAgenda(processo);
                if (destinatario.isPresent()) {
                    agendaEventoId = prazoAgendaLembreteService.criarLembreteAgendaPrazo(
                            processo,
                            prazoReq.getDescricao(),
                            dataFatal,
                            dataTrabalho,
                            destinatario.get(),
                            ORIGEM_AGENDA_PRAZO);
                }
            }
        }

        if (tipo == TratarPublicacaoTipo.CUMPRIR_AGORA) {
            processo.setFase(DocumentoPastaAssinarService.FASE_AGUARDANDO_PROTOCOLO);
        }

        boolean cabecalhoAlterado = tipo == TratarPublicacaoTipo.CUMPRIR_AGORA;
        if (StringUtils.hasText(comando.observacaoFase())) {
            processo.setObservacaoFase(comando.observacaoFase().trim());
            cabecalhoAlterado = true;
        }
        if ((tipo == TratarPublicacaoTipo.TERCEIRO || tipo == TratarPublicacaoTipo.CUMPRIR_DEPOIS)
                && comando.dataFatal() != null) {
            LocalDate dataFatalCabecalho = JuliaPrazoDateUtil.avancarParaProximoDiaUtil(comando.dataFatal());
            if (deveAtualizarPrazoFatalCabecalho(processo.getPrazoFatal(), dataFatalCabecalho)) {
                processo.setPrazoFatal(dataFatalCabecalho);
                cabecalhoAlterado = true;
            }
        }
        if (cabecalhoAlterado) {
            processoRepository.save(processo);
        }

        Long tarefaId = null;
        if (tipo == TratarPublicacaoTipo.CUMPRIR_DEPOIS && Boolean.TRUE.equals(comando.contatarCliente())) {
            tarefaId = criarTarefaContatarCliente(processo, pub, prazoId, comando);
        }

        return new TratarPublicacaoResponse(
                andamentoId, prazoId, agendaEventoId, tarefaId, cardConcluido, avisoDedup);
    }

    private Long criarTarefaContatarCliente(
            ProcessoEntity processo, PublicacaoEntity pub, Long prazoId, TratarPublicacaoRequest comando) {
        if (processo.getCliente() == null || processo.getCliente().getId() == null) {
            throw new BusinessRuleException("Processo sem cliente — não foi possível criar tarefa.");
        }
        TarefaOperacionalWriteRequest req = new TarefaOperacionalWriteRequest();
        req.setTitulo("Contatar cliente sobre publicação");
        req.setDescricao(resolverDescricaoAndamento(TratarPublicacaoTipo.CUMPRIR_DEPOIS, comando.observacaoFase(), pub));
        req.setClienteId(processo.getCliente().getId());
        req.setProcessoId(processo.getId());
        req.setPublicacaoId(pub.getId());
        req.setProcessoPrazoId(prazoId);
        req.setOrigem(ORIGEM_TAREFA);
        if (processo.getUsuarioResponsavel() != null
                && processo.getUsuarioResponsavel().getId() != null) {
            req.setResponsavelUsuarioId(processo.getUsuarioResponsavel().getId());
        }
        return tarefaOperacionalApplicationService.criar(req).getId();
    }

    private PublicacaoEntity requirePublicacao(Long id) {
        return publicacaoRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Publicação não encontrada: " + id));
    }

    private JuliaTriagemDicaResponse montarDicaJulia(JuliaTriagemEntity triagem) {
        TriagemResultado payload = lerPayload(triagem);
        if (payload == null) {
            return null;
        }
        TriagemResultado.Prazo prazo = payload.prazo();
        return new JuliaTriagemDicaResponse(
                triagem.getClassificacao(),
                payload.resumo(),
                prazo != null ? prazo.existe() : null,
                prazo != null ? prazo.natureza() : null,
                prazo != null ? prazo.tipo() : null,
                prazo != null ? prazo.gatilho() : null,
                prazo != null ? prazo.diasUteis() : null,
                prazo != null ? prazo.dataReal() : null,
                prazo != null ? prazo.dataTrabalho() : null,
                payload.providenciaCliente(),
                payload.acaoSugerida());
    }

    private TriagemResultado lerPayload(JuliaTriagemEntity entity) {
        if (!StringUtils.hasText(entity.getPayloadJson())) {
            return null;
        }
        try {
            return objectMapper.readValue(entity.getPayloadJson(), TriagemResultado.class);
        } catch (Exception e) {
            return null;
        }
    }

    private static boolean deveAtualizarPrazoFatalCabecalho(LocalDate atual, LocalDate nova) {
        if (nova == null) {
            return false;
        }
        return atual == null || nova.isBefore(atual);
    }

    private Optional<UsuarioEntity> resolverUsuarioAtual() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || !StringUtils.hasText(auth.getName())) {
            return Optional.empty();
        }
        return usuarioRepository.findWithPerfilByLoginIgnoreCase(auth.getName().trim());
    }

    private static String resolverDescricaoAndamento(
            TratarPublicacaoTipo tipo, String observacaoFase, PublicacaoEntity pub) {
        if (StringUtils.hasText(observacaoFase)) {
            return observacaoFase.trim();
        }
        if (tipo == TratarPublicacaoTipo.INFORMATIVO) {
            if (StringUtils.hasText(pub.getResumo())) {
                return pub.getResumo().trim();
            }
            if (StringUtils.hasText(pub.getTitulo())) {
                return pub.getTitulo().trim();
            }
            return "Tratamento de publicação";
        }
        if (StringUtils.hasText(pub.getResumo())) {
            return pub.getResumo().trim();
        }
        if (StringUtils.hasText(pub.getTitulo())) {
            return pub.getTitulo().trim();
        }
        return "Tratamento de publicação";
    }

    private static String montarDetalheAndamento(PublicacaoEntity pub, String observacaoFase) {
        if (StringUtils.hasText(observacaoFase) && StringUtils.hasText(pub.getResumo())) {
            return pub.getResumo().trim();
        }
        return null;
    }

    private static String truncarTitulo(String texto) {
        if (!StringUtils.hasText(texto)) {
            return "Tratamento de publicação";
        }
        String t = texto.trim().replaceAll("\\s+", " ");
        if (t.length() <= 500) {
            return t;
        }
        int corte = t.lastIndexOf(' ', 480);
        return (corte > 80 ? t.substring(0, corte) : t.substring(0, 480)) + "…";
    }
}
