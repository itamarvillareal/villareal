package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Collection;
import java.util.HashSet;
import java.util.Set;

/**
 * Utilitário de deduplicação para importação de extrato (API futura).
 * Não altera {@code criarLancamento} manual nem o pipeline OFX existente.
 */
@Service
public class LancamentoFinanceiroImportDedupService {

    public enum AcaoImportacaoExtrato {
        /** Chave (numero_banco, numero_lancamento) ainda não existe — pode inserir. */
        INSERIR,
        /** Já existe lançamento com a mesma chave — ignorar duplicata. */
        SKIP_JA_EXISTE
    }

    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final FinanceiroExtratoAcessoService extratoAcessoService;

    public LancamentoFinanceiroImportDedupService(
            LancamentoFinanceiroRepository lancamentoRepository,
            FinanceiroExtratoAcessoService extratoAcessoService) {
        this.lancamentoRepository = lancamentoRepository;
        this.extratoAcessoService = extratoAcessoService;
    }

    /**
     * Avalia uma linha candidata à importação.
     * Sem {@code numero_banco} ou {@code numero_lancamento}, a dedup por chave composta não se aplica
     * (retorna {@link AcaoImportacaoExtrato#INSERIR}).
     */
    @Transactional(readOnly = true)
    public AcaoImportacaoExtrato avaliarLinhaImportacao(Integer numeroBanco, String numeroLancamento) {
        if (!chaveDedupCompleta(numeroBanco, numeroLancamento)) {
            return AcaoImportacaoExtrato.INSERIR;
        }
        boolean existe = lancamentoRepository.existsByNumeroBancoAndNumeroLancamento(
                numeroBanco, numeroLancamento.trim());
        return existe ? AcaoImportacaoExtrato.SKIP_JA_EXISTE : AcaoImportacaoExtrato.INSERIR;
    }

    @Transactional(readOnly = true)
    public boolean lancamentoJaExiste(Integer numeroBanco, String numeroLancamento) {
        return avaliarLinhaImportacao(numeroBanco, numeroLancamento) == AcaoImportacaoExtrato.SKIP_JA_EXISTE;
    }

    /**
     * Retorna os {@code numero_lancamento} já presentes para o banco informado (consulta em lote).
     */
    @Transactional(readOnly = true)
    public Set<String> numerosLancamentoJaExistentes(Integer numeroBanco, Collection<String> numerosLancamento) {
        if (numeroBanco == null || numerosLancamento == null || numerosLancamento.isEmpty()) {
            return Set.of();
        }
        extratoAcessoService.assertAcessoExtratoBanco(numeroBanco);
        Set<String> candidatos = new HashSet<>();
        for (String n : numerosLancamento) {
            if (StringUtils.hasText(n)) {
                candidatos.add(n.trim());
            }
        }
        if (candidatos.isEmpty()) {
            return Set.of();
        }
        return new HashSet<>(lancamentoRepository.findNumeroLancamentoExistentesPorBanco(numeroBanco, candidatos));
    }

    private static boolean chaveDedupCompleta(Integer numeroBanco, String numeroLancamento) {
        return numeroBanco != null && StringUtils.hasText(numeroLancamento);
    }
}
