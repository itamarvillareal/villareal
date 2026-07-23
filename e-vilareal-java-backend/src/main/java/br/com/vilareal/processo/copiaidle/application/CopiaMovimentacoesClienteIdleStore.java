package br.com.vilareal.processo.copiaidle.application;

import br.com.vilareal.pje.application.PjeCopiaIntegralResult;
import br.com.vilareal.pje.application.PjeTribunalCnjResolver;
import br.com.vilareal.pje.domain.PjeTribunal;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.api.dto.ProcessoProjudiMovimentacoesDriveResponse;
import br.com.vilareal.processo.application.ProcessoMovimentacoesConsolidadoDriveAutoService;
import br.com.vilareal.processo.application.ProcessoTramitacaoService;
import br.com.vilareal.processo.copiaidle.config.CopiaMovimentacoesClienteIdleProperties;
import br.com.vilareal.processo.copiaidle.domain.CopiaMovimentacoesCampanhaStatus;
import br.com.vilareal.processo.copiaidle.domain.CopiaMovimentacoesItemStatus;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity.CopiaMovimentacoesClienteCampanhaEntity;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.entity.CopiaMovimentacoesClienteItemEntity;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.repository.CopiaMovimentacoesClienteCampanhaRepository;
import br.com.vilareal.processo.copiaidle.infrastructure.persistence.repository.CopiaMovimentacoesClienteItemRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Persistência transacional da campanha idle (separada para proxy Spring @Transactional). */
@Service
public class CopiaMovimentacoesClienteIdleStore {

    private static final Logger log = LoggerFactory.getLogger(CopiaMovimentacoesClienteIdleStore.class);

    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final CopiaMovimentacoesClienteCampanhaRepository campanhaRepository;
    private final CopiaMovimentacoesClienteItemRepository itemRepository;
    private final ProcessoMovimentacoesConsolidadoDriveAutoService consolidadoDriveAutoService;
    private final CopiaMovimentacoesClienteIdleEmailService emailService;
    private final CopiaMovimentacoesClienteIdleProperties properties;
    private final Clock clock;

    public CopiaMovimentacoesClienteIdleStore(
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            CopiaMovimentacoesClienteCampanhaRepository campanhaRepository,
            CopiaMovimentacoesClienteItemRepository itemRepository,
            ProcessoMovimentacoesConsolidadoDriveAutoService consolidadoDriveAutoService,
            CopiaMovimentacoesClienteIdleEmailService emailService,
            CopiaMovimentacoesClienteIdleProperties properties,
            Clock clock) {
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.campanhaRepository = campanhaRepository;
        this.itemRepository = itemRepository;
        this.consolidadoDriveAutoService = consolidadoDriveAutoService;
        this.emailService = emailService;
        this.properties = properties;
        this.clock = clock;
    }

    @Transactional
    public CopiaMovimentacoesClienteCampanhaEntity garantirCampanhaComItens(String codigoCliente) {
        ClienteEntity cliente = clienteRepository
                .findByCodigoCliente(codigoCliente)
                .orElseThrow(() -> new IllegalStateException(
                        "Cliente não encontrado para codigo_cliente=" + codigoCliente));

        CopiaMovimentacoesClienteCampanhaEntity campanha = campanhaRepository
                .findByCodigoCliente(codigoCliente)
                .orElseGet(() -> {
                    CopiaMovimentacoesClienteCampanhaEntity nova =
                            new CopiaMovimentacoesClienteCampanhaEntity();
                    nova.setCodigoCliente(codigoCliente);
                    nova.setStatus(CopiaMovimentacoesCampanhaStatus.ATIVA);
                    nova.setIniciadaEm(LocalDateTime.now(clock));
                    return campanhaRepository.save(nova);
                });

        if (campanha.getStatus() == CopiaMovimentacoesCampanhaStatus.CONCLUIDA) {
            return campanha;
        }

        List<ProcessoEntity> processos =
                processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(cliente.getId());
        Set<Long> ja = itemRepository.findProcessoIdsByCampanhaId(campanha.getId());
        int novos = 0;
        for (ProcessoEntity p : processos) {
            if (ja.contains(p.getId())) {
                continue;
            }
            CopiaMovimentacoesClienteItemEntity item = new CopiaMovimentacoesClienteItemEntity();
            item.setCampanha(campanha);
            item.setProcesso(p);
            item.setNumeroInterno(p.getNumeroInterno());
            item.setNumeroCnj(p.getNumeroCnj());
            item.setTramitacao(p.getTramitacao());
            item.setStatus(CopiaMovimentacoesItemStatus.PENDENTE);
            classificarInicial(item, p);
            itemRepository.save(item);
            novos++;
        }
        if (novos > 0) {
            log.info(
                    "Cópia idle: {} novo(s) processo(s) enfileirado(s) (cliente={}, campanha={}).",
                    novos,
                    codigoCliente,
                    campanha.getId());
        }
        atualizarContadores(campanha.getId());
        return campanhaRepository.findById(campanha.getId()).orElse(campanha);
    }

