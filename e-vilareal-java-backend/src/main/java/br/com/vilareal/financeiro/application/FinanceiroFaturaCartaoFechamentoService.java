package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.FaturaCartaoFechamentoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FaturaCartaoFechamentoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoCartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.PagamentoFaturaVinculoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Optional;

/**
 * Gera lançamento crédito-síntese (AUTO-FAT) no vencimento da fatura — nunca na importação.
 * Escopo: pagamento integral no vencimento (sem parcial/atraso com juros).
 */
@Service
public class FinanceiroFaturaCartaoFechamentoService {

    private static final Logger log = LoggerFactory.getLogger(FinanceiroFaturaCartaoFechamentoService.class);

    static final String PREFIXO_NUMERO = "AUTO-FAT-";
    static final String ORIGEM_AUTO = "AUTO";
    /** Conta N — visível no extrato do cartão e nos pendentes até conferência com o banco. */
    static final String CONTA_FECHAMENTO = "N";
    static final String CONTA_APOS_VINCULO_BANCO = "E";

    private static final DateTimeFormatter FMT_VENC = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final LancamentoCartaoRepository lancamentoCartaoRepository;
    private final CartaoRepository cartaoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final FaturaCartaoFechamentoRepository fechamentoRepository;
    private final PagamentoFaturaVinculoRepository pagamentoFaturaVinculoRepository;
    private final FinanceiroSaudeService financeiroSaudeService;

    public FinanceiroFaturaCartaoFechamentoService(
            LancamentoCartaoRepository lancamentoCartaoRepository,
            CartaoRepository cartaoRepository,
            ContaContabilRepository contaContabilRepository,
            FaturaCartaoFechamentoRepository fechamentoRepository,
            PagamentoFaturaVinculoRepository pagamentoFaturaVinculoRepository,
            FinanceiroSaudeService financeiroSaudeService) {
        this.lancamentoCartaoRepository = lancamentoCartaoRepository;
        this.cartaoRepository = cartaoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.fechamentoRepository = fechamentoRepository;
        this.pagamentoFaturaVinculoRepository = pagamentoFaturaVinculoRepository;
        this.financeiroSaudeService = financeiroSaudeService;
    }

    public static boolean ehLancamentoFechamentoAutomatico(LancamentoCartaoEntity l) {
        if (l == null || l.getNumeroLancamento() == null) {
            return false;
        }
        return l.getNumeroLancamento().startsWith(PREFIXO_NUMERO);
    }

    public static String numeroLancamentoFechamento(Long cartaoId, LocalDate vencimento) {
        return PREFIXO_NUMERO + cartaoId + "-" + vencimento;
    }

    /**
     * Percorre ciclos (cartão + vencimento) com competência vencida e garante o AUTO-FAT idempotente.
     *
     * @return quantidade de fechamentos criados ou recalculados
     */
    @Transactional
    public int aplicarFechamentosAutomaticos() {
        LocalDate hoje = LocalDate.now();
        ContaContabilEntity contaE = contaContabilRepository
                .findFirstByCodigoIgnoreCase(CONTA_FECHAMENTO)
                .orElseThrow(() -> new BusinessRuleException("Conta contábil '" + CONTA_FECHAMENTO + "' não encontrada."));

        int processados = 0;
        for (Object[] row : lancamentoCartaoRepository.findCiclosVencidosParaFechamento(hoje)) {
            Long cartaoId = (Long) row[0];
            LocalDate vencimento = (LocalDate) row[1];
            if (processarCiclo(cartaoId, vencimento, contaE)) {
                processados++;
            }
        }
        if (processados > 0) {
            financeiroSaudeService.invalidarCacheSaude();
        }
        return processados;
    }

    private boolean processarCiclo(Long cartaoId, LocalDate vencimento, ContaContabilEntity contaE) {
        BigDecimal somaCompras = lancamentoCartaoRepository
                .somaComprasCiclo(cartaoId, vencimento)
                .setScale(2, RoundingMode.HALF_UP);
        if (somaCompras.compareTo(BigDecimal.ZERO) <= 0) {
            return false;
        }

        CartaoEntity cartao = cartaoRepository.findById(cartaoId)
                .orElseThrow(() -> new BusinessRuleException("Cartão não encontrado: " + cartaoId));
        if (Boolean.FALSE.equals(cartao.getAtivo())) {
            return false;
        }

        String numero = numeroLancamentoFechamento(cartaoId, vencimento);
        BigDecimal valorFechamento = somaCompras.negate();

        Optional<FaturaCartaoFechamentoEntity> fechamentoOpt =
                fechamentoRepository.findByCartaoIdAndDataVencimento(cartaoId, vencimento);

        LancamentoCartaoEntity lancamento;
        if (fechamentoOpt.isPresent()) {
            lancamento = fechamentoOpt.get().getLancamentoCartao();
            if (pagamentoFaturaVinculoRepository.findByLancamentoCartaoId(lancamento.getId()).isPresent()) {
                return false;
            }
            boolean mudou = sincronizarLancamento(lancamento, cartao, vencimento, valorFechamento, somaCompras, contaE);
            if (mudou) {
                fechamentoOpt.get().setValorTotal(somaCompras);
                fechamentoRepository.save(fechamentoOpt.get());
            }
            return mudou;
        }

        Optional<LancamentoCartaoEntity> legado =
                lancamentoCartaoRepository.findByCartaoIdAndNumeroLancamento(cartaoId, numero);
        if (legado.isPresent()) {
            lancamento = legado.get();
            if (pagamentoFaturaVinculoRepository.findByLancamentoCartaoId(lancamento.getId()).isPresent()) {
                registrarFechamentoSeAusente(cartao, vencimento, lancamento, somaCompras);
                return false;
            }
            boolean mudou = sincronizarLancamento(lancamento, cartao, vencimento, valorFechamento, somaCompras, contaE);
            registrarFechamentoSeAusente(cartao, vencimento, lancamento, somaCompras);
            return mudou;
        }

        lancamento = novoLancamentoFechamento(cartao, vencimento, valorFechamento, somaCompras, contaE, numero);
        lancamentoCartaoRepository.save(lancamento);

        FaturaCartaoFechamentoEntity fechamento = new FaturaCartaoFechamentoEntity();
        fechamento.setCartao(cartao);
        fechamento.setDataVencimento(vencimento);
        fechamento.setLancamentoCartao(lancamento);
        fechamento.setValorTotal(somaCompras);
        fechamentoRepository.save(fechamento);

        log.info("[cartao-fechamento] AUTO-FAT criado cartao={} vencimento={} total={} id={}",
                cartao.getNome(), vencimento, somaCompras, lancamento.getId());
        return true;
    }

