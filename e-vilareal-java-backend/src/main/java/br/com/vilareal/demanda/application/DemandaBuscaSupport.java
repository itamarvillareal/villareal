package br.com.vilareal.demanda.application;

import br.com.vilareal.demanda.infrastructure.persistence.entity.DemandaEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import org.springframework.util.StringUtils;

import java.util.Locale;

final class DemandaBuscaSupport {

    private DemandaBuscaSupport() {}

    static boolean matches(DemandaEntity d, String buscaNorm) {
        if (d == null || !StringUtils.hasText(buscaNorm)) {
            return true;
        }
        ImovelEntity im = d.getImovel();
        ClienteEntity cl = d.getCliente();
        return contains(d.getDescricao(), buscaNorm)
                || contains(d.getFornecedorTexto(), buscaNorm)
                || contains(d.getCategoria(), buscaNorm)
                || (im != null
                        && (contains(im.getTitulo(), buscaNorm)
                                || contains(im.getCondominio(), buscaNorm)
                                || contains(im.getUnidade(), buscaNorm)
                                || contains(im.getEnderecoCompleto(), buscaNorm)))
                || (cl != null
                        && (contains(cl.getNomeReferencia(), buscaNorm)
                                || contains(cl.getCodigoCliente(), buscaNorm)
                                || (cl.getPessoa() != null && contains(cl.getPessoa().getNome(), buscaNorm))));
    }

    private static boolean contains(String s, String busca) {
        return s != null && s.toLowerCase(Locale.ROOT).contains(busca);
    }
}
