package br.com.vilareal.citacao.application;

import br.com.vilareal.agendamento.infrastructure.persistence.entity.MovimentacaoMonitoradaEntity;
import br.com.vilareal.agendamento.infrastructure.persistence.repository.MovimentacaoMonitoradaRepository;
import br.com.vilareal.citacao.config.CitacaoAutoLinkProperties;
import br.com.vilareal.citacao.domain.CitacaoLegendaNaoCitacaoUtil;
import br.com.vilareal.citacao.domain.CitacaoStatus;
import br.com.vilareal.citacao.infrastructure.persistence.entity.CitacaoTentativaEntity;
import br.com.vilareal.citacao.infrastructure.persistence.repository.CitacaoTentativaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.tarefa.api.dto.TarefaOperacionalWriteRequest;
import br.com.vilareal.tarefa.application.TarefaOperacionalApplicationService;
import br.com.vilareal.tarefa.model.TarefaPrioridade;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;

/**
 * Auto-link: movimentação PROJUDI nova com legenda de não-citação → tentativa {@code SOLICITADO} vira {@code NEGATIVO}.
 */
@Service
public class CitacaoAutoLinkService {

    private static final Logger log = LoggerFactory.getLogger(CitacaoAutoLinkService.class);

    static final String ORIGEM_TAREFA_AMBIGUA = "CITACAO_AUTO_LINK";

    private final CitacaoAutoLinkProperties properties;
    private final MovimentacaoMonitoradaRepository movimentacaoMonitoradaRepository;
    private final CitacaoTentativaRepository tentativaRepository;
    private final CitacaoApplicationService citacaoApplicationService;
    private final ProcessoRepository processoRepository;
    private final TarefaOperacionalApplicationService tarefaOperacionalApplicationService;

    public CitacaoAutoLinkService(
            CitacaoAutoLinkProperties properties,
            MovimentacaoMonitoradaRepository movimentacaoMonitoradaRepository,
            CitacaoTentativaRepository tentativaRepository,
            CitacaoApplicationService citacaoApplicationService,
            ProcessoRepository processoRepository,
            TarefaOperacionalApplicationService tarefaOperacionalApplicationService) {
        this.properties = properties;
        this.movimentacaoMonitoradaRepository = movimentacaoMonitoradaRepository;
        this.tentativaRepository = tentativaRepository;
        this.citacaoApplicationService = citacaoApplicationService;
        this.processoRepository = processoRepository;
        this.tarefaOperacionalApplicationService = tarefaOperacionalApplicationService;
    }

    /**
     * Invocado somente após INSERT de {@link MovimentacaoMonitoradaEntity} (novidade, não baseline).
     * Nunca propaga exceção — falhas são logadas.
     */
    public void processarNovaMovimentacao(Long movimentacaoMonitoradaId) {
        if (!properties.isEnabled()) {
            return;
        }
        if (movimentacaoMonitoradaId == null) {
            return;
        }
        try {
            processarNovaMovimentacaoInterno(movimentacaoMonitoradaId);
        } catch (Exception e) {
            log.warn(
                    "Auto-link citação falhou (movimentacaoMonitoradaId={}): {}",
                    movimentacaoMonitoradaId,
                    e.getMessage(),
                    e);
        }
    }

