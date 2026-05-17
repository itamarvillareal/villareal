package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.financeiro.api.dto.PagamentoFaturaVinculoResponse;
import br.com.vilareal.financeiro.api.dto.PagamentoFaturaVinculoWriteRequest;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoCartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.PagamentoFaturaVinculoEntity;
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

    public FinanceiroPagamentoFaturaApplicationService(
            PagamentoFaturaVinculoRepository vinculoRepository,
            LancamentoFinanceiroRepository lancamentoBancoRepository,
            LancamentoCartaoRepository lancamentoCartaoRepository) {
        this.vinculoRepository = vinculoRepository;
        this.lancamentoBancoRepository = lancamentoBancoRepository;
        this.lancamentoCartaoRepository = lancamentoCartaoRepository;
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

        validarPar(banco, cartao);

        if (vinculoRepository.findByLancamentoBancoId(banco.getId()).isPresent()) {
            throw new BusinessRuleException("Este lançamento bancário já possui vínculo de pagamento de fatura.");
        }
        if (vinculoRepository.findByLancamentoCartaoId(cartao.getId()).isPresent()) {
            throw new BusinessRuleException("Este lançamento de cartão já possui vínculo de pagamento de fatura.");
        }

        PagamentoFaturaVinculoEntity v = new PagamentoFaturaVinculoEntity();
        v.setLancamentoBanco(banco);
        v.setLancamentoCartao(cartao);
        return toResponse(vinculoRepository.save(v));
    }

    @Transactional
    public void removerVinculo(Long id) {
        if (!vinculoRepository.existsById(id)) {
            throw new ResourceNotFoundException("Vínculo não encontrado");
        }
        vinculoRepository.deleteById(id);
    }

    private void validarPar(LancamentoFinanceiroEntity banco, LancamentoCartaoEntity cartao) {
        if (banco.getNatureza() != NaturezaLancamento.DEBITO) {
            throw new BusinessRuleException("Pagamento de fatura no banco deve ser um débito (saída da conta).");
        }
        if (cartao.getValor().compareTo(BigDecimal.ZERO) <= 0) {
            throw new BusinessRuleException("Pagamento na fatura do cartão deve ter valor positivo.");
        }
        BigDecimal absBanco = banco.getValor().abs();
        BigDecimal absCartao = cartao.getValor().abs();
        if (absBanco.subtract(absCartao).abs().compareTo(new BigDecimal("0.05")) > 0) {
            throw new BusinessRuleException(
                    "Valores divergem: banco " + absBanco + " × cartão " + absCartao + " (tolerância R$ 0,05).");
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
