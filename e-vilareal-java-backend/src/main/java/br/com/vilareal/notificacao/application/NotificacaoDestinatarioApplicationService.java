package br.com.vilareal.notificacao.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisDto;
import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisRequest;
import br.com.vilareal.notificacao.api.dto.ProcessoDestinatariosResponse;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class NotificacaoDestinatarioApplicationService {

    private final NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;
    private final NotificacaoDestinatarioService notificacaoDestinatarioService;
    private final ProcessoRepository processoRepository;

    public NotificacaoDestinatarioApplicationService(
            NotificacaoDestinatarioRepository notificacaoDestinatarioRepository,
            NotificacaoDestinatarioService notificacaoDestinatarioService,
            ProcessoRepository processoRepository) {
        this.notificacaoDestinatarioRepository = notificacaoDestinatarioRepository;
        this.notificacaoDestinatarioService = notificacaoDestinatarioService;
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public DestinatariosCanaisDto obterPadrao() {
        return notificacaoDestinatarioService.listarPadrao();
    }

    @Transactional
    public DestinatariosCanaisDto substituirPadrao(DestinatariosCanaisRequest request) {
        notificacaoDestinatarioRepository.deleteByProcessoIdIsNull();
        List<NotificacaoDestinatarioEntity> entidades =
                NotificacaoDestinatarioService.montarEntidades(request.whatsapp(), request.email(), null);
        deduplicarESalvar(entidades);
        return notificacaoDestinatarioService.listarPadrao();
    }

    @Transactional(readOnly = true)
    public ProcessoDestinatariosResponse obterProcesso(Long processoId) {
        garantirProcessoExiste(processoId);
        DestinatariosCanaisDto override = notificacaoDestinatarioService.listarOverrideAtivo(processoId);
        boolean personalizado = notificacaoDestinatarioService.processoTemOverride(processoId);
        DestinatariosCanaisDto efetivo = notificacaoDestinatarioService.resolver(processoId);
        return new ProcessoDestinatariosResponse(override, personalizado, efetivo);
    }

    @Transactional
    public ProcessoDestinatariosResponse substituirOverrideProcesso(
            Long processoId, DestinatariosCanaisRequest request) {
        ProcessoEntity processo = processoRepository
                .findById(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        notificacaoDestinatarioRepository.deleteByProcessoId(processoId);
        List<NotificacaoDestinatarioEntity> entidades =
                NotificacaoDestinatarioService.montarEntidades(request.whatsapp(), request.email(), processo);
        deduplicarESalvar(entidades);
        return obterProcesso(processoId);
    }

    @Transactional
    public ProcessoDestinatariosResponse removerOverrideProcesso(Long processoId) {
        garantirProcessoExiste(processoId);
        notificacaoDestinatarioRepository.deleteByProcessoId(processoId);
        return obterProcesso(processoId);
    }

    private void deduplicarESalvar(List<NotificacaoDestinatarioEntity> entidades) {
        Set<String> vistos = new HashSet<>();
        for (NotificacaoDestinatarioEntity entidade : entidades) {
            String chave = entidade.getCanal().name() + ":" + entidade.getValor();
            if (vistos.add(chave)) {
                notificacaoDestinatarioRepository.save(entidade);
            }
        }
    }

    private void garantirProcessoExiste(Long processoId) {
        if (!processoRepository.existsById(processoId)) {
            throw new ResourceNotFoundException("Processo não encontrado: " + processoId);
        }
    }
}