    @Transactional
    void processarNovaMovimentacaoInterno(Long movimentacaoMonitoradaId) {
        MovimentacaoMonitoradaEntity mov = movimentacaoMonitoradaRepository
                .findById(movimentacaoMonitoradaId)
                .orElse(null);
        if (mov == null || mov.getProcesso() == null || mov.getProcesso().getId() == null) {
            return;
        }

        if (!CitacaoLegendaNaoCitacaoUtil.legendaIndicaRetornoInfrutifero(mov.getLegenda())) {
            return;
        }

        if (tentativaRepository.existsByMovMonitoradaRetorno_Id(mov.getId())) {
            log.info(
                    "Auto-link citação ignorado (idempotência): movimentacaoMonitoradaId={} já vinculada",
                    mov.getId());
            return;
        }

        Long processoId = mov.getProcesso().getId();
        List<CitacaoTentativaEntity> abertas =
                tentativaRepository.findByProcessoIdAndStatusAndPoloReu(processoId, CitacaoStatus.SOLICITADO);

        if (abertas.size() == 1) {
            CitacaoTentativaEntity tentativa = abertas.get(0);
            LocalDate dataRetorno = resolverDataRetorno(mov);
            citacaoApplicationService.aplicarRetornoNegativoAutomatico(
                    processoId,
                    tentativa.getId(),
                    dataRetorno,
                    mov.getLegenda(),
                    movProjudiTexto(mov),
                    mov.getId(),
                    null);
            log.info(
                    "Auto-link citação: tentativaId={} → NEGATIVO via movimentacaoMonitoradaId={} processoId={} numeroProjudi={}",
                    tentativa.getId(),
                    mov.getId(),
                    processoId,
                    mov.getNumero());
            return;
        }

        criarTarefaAmbigua(mov, processoId, abertas.size());
        log.info(
                "Auto-link citação ambíguo: processoId={} movimentacaoMonitoradaId={} tentativasAbertas={} — tarefa criada",
                processoId,
                mov.getId(),
                abertas.size());
    }

    private void criarTarefaAmbigua(MovimentacaoMonitoradaEntity mov, Long processoId, int qtdAbertas) {
        ProcessoEntity processo = processoRepository
                .findByIdWithClienteAndPessoa(processoId)
                .orElse(mov.getProcesso());

        String numeroProcesso = StringUtils.hasText(processo.getNumeroCnj())
                ? processo.getNumeroCnj().trim()
                : String.valueOf(processoId);
        String numeroMov = mov.getNumero() != null ? String.valueOf(mov.getNumero()) : "—";
        String legenda = mov.getLegenda() != null ? mov.getLegenda().trim() : "";

        String titulo = "Confirmar retorno de citação — Mov. " + numeroMov;
        String descricao =
                "Retorno de citação detectado na Mov. "
                        + numeroMov
                        + " do processo "
                        + numeroProcesso
                        + " ('"
                        + legenda
                        + "') — confirme manualmente a qual endereço se refere."
                        + (qtdAbertas == 0
                                ? " Nenhuma tentativa SOLICITADO em aberto."
                                : " Há "
                                        + qtdAbertas
                                        + " tentativas SOLICITADO em aberto.");

        TarefaOperacionalWriteRequest req = new TarefaOperacionalWriteRequest();
        req.setTitulo(titulo.length() > 500 ? titulo.substring(0, 500) : titulo);
        req.setDescricao(descricao);
        req.setProcessoId(processoId);
        req.setOrigem(ORIGEM_TAREFA_AMBIGUA);
        req.setPrioridade(TarefaPrioridade.ALTA);
        if (processo.getCliente() != null && processo.getCliente().getId() != null) {
            req.setClienteId(processo.getCliente().getId());
        }
        if (processo.getUsuarioResponsavel() != null
                && processo.getUsuarioResponsavel().getId() != null) {
            req.setResponsavelUsuarioId(processo.getUsuarioResponsavel().getId());
        }
        tarefaOperacionalApplicationService.criar(req);
    }

    private static LocalDate resolverDataRetorno(MovimentacaoMonitoradaEntity mov) {
        if (mov.getDataMovimentacao() != null) {
            return mov.getDataMovimentacao().toLocalDate();
        }
        if (mov.getDataConsulta() != null) {
            return mov.getDataConsulta().toLocalDate();
        }
        return LocalDate.now();
    }

    private static String movProjudiTexto(MovimentacaoMonitoradaEntity mov) {
        return mov.getNumero() != null ? String.valueOf(mov.getNumero()) : null;
    }
}
