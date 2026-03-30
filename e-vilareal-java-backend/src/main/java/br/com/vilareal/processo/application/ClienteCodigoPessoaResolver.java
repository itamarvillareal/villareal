package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.importacao.PlanilhaPasta1MapeamentoUtil;
import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import br.com.vilareal.importacao.infrastructure.persistence.repository.PlanilhaPasta1ClienteRepository;
import org.springframework.stereotype.Service;

import java.util.Optional;

/**
 * Resolve o código de cliente (8 dígitos ou chave da planilha Pasta1) para {@code pessoa.id},
 * consultando {@code planilha_pasta1_cliente} antes da convenção legada (código = id da pessoa).
 */
@Service
public class ClienteCodigoPessoaResolver {

    private final PlanilhaPasta1ClienteRepository planilhaPasta1ClienteRepository;

    public ClienteCodigoPessoaResolver(PlanilhaPasta1ClienteRepository planilhaPasta1ClienteRepository) {
        this.planilhaPasta1ClienteRepository = planilhaPasta1ClienteRepository;
    }

    public long resolverPessoaId(String codigoCliente) {
        if (codigoCliente == null || codigoCliente.isBlank()) {
            throw new BusinessRuleException("codigoCliente é obrigatório");
        }
        return buscarMapeamentoPlanilha(codigoCliente.trim())
                .map(PlanilhaPasta1ClienteEntity::getPessoaId)
                .orElseGet(() -> CodigoClienteUtil.parsePessoaId(codigoCliente));
    }

    /** Só a tabela Pasta1 — sem fallback “código = id da pessoa”. */
    public Optional<Long> resolverPessoaIdSomentePlanilha(String codigoCliente) {
        if (codigoCliente == null || codigoCliente.isBlank()) {
            return Optional.empty();
        }
        return buscarMapeamentoPlanilha(codigoCliente.trim()).map(PlanilhaPasta1ClienteEntity::getPessoaId);
    }

    /** {@code true} quando há import Pasta1 gravado — UI e APIs não devem assumir cliente N = pessoa N. */
    public boolean haMapeamentosPlanilhaPasta1() {
        return planilhaPasta1ClienteRepository.count() > 0;
    }

    public Optional<PlanilhaPasta1ClienteEntity> buscarMapeamentoPlanilha(String codigoOuChave) {
        if (codigoOuChave == null || codigoOuChave.isBlank()) {
            return Optional.empty();
        }
        return PlanilhaPasta1MapeamentoUtil.escolherMelhorMapeamento(
                planilhaPasta1ClienteRepository.findAll(), codigoOuChave.trim());
    }

    /** Ex.: {@code "00000001"} → {@code "1"}; só altera se a string for só dígitos. */
    public static String compactarChaveSoDigitos(String cod) {
        String s = cod.trim();
        if (s.isEmpty() || !s.chars().allMatch(Character::isDigit)) {
            return s;
        }
        String stripped = s.replaceFirst("^0+(?!$)", "");
        return stripped.isEmpty() ? "0" : stripped;
    }
}