    @Transactional
    public void aplicarResultadoProjudi(Long itemId, ProcessoProjudiMovimentacoesDriveResponse r) {
        CopiaMovimentacoesClienteItemEntity item =
                itemRepository.findById(itemId).orElse(null);
        if (item == null || item.getStatus() != CopiaMovimentacoesItemStatus.PENDENTE) {
            return;
        }
        item.setUltimaExecucaoEm(LocalDateTime.now(clock));
        item.setTentativas(item.getTentativas() + 1);
        int baixados = Math.max(0, r.arquivosBaixados());
        item.setArquivosBaixadosTotal(item.getArquivosBaixadosTotal() + baixados);
        item.setTemMais(r.temMais());
        item.setUltimaMensagem(r.erro() != null ? r.erro() : r.mensagem());

        if (r.erro() != null) {
            if (item.getTentativas() >= properties.getMaxTentativasErro()) {
                marcarTerminal(item, CopiaMovimentacoesItemStatus.ERRO, r.erro());
            }
            itemRepository.save(item);
            return;
        }

        if (Boolean.TRUE.equals(r.temMais())) {
            itemRepository.save(item);
            return;
        }

        try {
            consolidadoDriveAutoService.atualizarConsolidadoNoDrive(item.getProcesso().getId(), true);
        } catch (Exception e) {
            log.warn(
                    "Cópia idle: consolidado Drive falhou (processoId={}): {}",
                    item.getProcesso().getId(),
                    e.getMessage());
        }
        marcarTerminal(
                item,
                CopiaMovimentacoesItemStatus.COMPLETO,
                r.mensagem() != null ? r.mensagem() : "Cópia concluída.");
        itemRepository.save(item);
    }

    @Transactional
    public void aplicarResultadoPje(Long itemId, Optional<PjeCopiaIntegralResult> resultadoOpt) {
        CopiaMovimentacoesClienteItemEntity item =
                itemRepository.findById(itemId).orElse(null);
        if (item == null || item.getStatus() != CopiaMovimentacoesItemStatus.PENDENTE) {
            return;
        }
        item.setUltimaExecucaoEm(LocalDateTime.now(clock));
        item.setTentativas(item.getTentativas() + 1);

        if (resultadoOpt == null || resultadoOpt.isEmpty()) {
            item.setUltimaMensagem("Robô PJe ocupado ou indisponível — adiando.");
            itemRepository.save(item);
            return;
        }
        PjeCopiaIntegralResult r = resultadoOpt.get();
        item.setUltimaMensagem(r.mensagem());
        if (r.sucesso()) {
            item.setArquivosBaixadosTotal(item.getArquivosBaixadosTotal() + 1);
            item.setTemMais(false);
            marcarTerminal(item, CopiaMovimentacoesItemStatus.COMPLETO, r.mensagem());
        } else if (item.getTentativas() >= properties.getMaxTentativasErro()) {
            marcarTerminal(item, CopiaMovimentacoesItemStatus.ERRO, r.mensagem());
        }
        itemRepository.save(item);
    }

