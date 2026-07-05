package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.pje.application.PjeCopiaIntegralPorProcessoService;
import br.com.vilareal.pje.application.PjeTribunalCnjResolver;
import br.com.vilareal.pje.domain.PjeGrau;
import br.com.vilareal.pje.domain.PjeTribunal;
import br.com.vilareal.processo.api.dto.PjeCopiaIntegralStatusResponse;
import br.com.vilareal.processo.api.dto.ProcessoMovimentacoesDriveResponse;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Optional;

/**
 * Roteia «Obter movimentações» conforme {@code processo.tramitacao}, tribunal/grau PJe
 * e fallback CNJ TRT18 ({@code .5.18.}) quando tramitação ainda não foi preenchida.
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
        boolean tramitacaoPje = ProcessoTramitacaoService.ehPje(tramitacaoNorm);

        if (tramitacaoPje || (tramitacaoNorm == null && cnjTrt18)) {
            if (cnj == null) {
                throw new BusinessRuleException("Processo sem número CNJ — não é possível consultar o PJe.");
            }

            PjeTribunal tribunalEfetivo = resolverTribunalEfetivo(processo, cnj, cnjTrt18, tramitacaoNorm);
            if (tribunalEfetivo == null || !tribunalEfetivo.automacaoCopiaIntegralDisponivel()) {
                return ProcessoMovimentacoesDriveResponse.pjeAutomacaoIndisponivel(
                        tramitacaoExibicao != null ? tramitacaoExibicao : ProcessoTramitacaoService.TRAMITACAO_PJE,
                        mensagemAutomacaoIndisponivel(tribunalEfetivo));
            }

            if (cnjTrt18 && tramitacaoNorm == null) {
                processoTramitacaoService.preencherSeVazioPorCnj(processoId, cnj);
            }

            String tramitacaoResposta = tramitacaoExibicao != null
                    ? tramitacaoExibicao
                    : ProcessoTramitacaoService.TRAMITACAO_PJE;

            Optional<String> erroPreflight = pjeCopiaIntegralPorProcessoService.validarDisparoAssincrono();
            if (erroPreflight.isPresent()) {
                return ProcessoMovimentacoesDriveResponse.pjeFalha(tramitacaoResposta, erroPreflight.get());
            }

            PjeGrau grauSalvo = processo.getPjeGrau();
            pjeCopiaIntegralPorProcessoService.dispararAssincrono(cnj, grauSalvo);
            return ProcessoMovimentacoesDriveResponse.pjeIniciado(tramitacaoResposta);
        }

        String msg =
                "Sem sistema digital para consulta automática; defina a tramitação (Projudi ou PJe).";
        return ProcessoMovimentacoesDriveResponse.semSistema(tramitacaoExibicao, msg);
    }

    public PjeCopiaIntegralStatusResponse consultarStatusPje(Long processoId) {
        ProcessoEntity processo = processoRepository
                .findById(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        String cnj = processo.getNumeroCnj();
        if (!StringUtils.hasText(cnj)) {
            return PjeCopiaIntegralStatusResponse.nenhum();
        }
        return pjeCopiaIntegralPorProcessoService
                .consultarStatus(cnj.trim())
                .map(PjeCopiaIntegralStatusResponse::from)
                .orElse(PjeCopiaIntegralStatusResponse.nenhum());
    }

    private static PjeTribunal resolverTribunalEfetivo(
            ProcessoEntity processo, String cnj, boolean cnjTrt18, String tramitacaoNorm) {
        if (processo.getPjeTribunal() != null) {
            return processo.getPjeTribunal();
        }
        if (cnjTrt18 && tramitacaoNorm == null) {
            return PjeTribunal.PJE_TRT18;
        }
        return PjeTribunalCnjResolver.resolverPorCnj(cnj).orElse(null);
    }

    private static String mensagemAutomacaoIndisponivel(PjeTribunal tribunal) {
        if (tribunal == null) {
            return "Automação de cópia integral indisponível — defina o tribunal PJe no cadastro do processo.";
        }
        return "Automação de cópia integral indisponível para "
                + tribunal.rotuloExibicao()
                + "; hoje só TRT18 está automatizado.";
    }
}
