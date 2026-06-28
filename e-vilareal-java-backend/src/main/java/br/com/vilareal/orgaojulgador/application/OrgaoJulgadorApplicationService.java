package br.com.vilareal.orgaojulgador.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.localidade.api.dto.MunicipioResumoResponse;
import br.com.vilareal.localidade.application.MunicipioApplicationService;
import br.com.vilareal.localidade.domain.MunicipioTextoUtil;
import br.com.vilareal.orgaojulgador.api.dto.OrgaoJulgadorResponse;
import br.com.vilareal.orgaojulgador.api.dto.OrgaoJulgadorResumoResponse;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.OrgaoJulgadorEntity;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.repository.OrgaoJulgadorRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class OrgaoJulgadorApplicationService {

    private static final int LIMIT_DEFAULT = 20;
    private static final int LIMIT_MAX = 50;

    private final OrgaoJulgadorRepository orgaoJulgadorRepository;
    private final MunicipioApplicationService municipioApplicationService;

    public OrgaoJulgadorApplicationService(
            OrgaoJulgadorRepository orgaoJulgadorRepository,
            MunicipioApplicationService municipioApplicationService) {
        this.orgaoJulgadorRepository = orgaoJulgadorRepository;
        this.municipioApplicationService = municipioApplicationService;
    }

    @Transactional(readOnly = true)
    public List<OrgaoJulgadorResponse> buscarOrgaos(
            Integer tribunalId, Integer municipioId, String q, Integer limit) {
        int lim = limit != null && limit > 0 ? Math.min(limit, LIMIT_MAX) : LIMIT_DEFAULT;
        String qNorm = q != null && !q.isBlank() ? MunicipioTextoUtil.normalizarNome(q) : "";
        return orgaoJulgadorRepository
                .buscarAutocomplete(tribunalId, municipioId, qNorm, PageRequest.of(0, lim))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public OrgaoJulgadorResponse obterOrgao(Long id) {
        OrgaoJulgadorEntity o = orgaoJulgadorRepository
                .findByIdDetalhado(id)
                .orElseThrow(() -> new ResourceNotFoundException("Órgão julgador não encontrado: " + id));
        return toResponse(o);
    }

    @Transactional(readOnly = true)
    public OrgaoJulgadorResumoResponse toResumo(OrgaoJulgadorEntity o) {
        if (o == null) {
            return null;
        }
        return new OrgaoJulgadorResumoResponse(
                o.getId(),
                o.getCodigoCnj(),
                o.getNome(),
                o.getGrau(),
                o.getTipo() != null ? o.getTipo().name() : null,
                municipioApplicationService.toResumo(o.getMunicipio()));
    }

    private OrgaoJulgadorResponse toResponse(OrgaoJulgadorEntity o) {
        OrgaoJulgadorResponse r = new OrgaoJulgadorResponse();
        r.setId(o.getId());
        r.setCodigoCnj(o.getCodigoCnj());
        r.setNome(o.getNome());
        r.setGrau(o.getGrau());
        r.setTipo(o.getTipo() != null ? o.getTipo().name() : null);
        r.setMunicipio(municipioApplicationService.toResumo(o.getMunicipio()));
        if (o.getTribunal() != null) {
            r.setTribunalId(o.getTribunal().getId());
            r.setTribunalSigla(o.getTribunal().getSigla());
        }
        r.setFavorito(Boolean.TRUE.equals(o.getFavorito()));
        r.setUsoCount(o.getUsoCount() != null ? o.getUsoCount() : 0);
        r.setAtivo(Boolean.TRUE.equals(o.getAtivo()));
        return r;
    }
}
