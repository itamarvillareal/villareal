package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pje.application.PjeCopiaIntegralPorProcessoService;
import br.com.vilareal.processo.api.dto.ProcessoMovimentacoesDriveResponse;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

/**
 * Roteia «Obter movimentações» conforme {@code processo.tramitacao}.
 */
@Service
public class ProcessoMovimentacoesDriveService {

    private final ProcessoRepository processoRepository;
    private final ProcessoProjudiMovimentacoesDriveService projudiMovimentacoesDriveService;
    private final PjeCopiaIntegralPorProcessoService pjeCopiaIntegralPorProcessoService;

    public ProcessoMovimentacoesDriveService(
            ProcessoRepository processoRepository,
            ProcessoProjudiMovimentacoesDriveService projudiMovimentacoesDriveService,
            PjeCopiaIntegralPorProcessoService pjeCopiaIntegralPorProcessoService) {
        this.processoRepository = processoRepository;
        this.projudiMovimentacoesDriveService = projudiMovimentacoesDriveService;
        this.pjeCopiaIntegralPorProcessoService = pjeCopiaIntegralPorProcessoService;
    }

    public ProcessoMovimentacoesDriveResponse executar(Long processoId) {
        ProcessoEntity processo = processoRepository
                .findByIdWithClienteAndPessoa(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));

        String tramitacaoNorm = ProcessoTramitacaoService.normalizarTramitacao(processo.getTramitacao());
        String tramitacaoExibicao = tramitacaoNorm != null ? tramitacaoNorm : processo.getTramitacao();

        if (ProcessoTramitacaoService.ehProjudi(tramitacaoNorm)) {
            return ProcessoMovimentacoesDriveResponse.fromProjudi(
                    tramitacaoExibicao, projudiMovimentacoesDriveService.executar(processoId));
        }

        if (ProcessoTramitacaoService.ehPje(tramitacaoNorm)) {
            String cnj = processo.getNumeroCnj();
            if (!StringUtils.hasText(cnj)) {
                throw new BusinessRuleException("Processo sem número CNJ — não é possível consultar o PJe.");
            }
            pjeCopiaIntegralPorProcessoService.dispararAssincrono(cnj.trim());
            return ProcessoMovimentacoesDriveResponse.pjeIniciado(tramitacaoExibicao);
        }

        String msg =
                "Sem sistema digital para consulta automática; defina a tramitação (Projudi ou PJe).";
        return ProcessoMovimentacoesDriveResponse.semSistema(tramitacaoExibicao, msg);
    }
}