    @Transactional
    public void atualizarContadores(Long campanhaId) {
        CopiaMovimentacoesClienteCampanhaEntity campanha =
                campanhaRepository.findById(campanhaId).orElse(null);
        if (campanha == null) {
            return;
        }
        long total = itemRepository.countByCampanha_Id(campanhaId);
        long completos =
                itemRepository.countByCampanha_IdAndStatus(campanhaId, CopiaMovimentacoesItemStatus.COMPLETO);
        long erros =
                itemRepository.countByCampanha_IdAndStatus(campanhaId, CopiaMovimentacoesItemStatus.ERRO);
        long ignorados =
                itemRepository.countByCampanha_IdAndStatus(campanhaId, CopiaMovimentacoesItemStatus.IGNORADO);
        campanha.setTotalProcessos((int) total);
        campanha.setCompletos((int) completos);
        campanha.setErros((int) erros);
        campanha.setIgnorados((int) ignorados);
        campanhaRepository.save(campanha);
    }

    @Transactional
    public CopiaMovimentacoesClienteCampanhaEntity marcarCampanhaConcluida(Long campanhaId) {
        CopiaMovimentacoesClienteCampanhaEntity campanha =
                campanhaRepository.findById(campanhaId).orElseThrow();
        if (campanha.getStatus() != CopiaMovimentacoesCampanhaStatus.CONCLUIDA) {
            campanha.setStatus(CopiaMovimentacoesCampanhaStatus.CONCLUIDA);
            campanha.setConcluidaEm(LocalDateTime.now(clock));
            campanhaRepository.save(campanha);
            log.info(
                    "Cópia idle: campanha concluída (cliente={}, total={}, completos={}, erros={}, ignorados={}).",
                    campanha.getCodigoCliente(),
                    campanha.getTotalProcessos(),
                    campanha.getCompletos(),
                    campanha.getErros(),
                    campanha.getIgnorados());
        }
        return campanha;
    }

    @Transactional
    public void tentarEnviarEmailConclusao(Long campanhaId) {
        CopiaMovimentacoesClienteCampanhaEntity campanha =
                campanhaRepository.findById(campanhaId).orElse(null);
        if (campanha == null || campanha.getEmailEnviadoEm() != null) {
            return;
        }
        boolean ok = emailService.notificarCampanhaConcluida(campanha);
        if (ok) {
            campanha.setEmailEnviadoEm(LocalDateTime.now(clock));
            campanhaRepository.save(campanha);
        }
    }

    private void classificarInicial(CopiaMovimentacoesClienteItemEntity item, ProcessoEntity p) {
        if (!StringUtils.hasText(p.getNumeroCnj())) {
            marcarTerminal(item, CopiaMovimentacoesItemStatus.IGNORADO, "Processo sem número CNJ.");
            return;
        }
        String tram = ProcessoTramitacaoService.normalizarTramitacao(p.getTramitacao());
        if (ProcessoTramitacaoService.TRAMITACAO_AUTOS_FISICOS.equals(tram)) {
            marcarTerminal(item, CopiaMovimentacoesItemStatus.IGNORADO, "Autos físicos — sem robô.");
            return;
        }
        boolean pje = ProcessoTramitacaoService.ehPje(tram)
                || (tram == null && PjeTribunalCnjResolver.cnjEhTrt18(p.getNumeroCnj().trim()));
        if (!pje) {
            return;
        }
        PjeTribunal tribunal = p.getPjeTribunal();
        if (tribunal == null && PjeTribunalCnjResolver.cnjEhTrt18(p.getNumeroCnj().trim())) {
            tribunal = PjeTribunal.PJE_TRT18;
        }
        if (tribunal == null) {
            tribunal = PjeTribunalCnjResolver.resolverPorCnj(p.getNumeroCnj().trim()).orElse(null);
        }
        if (tribunal == null || !tribunal.automacaoCopiaIntegralDisponivel()) {
            marcarTerminal(
                    item,
                    CopiaMovimentacoesItemStatus.IGNORADO,
                    "PJe sem automação de cópia integral para este tribunal.");
        }
    }

    private void marcarTerminal(
            CopiaMovimentacoesClienteItemEntity item, CopiaMovimentacoesItemStatus status, String msg) {
        item.setStatus(status);
        item.setUltimaMensagem(msg);
        item.setConcluidoEm(LocalDateTime.now(clock));
        item.setTemMais(false);
    }
}
