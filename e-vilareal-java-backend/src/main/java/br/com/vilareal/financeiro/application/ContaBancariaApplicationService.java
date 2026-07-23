package br.com.vilareal.financeiro.application;

import br.com.vilareal.financeiro.api.dto.ContaBancariaResponse;
import br.com.vilareal.financeiro.api.dto.ContaBancariaWriteRequest;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaBancariaEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaBancariaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;
import java.util.Set;

/**
 * Fonte de verdade da classificação de contas bancárias (Fase 3, item 3 — FASE B/B3).
 *
 * <p>B3 troca a FONTE da distinção manual/real/virtual de hardcode (frontend {@code financeiroData.js}
 * com 9/17/18 manuais e 900 virtual) para o dado em {@code conta_bancaria} ({@code tipo}/{@code tem_extrato}).
 * Como a FASE A semeou {@code tem_extrato=FALSE} exatamente para 9/17/18/900, ler o dado é
 * behavior-preserving — as mesmas contas seguem manuais/virtual.
 *
 * <p>A leitura por lançamento usa a FK {@code conta_bancaria_id} (V116) e, como FALLBACK de transição
 * (linhas do intervalo A→B com FK nula), resolve por {@code numero_banco}. O fallback sai na FASE C.
 */
@Service
public class ContaBancariaApplicationService {

    private static final String TIPO_MANUAL = "MANUAL";
    private static final String TIPO_VIRTUAL = "VIRTUAL";
    private static final String TIPO_REAL = "REAL";

    private final ContaBancariaRepository contaBancariaRepository;
    private final FinanceiroExtratoAcessoService extratoAcessoService;

    public ContaBancariaApplicationService(
            ContaBancariaRepository contaBancariaRepository,
            FinanceiroExtratoAcessoService extratoAcessoService) {
        this.contaBancariaRepository = contaBancariaRepository;
        this.extratoAcessoService = extratoAcessoService;
    }

    /** Classificação de todas as contas (endpoint para o frontend consumir no B4). */
    @Transactional(readOnly = true)
    public List<ContaBancariaResponse> listar() {
        Optional<Set<Integer>> permitidos = extratoAcessoService.numerosBancosPermitidos();
        return contaBancariaRepository.findAllByOrderByNumeroBancoAsc().stream()
                .filter(c -> permitidos.isEmpty() || permitidos.get().contains(c.getNumeroBanco()))
                .map(ContaBancariaApplicationService::toResponse)
                .toList();
    }

    /**
     * Cadastra conta bancária explicitamente (antes do 1º lançamento). Idempotência de número fica a cargo
     * do UK {@code numero_banco} — em conflito, retorna erro claro em vez de falhar silenciosamente.
     */
    @Transactional
    public ContaBancariaResponse criar(ContaBancariaWriteRequest req) {
        if (req == null || req.numeroBanco() == null) {
            throw new IllegalArgumentException("numeroBanco é obrigatório.");
        }
        if (contaBancariaRepository.findByNumeroBanco(req.numeroBanco()).isPresent()) {
            throw new IllegalArgumentException(
                    "Já existe conta bancária com numero_banco " + req.numeroBanco() + ".");
        }
        String nome = StringUtils.hasText(req.bancoNome()) ? req.bancoNome().trim() : null;
        if (!StringUtils.hasText(nome)) {
            throw new IllegalArgumentException("bancoNome é obrigatório.");
        }
        String tipo = StringUtils.hasText(req.tipo()) ? req.tipo().trim().toUpperCase() : TIPO_REAL;
        if (!TIPO_REAL.equals(tipo) && !TIPO_MANUAL.equals(tipo) && !TIPO_VIRTUAL.equals(tipo)) {
            throw new IllegalArgumentException("tipo deve ser REAL, MANUAL ou VIRTUAL.");
        }

        ContaBancariaEntity nova = new ContaBancariaEntity();
        nova.setNumeroBanco(req.numeroBanco());
        nova.setBancoNome(nome);
        nova.setTipo(tipo);
        nova.setTemExtrato(req.temExtrato() != null ? req.temExtrato() : temExtratoPadrao(tipo));
        nova.setAtivo(req.ativo() == null || req.ativo());
        nova.setOfxBankId(trimToNull(req.ofxBankId()));
        nova.setOfxAgencia(trimToNull(req.ofxAgencia()));
        nova.setOfxConta(trimToNull(req.ofxConta()));
        nova.setExigeSomaZero(false);
        return toResponse(contaBancariaRepository.saveAndFlush(nova));
    }

