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
 * Roteia «Obter movimentações» conforme {@code processo.tramitacao} e, para CNJ TRT18
 * ({@code .5.18.}), dispara cópia integral PJe mesmo com tramitação vazia.
 */
@Service
public class ProcessoMovimentacoesDriveService {

    private final ProcessoRepository processoRepository;
    private final ProcessoProjudiMovimentacoesDriveService projudiMovimentacoesDriveService;
    private final PjeCopiaIntegralPorProcessoService pjeCopiaIntegralPorProcessoService;
    private final ProcessoTramitacaoService processoTramitacaoService;

    public ProcessoMovimentacoesDriveService(
            ProcessoRepository processoRepository,
            ProcessoProjudiMovimentacoesDriveService projudiMovimentacoesDriveService,
            PjeCopiaIntegralPorProcessoService pjeCopiaIntegralPorProcessoService,
            ProcessoTramitacaoService processoTramitacaoService) {
        this.processoRepository = processoRepository;
        this.projudiMovimentacoesDriveService = projudiMovimentacoesDriveService;
        this.pjeCopiaIntegralPorProcessoService = pjeCopiaIntegralPorProcessoService;
        this.processoTramitacaoService = processoTramitacaoService;
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

        String cnj = StringUtils.hasText(processo.getNumeroCnj()) ? processo.getNumeroCnj().trim() : null;
        boolean cnjTrt18 = cnj != null && ProcessoTramitacaoService.cnjEhTrt18(cnj);

        if (ProcessoTramitacaoService.ehPje(tramitacaoNorm) || cnjTrt18) {
            if (cnj == null) {
                throw new BusinessRuleException("Processo sem número CNJ — não é possível consultar o PJe.");
            }
            if (cnjTrt18 && tramitacaoNorm == null) {
                processoTramitacaoService.preencherSeVazioPorCnj(processoId, cnj);
            }
            pjeCopiaIntegralPorProcessoService.dispararAssincrono(cnj);
            String tramitacaoResposta = tramitacaoExibicao != null
                    ? tramitacaoExibicao
                    : ProcessoTramitacaoService.TRAMITACAO_PJE;
            return ProcessoMovimentacoesDriveResponse.pjeIniciado(tramitacaoResposta);
        }

        String msg =
                "Sem sistema digital para consulta automática; defina a tramitação (Projudi ou PJe).";
        return ProcessoMovimentacoesDriveResponse.semSistema(tramitacaoExibicao, msg);
    }
}
