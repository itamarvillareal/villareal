package br.com.vilareal.orgaojulgador.application;

import br.com.vilareal.localidade.application.MunicipioDerivacaoService;
import br.com.vilareal.localidade.application.MunicipioUsoService;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.OrgaoJulgadorEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.stereotype.Service;

@Service
public class OrgaoJulgadorDerivacaoService {

    private final MunicipioDerivacaoService municipioDerivacaoService;
    private final MunicipioUsoService municipioUsoService;

    public OrgaoJulgadorDerivacaoService(
            MunicipioDerivacaoService municipioDerivacaoService, MunicipioUsoService municipioUsoService) {
        this.municipioDerivacaoService = municipioDerivacaoService;
        this.municipioUsoService = municipioUsoService;
    }

    public void aplicarEmProcesso(ProcessoEntity processo, OrgaoJulgadorEntity orgao) {
        if (processo == null) {
            return;
        }
        processo.setOrgaoJulgador(orgao);
        if (orgao != null && orgao.getMunicipio() != null) {
            municipioDerivacaoService.aplicarEmProcesso(processo, orgao.getMunicipio());
            municipioUsoService.registrarUso(orgao.getMunicipio().getId());
        }
    }
}