    private void registrarFechamentoSeAusente(
            CartaoEntity cartao, LocalDate vencimento, LancamentoCartaoEntity lancamento, BigDecimal somaCompras) {
        if (fechamentoRepository.findByCartaoIdAndDataVencimento(cartao.getId(), vencimento).isPresent()) {
            return;
        }
        FaturaCartaoFechamentoEntity fechamento = new FaturaCartaoFechamentoEntity();
        fechamento.setCartao(cartao);
        fechamento.setDataVencimento(vencimento);
        fechamento.setLancamentoCartao(lancamento);
        fechamento.setValorTotal(somaCompras);
        fechamentoRepository.save(fechamento);
    }

    private boolean sincronizarLancamento(
            LancamentoCartaoEntity lancamento,
            CartaoEntity cartao,
            LocalDate vencimento,
            BigDecimal valorFechamento,
            BigDecimal somaCompras,
            ContaContabilEntity contaE) {
        boolean mudou = false;
        if (lancamento.getValor().compareTo(valorFechamento) != 0) {
            lancamento.setValor(valorFechamento);
            mudou = true;
        }
        String descricao = descricaoFechamento(cartao.getNome(), vencimento);
        if (!descricao.equals(lancamento.getDescricao())) {
            lancamento.setDescricao(descricao);
            mudou = true;
        }
        if (!contaE.getId().equals(lancamento.getContaContabil().getId())) {
            lancamento.setContaContabil(contaE);
            mudou = true;
        }
        if (!vencimento.equals(lancamento.getDataLancamento())) {
            lancamento.setDataLancamento(vencimento);
            mudou = true;
        }
        if (!vencimento.equals(lancamento.getDataCompetencia())) {
            lancamento.setDataCompetencia(vencimento);
            mudou = true;
        }
        lancamento.setOrigem(ORIGEM_AUTO);
        lancamento.setRefTipo("N");
        lancamento.setEtapa(EtapaLancamento.calcular(contaE.getCodigo(), lancamento.getGrupoCompensacao(), null));
        if (mudou) {
            lancamentoCartaoRepository.save(lancamento);
            log.info("[cartao-fechamento] AUTO-FAT recalculado cartao={} vencimento={} total={} id={}",
                    cartao.getNome(), vencimento, somaCompras, lancamento.getId());
        }
        return mudou;
    }

    private LancamentoCartaoEntity novoLancamentoFechamento(
            CartaoEntity cartao,
            LocalDate vencimento,
            BigDecimal valorFechamento,
            BigDecimal somaCompras,
            ContaContabilEntity contaE,
            String numero) {
        LancamentoCartaoEntity l = new LancamentoCartaoEntity();
        l.setCartao(cartao);
        l.setContaContabil(contaE);
        l.setNumeroLancamento(numero);
        l.setDataLancamento(vencimento);
        l.setDataCompetencia(vencimento);
        l.setDescricao(descricaoFechamento(cartao.getNome(), vencimento));
        l.setDescricaoDetalhada(
                "Fechamento automático: soma das compras do ciclo (R$ "
                        + somaCompras.setScale(2, RoundingMode.HALF_UP).toPlainString()
                        + "). Compensar com débito bancário do pagamento.");
        l.setValor(valorFechamento);
        l.setRefTipo("N");
        l.setOrigem(ORIGEM_AUTO);
        l.setStatus("ATIVO");
        l.setEtapa(EtapaLancamento.calcular(contaE.getCodigo(), null, null));
        return l;
    }

    private static String descricaoFechamento(String cartaoNome, LocalDate vencimento) {
        return ("Fechamento fatura " + cartaoNome + " venc. " + vencimento.format(FMT_VENC)).trim();
    }
}
