package br.com.vilareal.localidade.application;

import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEnderecoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import org.springframework.stereotype.Service;

@Service
public class MunicipioDerivacaoService {

    public void aplicarEmEndereco(PessoaEnderecoEntity e, MunicipioEntity municipio) {
        if (e == null) {
            return;
        }
        e.setMunicipio(municipio);
        if (municipio != null) {
            e.setCidade(municipio.getNome());
            e.setEstado(municipio.getEstado().getSigla());
            e.setCidadeLegado(null);
        }
    }

    public void aplicarEmEnderecoLegado(PessoaEnderecoEntity e, String cidadeLegado) {
        if (e == null) {
            return;
        }
        e.setMunicipio(null);
        e.setCidadeLegado(cidadeLegado);
        e.setCidade(cidadeLegado);
    }

    public void aplicarEmProcesso(ProcessoEntity e, MunicipioEntity municipio) {
        if (e == null) {
            return;
        }
        e.setMunicipio(municipio);
        if (municipio != null) {
            e.setCidade(municipio.getNome());
            e.setUf(municipio.getEstado().getSigla());
            e.setCidadeLegado(null);
        }
    }

    public void aplicarEmProcessoLegado(ProcessoEntity e, String cidadeLegado) {
        if (e == null) {
            return;
        }
        e.setMunicipio(null);
        e.setCidadeLegado(cidadeLegado);
        e.setCidade(cidadeLegado);
    }

    public void aplicarEmImovel(ImovelEntity e, MunicipioEntity municipio) {
        if (e == null) {
            return;
        }
        e.setMunicipio(municipio);
    }
}
