package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaBancariaEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaBancariaRepository;
import org.springframework.context.annotation.Lazy;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;

/**
 * Ponto ÚNICO para resolver a {@link ContaBancariaEntity} de um lançamento a partir do seu
 * {@code numero_banco} (Fase 3, item 3 — FASE B, sub-passo B1).
 *
 * <p>Toda criação de {@code financeiro_lancamento} (API {@code criarLancamento}/imports e o débito de
 * repasse interno) chama {@link #resolver(Integer, String)} após setar o {@code numero_banco}, de modo
 * que a FK {@code conta_bancaria_id} nasça sempre populada — fechando o gap entre o backfill da FASE A
 * e os lançamentos criados depois.
 *
 * <p>B1 NÃO muda decisão: ninguém lê {@code conta_bancaria} para decidir comportamento ainda
 * (conciliação/manual seguem por {@code numero_banco}). Só garante a FK preenchida (pré-requisito B2/B3).
 *
 * <p>Se não existir conta para o {@code numero_banco}, auto-provisiona uma (tipo REAL, com extrato) em
 * transação própria, tratando corrida pelo UK {@code numero_banco} (em conflito, re-busca a existente).
 */
@Service
public class ContaBancariaResolverService {

    private static final int NUMERO_BANCO_99_PAY = 30;
    private static final String NOME_BANCO_99_PAY = "99 pay";

    private final ContaBancariaRepository contaBancariaRepository;
    private final ContaBancariaResolverService self;

    public ContaBancariaResolverService(
            ContaBancariaRepository contaBancariaRepository,
            @Lazy ContaBancariaResolverService self) {
        this.contaBancariaRepository = contaBancariaRepository;
        this.self = self;
    }

    /**
     * Resolve a conta bancária do {@code numeroBanco}. {@code null} → {@code null} (lançamento sem banco
     * fica com FK nula, por design). Existente → retorna; ausente → auto-provisiona (REAL/extrato).
     */
    @Transactional
    public ContaBancariaEntity resolver(Integer numeroBanco, String bancoNome) {
        if (numeroBanco == null) {
            return null;
        }
        return contaBancariaRepository.findByNumeroBanco(numeroBanco)
                .orElseGet(() -> self.provisionar(numeroBanco, bancoNome));
    }

    /**
     * Cria a conta ausente em transação NOVA (isola eventual violação de UK do tx do chamador) e trata
     * corrida: re-checa antes de inserir e, se o INSERT colidir no UK {@code numero_banco}, re-busca a
     * conta criada concorrentemente em vez de duplicar/estourar.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ContaBancariaEntity provisionar(Integer numeroBanco, String bancoNome) {
        Optional<ContaBancariaEntity> existente = contaBancariaRepository.findByNumeroBanco(numeroBanco);
        if (existente.isPresent()) {
            return existente.get();
        }
        ContaBancariaEntity nova = new ContaBancariaEntity();
        nova.setNumeroBanco(numeroBanco);
        nova.setBancoNome(nomeCanonico(numeroBanco, bancoNome));
        nova.setTipo("REAL");
        nova.setTemExtrato(true);
        nova.setAtivo(true);
        try {
            return contaBancariaRepository.saveAndFlush(nova);
        } catch (DataIntegrityViolationException corrida) {
            return contaBancariaRepository.findByNumeroBanco(numeroBanco)
                    .orElseThrow(() -> corrida);
        }
    }

    private static String nomeCanonico(Integer numeroBanco, String bancoNome) {
        if (numeroBanco != null && numeroBanco == NUMERO_BANCO_99_PAY) {
            return NOME_BANCO_99_PAY;
        }
        return StringUtils.hasText(bancoNome) ? bancoNome.trim() : null;
    }
}
