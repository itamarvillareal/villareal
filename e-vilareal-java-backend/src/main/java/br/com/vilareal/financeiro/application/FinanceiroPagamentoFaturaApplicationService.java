package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.financeiro.api.dto.PagamentoFaturaVinculoResponse;
import br.com.vilareal.financeiro.api.dto.PagamentoFaturaVinculoWriteRequest;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.PagamentoFaturaVinculoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoCartaoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.PagamentoFaturaVinculoRepository;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class FinanceiroPagamentoFaturaApplicationService {

    private static final Sort ORDEM = Sort.by(Sort.Direction.DESC, "createdAt", "id");

    private final PagamentoFaturaVinculoRepository vinculoRepository;
    private final LancamentoFinanceiroRepository lancamentoBancoRepository;
    private final LancamentoCartaoRepository lancamentoCartaoRepository;
    private final ContaContabilRepository contaContabilRepository;

    public FinanceiroPagamentoFaturaApplicationService(
            PagamentoFaturaVinculoRepository vinculoRepository,
            LancamentoFinanceiroRepository lancamentoBancoRepository,
            LancamentoCartaoRepository lancamentoCartaoRepository,
            ContaContabilRepository contaContabilRepository) {
        this.vinculoRepository = vinculoRepository;
        this.lancamentoBancoRepository = lancamentoBancoRepository;
        this.lancamentoCartaoRepository = lancamentoCartaoRepository;
        this.contaContabilRepository = contaContabilRepository;
    }

    @Transactional(readOnly = true)
    public List<PagamentoFaturaVinculoResponse> listarVinculos() {
        return vinculoRepository.findAll(ORDEM).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public PagamentoFaturaVinculoResponse criarVinculo(PagamentoFaturaVinculoWriteRequest req) {
        LancamentoFinanceiroEntity banco = lancamentoBancoRepository.findById(req.getLancamentoBancoId())
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento bancário não encontrado"));
        LancamentoCartaoEntity cartao = lancamentoCartaoRepository.findById(req.getLancamentoCartaoId())
                .orElseThrow(() -> new ResourceNotFoundException("Lançamento de cartão não encontrado"));

        validarPar(banco, cartao, req.getIgnorarToleranciaValor());

        if (vinculoRepository.findByLancamentoBancoId(banco.getId()).isPresent()) {
            throw new BusinessRuleException("Este lançamento bancário já possui vínculo de pagamento de fatura.");
        }
        if (vinculoRepository.findByLancamentoCartaoId(cartao.getId()).isPresent()) {
            throw new BusinessRuleException("Este lançamento de cartão já possui vínculo de pagamento de fatura.");
        }

        PagamentoFaturaVinculoEntity v = new PagamentoFaturaVinculoEntity();
        v.setLancamentoBanco(banco);
        v.setLancamentoCartao(cartao);
        PagamentoFaturaVinculoEntity salvo = vinculoRepository.save(v);
        marcarFechamentoConferidoSeAutoFat(cartao);
        return toResponse(salvo);
    }

    @Transactional
    public void removerVinculo(Long id) {
        PagamentoFaturaVinculoEntity v = vinculoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Vínculo não encontrado"));
        LancamentoCartaoEntity cartao = v.getLancamentoCartao();
        vinculoRepository.deleteById(id);
        restaurarContaConferenciaSeAutoFat(cartao);
    }

    /** Após vínculo banco↔AUTO-FAT: move para conta E (compensado). */
    private void marcarFechamentoConferidoSeAutoFat(LancamentoCartaoEntity cartao) {
        if (!FinanceiroFaturaCartaoFechamentoService.ehLancamentoFechamentoAutomatico(cartao)) {
            return;
        }
        ContaContabilEntity contaE = contaContabilRepository
                .findFirstByCodigoIgnoreCase(FinanceiroFaturaCartaoFechamentoService.CONTA_APOS_VINCULO_BANCO)
                .orElseThrow(() -> new BusinessRuleException("Conta contábil E não encontrada."));
        cartao.setContaContabil(contaE);
        cartao.setRefTipo("R");
        cartao.setEtapa(EtapaLancamento.calcular(contaE.getCodigo(), cartao.getGrupoCompensacao(), null));
        lancamentoCartaoRepository.save(cartao);
    }

    /** Ao desfazer vínculo, AUTO-FAT volta para N (visível para nova conferência). */
    private void restaurarContaConferenciaSeAutoFat(LancamentoCartaoEntity cartao) {
        if (!FinanceiroFaturaCartaoFechamentoService.ehLancamentoFechamentoAutomatico(cartao)) {
            return;
        }
        ContaContabilEntity contaN = contaContabilRepository
                .findFirstByCodigoIgnoreCase(FinanceiroFaturaCartaoFechamentoService.CONTA_FECHAMENTO)
                .orElseThrow(() -> new BusinessRuleException("Conta contábil N não encontrada."));
        cartao.setContaContabil(contaN);
        cartao.setRefTipo("N");
        cartao.setEtapa(EtapaLancamento.calcular(contaN.getCodigo(), cartao.getGrupoCompensacao(), null));
        lancamentoCartaoRepository.save(cartao);
    }

    private void validarPar(LancamentoFinanceiroEntity banco, LancamentoCartaoEntity cartao, Boolean ignorarTolerancia) {
        if (banco.getNatureza() != NaturezaLancamento.DEBITO) {
            throw new BusinessRuleException("Pagamento de fatura no banco deve ser um débito (saída da conta).");
        }
        BigDecimal absBanco = banco.getValor().abs();
        BigDecimal absCartao;
        if (FinanceiroFaturaCartaoFechamentoService.ehLancamentoFechamentoAutomatico(cartao)) {
            if (cartao.getValor().compareTo(BigDecimal.ZERO) >= 0) {
                throw new BusinessRuleException("Fechamento automático de fatura (AUTO-FAT) deve ser crédito (valor negativo).");
            }
            absCartao = cartao.getValor().abs();
        } else {
            if (cartao.getValor().compareTo(BigDecimal.ZERO) <= 0) {
                throw new BusinessRuleException("Pagamento na fatura do cartão deve ter valor positivo.");
            }
            absCartao = cartao.getValor().abs();
        }
        if (!Boolean.TRUE.equals(ignorarTolerancia)) {
            BigDecimal tol = new BigDecimal("0.01");
            if (absBanco.subtract(absCartao).abs().compareTo(tol) > 0) {
                throw new BusinessRuleException(
                        "Valores divergem: banco " + absBanco + " × cartão " + absCartao
                                + " (tolerância " + tol.setScale(2, java.math.RoundingMode.HALF_UP) + ").");
            }
        }
    }

    private PagamentoFaturaVinculoResponse toResponse(PagamentoFaturaVinculoEntity v) {
        LancamentoFinanceiroEntity b = v.getLancamentoBanco();
        LancamentoCartaoEntity c = v.getLancamentoCartao();
        PagamentoFaturaVinculoResponse r = new PagamentoFaturaVinculoResponse();
        r.setId(v.getId());
        r.setLancamentoBancoId(b.getId());
        r.setBancoNome(b.getBancoNome());
        r.setDataBanco(b.getDataLancamento());
        r.setValorBanco(b.getValor());
        r.setNaturezaBanco(b.getNatureza().name());
        r.setDescricaoBanco(b.getDescricao());
        r.setLancamentoCartaoId(c.getId());
        r.setCartaoNome(c.getCartao().getNome());
        r.setDataCartao(c.getDataLancamento());
        r.setValorCartao(c.getValor());
        r.setDescricaoCartao(c.getDescricao());
        return r;
    }
}
