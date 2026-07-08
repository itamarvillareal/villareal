package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.documento.ContratoHonorariosPersistenciaService;
import br.com.vilareal.documento.importacao.ContratoHonorariosImportacaoStatus;
import br.com.vilareal.documento.importacao.infrastructure.persistence.entity.ContratoHonorariosImportacaoEntity;
import br.com.vilareal.documento.importacao.infrastructure.persistence.repository.ContratoHonorariosImportacaoRepository;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.pagamento.api.dto.PagamentoCancelarRequest;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.processo.application.ProcessoExclusaoService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Clock;
import java.time.Instant;
import java.util.Objects;
import java.util.Set;

@Service
public class ContratoHonorariosImportacaoReversaoService {

    private static final Set<String> STATUS_ENCERRADO =
            Set.of(PagamentoDominio.ST_RECEBIDO, PagamentoDominio.ST_CONCILIADO);

    private final ContratoHonorariosRepository contratoRepository;
    private final ContratoHonorariosImportacaoRepository importacaoRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoExclusaoService processoExclusaoService;
    private final PagamentoApplicationService pagamentoApplicationService;
    private final Clock clock;

    public ContratoHonorariosImportacaoReversaoService(
            ContratoHonorariosRepository contratoRepository,
            ContratoHonorariosImportacaoRepository importacaoRepository,
            ProcessoRepository processoRepository,
            ProcessoExclusaoService processoExclusaoService,
            PagamentoApplicationService pagamentoApplicationService,
            Clock clock) {
        this.contratoRepository = contratoRepository;
        this.importacaoRepository = importacaoRepository;
        this.processoRepository = processoRepository;
        this.processoExclusaoService = processoExclusaoService;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.clock = clock;
    }

    @Transactional
    public void reverter(Long importacaoId) {
        ContratoHonorariosImportacaoEntity item = importacaoRepository
                .findById(importacaoId)
                .orElseThrow(() -> new IllegalArgumentException("Importação não encontrada: " + importacaoId));
        if (ContratoHonorariosImportacaoStatus.REVERTIDO.name().equals(item.getStatus())) {
            throw new BusinessRuleException("Importação já revertida.");
        }
        if (item.getContratoHonorarios() != null) {
            reverterContrato(item.getContratoHonorarios().getId());
        }
        if (Boolean.TRUE.equals(item.getProcessoStubCriado()) && item.getProcesso() != null) {
            Long pid = item.getProcesso().getId();
            processoRepository.findById(pid).ifPresent(p -> {
                if (Objects.equals(p.getImportacaoItemId(), item.getId())) {
                    processoExclusaoService.excluirPorIds(java.util.List.of(pid));
                }
            });
        }
        item.setStatus(ContratoHonorariosImportacaoStatus.REVERTIDO.name());
        item.setHashPdfAtivo(null);
        item.setRevertidoEm(Instant.now(clock));
        item.setAtualizadoEm(Instant.now(clock));
        importacaoRepository.save(item);
    }

    private void reverterContrato(Long contratoId) {
        ContratoHonorariosEntity contrato = contratoRepository
                .findById(contratoId)
                .orElseThrow(() -> new BusinessRuleException("Contrato não encontrado."));
        if (contrato.getProcesso() != null) {
            contrato = contratoRepository
                    .findByProcessoIdWithDetalhes(contrato.getProcesso().getId())
                    .orElse(contrato);
        }
        if (contrato.getParcelas() != null) {
            for (ContratoHonorariosParcelaEntity parcela : contrato.getParcelas()) {
                PagamentoEntity pag = parcela.getPagamento();
                if (pag != null) {
                    if (STATUS_ENCERRADO.contains(pag.getStatus())
                            || (pag.getFinanceiroLancamento() != null
                                    && pag.getFinanceiroLancamento().getId() != null)) {
                        throw new BusinessRuleException(
                                "Não é possível reverter: parcela "
                                        + parcela.getNumeroParcela()
                                        + " já conciliada/recebida.");
                    }
                    PagamentoCancelarRequest cancel = new PagamentoCancelarRequest();
                    cancel.setObservacao("Reversão importação contrato");
                    pagamentoApplicationService.cancelar(pag.getId(), cancel);
                }
            }
        }
        contratoRepository.delete(contrato);
    }
}