    private static boolean temExtratoPadrao(String tipo) {
        return TIPO_REAL.equals(tipo);
    }

    private static String trimToNull(String value) {
        if (!StringUtils.hasText(value)) {
            return null;
        }
        return value.trim();
    }

    static ContaBancariaResponse toResponse(ContaBancariaEntity c) {
        return new ContaBancariaResponse(
                c.getNumeroBanco(),
                c.getBancoNome(),
                c.getTipo(),
                Boolean.TRUE.equals(c.getTemExtrato()),
                Boolean.TRUE.equals(c.getAtivo()),
                c.getOfxBankId(),
                c.getOfxAgencia(),
                c.getOfxConta(),
                Boolean.TRUE.equals(c.getExigeSomaZero()));
    }

    /**
     * Conta bancária do lançamento: pela FK quando presente; senão (transição A→B) pelo {@code numero_banco}.
     */
    @Transactional(readOnly = true)
    public Optional<ContaBancariaEntity> contaDoLancamento(LancamentoFinanceiroEntity lancamento) {
        if (lancamento == null) {
            return Optional.empty();
        }
        if (lancamento.getContaBancaria() != null) {
            return Optional.of(lancamento.getContaBancaria());
        }
        if (lancamento.getNumeroBanco() == null) {
            return Optional.empty();
        }
        return contaBancariaRepository.findByNumeroBanco(lancamento.getNumeroBanco());
    }

    /**
     * Conta com extrato (participa da conciliação por extrato). Sem conta resolvível → {@code true}
     * (default REAL/com extrato, coerente com o auto-provisionamento do B1).
     */
    @Transactional(readOnly = true)
    public boolean temExtrato(LancamentoFinanceiroEntity lancamento) {
        return contaDoLancamento(lancamento)
                .map(c -> Boolean.TRUE.equals(c.getTemExtrato()))
                .orElse(true);
    }

    /** Lançamento de conta MANUAL (lançado à mão; sem extrato). */
    @Transactional(readOnly = true)
    public boolean isManual(LancamentoFinanceiroEntity lancamento) {
        return contaDoLancamento(lancamento)
                .map(c -> TIPO_MANUAL.equals(c.getTipo()))
                .orElse(false);
    }

    /** Tipo da conta do lançamento (REAL|MANUAL|VIRTUAL); sem conta resolvível → REAL. */
    @Transactional(readOnly = true)
    public String tipo(LancamentoFinanceiroEntity lancamento) {
        return contaDoLancamento(lancamento)
                .map(ContaBancariaEntity::getTipo)
                .orElse("REAL");
    }

    /** Conta de acerto (CONTA ZERO): grupos soma zero exata + vínculo obrigatório. */
    @Transactional(readOnly = true)
    public boolean exigeSomaZero(LancamentoFinanceiroEntity lancamento) {
        return contaDoLancamento(lancamento)
                .map(c -> Boolean.TRUE.equals(c.getExigeSomaZero()))
                .orElse(false);
    }

    /** Conta de acerto por numero_banco (para validar antes de criar o lançamento). */
    @Transactional(readOnly = true)
    public boolean exigeSomaZero(Integer numeroBanco) {
        if (numeroBanco == null) {
            return false;
        }
        return contaBancariaRepository.findByNumeroBanco(numeroBanco)
                .map(c -> Boolean.TRUE.equals(c.getExigeSomaZero()))
                .orElse(false);
    }
}
