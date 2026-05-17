package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.CartaoBancoMapeamentoResponse;
import br.com.vilareal.financeiro.api.dto.CartaoBancoMapeamentoWriteRequest;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CartaoBancoMapeamentoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.CartaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CartaoBancoMapeamentoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.CartaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.stream.Collectors;

@Service
public class CartaoBancoMapeamentoApplicationService {

    private final CartaoBancoMapeamentoRepository mapeamentoRepository;
    private final CartaoRepository cartaoRepository;

    public CartaoBancoMapeamentoApplicationService(
            CartaoBancoMapeamentoRepository mapeamentoRepository, CartaoRepository cartaoRepository) {
        this.mapeamentoRepository = mapeamentoRepository;
        this.cartaoRepository = cartaoRepository;
    }

    @Transactional(readOnly = true)
    public List<CartaoBancoMapeamentoResponse> listarTodas() {
        return mapeamentoRepository.findAll().stream().map(this::toResponse).collect(Collectors.toList());
    }

    @Transactional(readOnly = true)
    public CartaoBancoMapeamentoResponse buscar(Long id) {
        return toResponse(mapeamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mapeamento cartão-banco não encontrado: " + id)));
    }

    @Transactional
    public CartaoBancoMapeamentoResponse criar(CartaoBancoMapeamentoWriteRequest req) {
        CartaoBancoMapeamentoEntity e = new CartaoBancoMapeamentoEntity();
        aplicar(e, req);
        return toResponse(mapeamentoRepository.save(e));
    }

    @Transactional
    public CartaoBancoMapeamentoResponse atualizar(Long id, CartaoBancoMapeamentoWriteRequest req) {
        CartaoBancoMapeamentoEntity e = mapeamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Mapeamento cartão-banco não encontrado: " + id));
        aplicar(e, req);
        return toResponse(mapeamentoRepository.save(e));
    }

    @Transactional
    public void remover(Long id) {
        if (!mapeamentoRepository.existsById(id)) {
            throw new ResourceNotFoundException("Mapeamento cartão-banco não encontrado: " + id);
        }
        mapeamentoRepository.deleteById(id);
    }

    private void aplicar(CartaoBancoMapeamentoEntity e, CartaoBancoMapeamentoWriteRequest req) {
        CartaoEntity cartao = cartaoRepository.findById(req.getCartaoId())
                .orElseThrow(() -> new ResourceNotFoundException("Cartão não encontrado: " + req.getCartaoId()));
        e.setCartao(cartao);
        e.setNumeroBanco(req.getNumeroBanco());
        e.setPadraoDescricao(req.getPadraoDescricao().trim());
        e.setTipoMatch(req.getTipoMatch());
        e.setToleranciaValor(req.getToleranciaValor());
        e.setToleranciaDias(req.getToleranciaDias());
        e.setAtivo(req.getAtivo());
    }

    private CartaoBancoMapeamentoResponse toResponse(CartaoBancoMapeamentoEntity e) {
        CartaoBancoMapeamentoResponse r = new CartaoBancoMapeamentoResponse();
        r.setId(e.getId());
        r.setCartaoId(e.getCartao().getId());
        r.setCartaoNome(Utf8MojibakeUtil.corrigir(e.getCartao().getNome()));
        r.setNumeroBanco(e.getNumeroBanco());
        r.setPadraoDescricao(Utf8MojibakeUtil.corrigir(e.getPadraoDescricao()));
        r.setTipoMatch(e.getTipoMatch());
        r.setToleranciaValor(e.getToleranciaValor());
        r.setToleranciaDias(e.getToleranciaDias());
        r.setAtivo(e.getAtivo());
        return r;
    }
}
