package br.com.vilareal.pagamento.api.dto.prestacao;

import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;

public class PrestacaoContasGrupoImovelDetailDto {

    private PrestacaoContasImovelDto imovel;
    private List<PrestacaoContasPagamentoItemDto> pagamentos = new ArrayList<>();
    private BigDecimal subtotal;

    public PrestacaoContasImovelDto getImovel() {
        return imovel;
    }

    public void setImovel(PrestacaoContasImovelDto imovel) {
        this.imovel = imovel;
    }

    public List<PrestacaoContasPagamentoItemDto> getPagamentos() {
        return pagamentos;
    }

    public void setPagamentos(List<PrestacaoContasPagamentoItemDto> pagamentos) {
        this.pagamentos = pagamentos;
    }

    public BigDecimal getSubtotal() {
        return subtotal;
    }

    public void setSubtotal(BigDecimal subtotal) {
        this.subtotal = subtotal;
    }
}
