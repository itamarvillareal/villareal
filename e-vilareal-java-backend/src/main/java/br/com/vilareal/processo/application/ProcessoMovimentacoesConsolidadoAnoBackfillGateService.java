package br.com.vilareal.processo.application;

import br.com.vilareal.jobrun.domain.JobNames;
import br.com.vilareal.jobrun.domain.JobRunStatus;
import br.com.vilareal.jobrun.infrastructure.persistence.repository.JobRunRepository;
import org.springframework.stereotype.Service;

/**
 * Impede reexecução automática do backfill consolidado por ano CNJ após conclusão bem-sucedida.
 */
@Service
public class ProcessoMovimentacoesConsolidadoAnoBackfillGateService {

    private final JobRunRepository jobRunRepository;

    public ProcessoMovimentacoesConsolidadoAnoBackfillGateService(JobRunRepository jobRunRepository) {
        this.jobRunRepository = jobRunRepository;
    }

    public boolean jaConcluidoComSucesso(int ano) {
        if (ano < 2000 || ano > 2100) {
            return false;
        }
        return jobRunRepository.countConsolidadoAnoBackfillConcluido(JobNames.CONSOLIDADO_DRIVE_BACKFILL, ano) > 0;
    }

    /** Evita segundo job no boot enquanto um backfill consolidado ainda está RUNNING. */
    public boolean haExecucaoEmAndamento() {
        return jobRunRepository.existsByJobNameAndStatus(
                JobNames.CONSOLIDADO_DRIVE_BACKFILL, JobRunStatus.RUNNING);
    }

    public boolean deveDispararNoStartup(int ano) {
        if (ano < 2000 || ano > 2100) {
            return false;
        }
        if (jaConcluidoComSucesso(ano)) {
            return false;
        }
        return !haExecucaoEmAndamento();
    }
}
