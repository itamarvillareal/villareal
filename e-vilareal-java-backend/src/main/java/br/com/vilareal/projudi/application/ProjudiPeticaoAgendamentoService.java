package br.com.vilareal.projudi.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.List;

@Service
public class ProjudiPeticaoAgendamentoService {

    private static final String STATUS_ASSINADA = ProjudiPeticaoAssinaturaService.STATUS_PETICAO_ASSINADA;
    private static final String STATUS_PENDENTE = ProjudiPeticaoRegistroService.STATUS_PENDENTE_ASSINATURA;

    private final ProjudiPeticaoRepository peticaoRepository;
    private final Clock clock;

    public ProjudiPeticaoAgendamentoService(ProjudiPeticaoRepository peticaoRepository, Clock clock) {
        this.peticaoRepository = peticaoRepository;
        this.clock = clock;
    }

    @Transactional
    public void agendarProtocolo(Long peticaoId, Instant agendadoPara) {
        validarHorario(agendadoPara);
        ProjudiPeticaoEntity peticao = peticaoRepository
                .findById(peticaoId)
                .orElseThrow(() -> new IllegalArgumentException("Petição não encontrada: " + peticaoId));
        validarStatusAgendavel(peticao);
        peticao.setProtocoloAgendadoPara(agendadoPara);
        peticaoRepository.save(peticao);
    }

    @Transactional
    public void agendarProtocoloLote(List<Long> peticaoIds, Instant agendadoPara) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            throw new IllegalArgumentException("peticaoIds é obrigatório (ao menos um id).");
        }
        validarHorario(agendadoPara);
        for (Long id : peticaoIds) {
            agendarProtocolo(id, agendadoPara);
        }
    }

    @Transactional
    public void cancelarAgendamento(Long peticaoId) {
        if (peticaoId == null) {
            throw new IllegalArgumentException("peticaoId é obrigatório.");
        }
        ProjudiPeticaoEntity peticao = peticaoRepository
                .findById(peticaoId)
                .orElseThrow(() -> new IllegalArgumentException("Petição não encontrada: " + peticaoId));
        validarCancelamentoPermitido(peticao);
        int afetadas = peticaoRepository.cancelarAgendamentoSePermitido(peticaoId);
        if (afetadas == 0) {
            throw new BusinessRuleException(mensagemCancelamentoNegado(peticao));
        }
    }

    @Transactional
    public void cancelarAgendamentoLote(List<Long> peticaoIds) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            throw new IllegalArgumentException("peticaoIds é obrigatório (ao menos um id).");
        }
        for (Long id : peticaoIds) {
            cancelarAgendamento(id);
        }
    }

    @Transactional(readOnly = true)
    public List<Long> listarIdsProntasParaDisparo() {
        return peticaoRepository.findIdsProntasParaProtocoloAgendado(clock.instant());
    }

    /** Revalida antes do disparo (evita protocolar após cancelamento no mesmo minuto). */
    @Transactional(readOnly = true)
    public List<Long> resolverIdsParaDisparoAgora() {
        List<Long> candidatas = listarIdsProntasParaDisparo();
        if (candidatas.isEmpty()) {
            return List.of();
        }
        return peticaoRepository.filtrarIdsComAgendamentoAtivo(candidatas);
    }

    private static void validarCancelamentoPermitido(ProjudiPeticaoEntity peticao) {
        if (peticao.getProtocoloAgendadoPara() == null) {
            throw new BusinessRuleException("Esta petição não possui agendamento de protocolo.");
        }
        String status = peticao.getStatus();
        if (ProjudiPeticaoRegistroService.STATUS_PETICAO_PROTOCOLANDO.equals(status)) {
            throw new BusinessRuleException(
                    "Não é possível cancelar: o protocolo já está em andamento (PROTOCOLANDO).");
        }
        if (ProjudiPeticaoRegistroService.STATUS_PETICAO_PROTOCOLADA.equals(status)) {
            throw new BusinessRuleException("Não é possível cancelar: o protocolo já foi concluído.");
        }
    }

    private static String mensagemCancelamentoNegado(ProjudiPeticaoEntity peticao) {
        String status = peticao.getStatus();
        if (ProjudiPeticaoRegistroService.STATUS_PETICAO_PROTOCOLANDO.equals(status)) {
            return "Não é possível cancelar: o protocolo já está em andamento.";
        }
        if (ProjudiPeticaoRegistroService.STATUS_PETICAO_PROTOCOLADA.equals(status)) {
            return "Não é possível cancelar: o protocolo já foi concluído.";
        }
        if (peticao.getProtocoloAgendadoPara() == null) {
            return "Agendamento já foi cancelado ou não existe.";
        }
        return "Não foi possível cancelar o agendamento (status atual: " + status + ").";
    }

    private void validarHorario(Instant agendadoPara) {
        if (agendadoPara == null) {
            throw new IllegalArgumentException("agendadoPara é obrigatório.");
        }
        if (!agendadoPara.isAfter(clock.instant())) {
            throw new BusinessRuleException("O horário do agendamento deve ser no futuro.");
        }
    }

    private static void validarStatusAgendavel(ProjudiPeticaoEntity peticao) {
        String status = peticao.getStatus();
        if (!STATUS_ASSINADA.equals(status) && !STATUS_PENDENTE.equals(status)) {
            throw new BusinessRuleException(
                    "Só é possível agendar protocolo de petição ASSINADA ou pendente de assinatura (atual: "
                            + status
                            + ").");
        }
    }
}
