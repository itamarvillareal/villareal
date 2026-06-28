package br.com.vilareal.localidade.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.localidade.api.dto.EstadoResponse;
import br.com.vilareal.localidade.api.dto.MunicipioResumoResponse;
import br.com.vilareal.localidade.api.dto.MunicipioResponse;
import br.com.vilareal.localidade.domain.MunicipioTextoUtil;
import br.com.vilareal.localidade.infrastructure.persistence.entity.EstadoEntity;
import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import br.com.vilareal.localidade.infrastructure.persistence.repository.EstadoRepository;
import br.com.vilareal.localidade.infrastructure.persistence.repository.MunicipioRepository;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Locale;

@Service
public class MunicipioApplicationService {

    private static final int LIMIT_DEFAULT = 20;
    private static final int LIMIT_MAX = 50;

    private final EstadoRepository estadoRepository;
    private final MunicipioRepository municipioRepository;

    public MunicipioApplicationService(EstadoRepository estadoRepository, MunicipioRepository municipioRepository) {
        this.estadoRepository = estadoRepository;
        this.municipioRepository = municipioRepository;
    }

    @Transactional(readOnly = true)
    public List<EstadoResponse> listarEstados() {
        return estadoRepository.findAllByOrderByNomeAsc().stream()
                .map(e -> new EstadoResponse(e.getId(), e.getSigla(), e.getNome()))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<MunicipioResponse> buscarMunicipios(String uf, String q, Integer limit) {
        int lim = limit != null && limit > 0 ? Math.min(limit, LIMIT_MAX) : LIMIT_DEFAULT;
        Integer ufId = null;
        String ufSigla = null;
        if (uf != null && !uf.isBlank()) {
            String trimmed = uf.trim();
            if (trimmed.matches("\\d{1,2}")) {
                ufId = Integer.parseInt(trimmed);
            } else {
                ufSigla = MunicipioTextoUtil.normalizarUf(trimmed);
            }
        }
        String qNorm = q != null && !q.isBlank() ? MunicipioTextoUtil.normalizarNome(q) : "";
        return municipioRepository
                .buscarAutocomplete(ufSigla, ufId, qNorm, PageRequest.of(0, lim))
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional(readOnly = true)
    public MunicipioResponse obterMunicipio(Integer id) {
        MunicipioEntity m = municipioRepository
                .findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Município não encontrado: " + id));
        return toResponse(m);
    }

    @Transactional(readOnly = true)
    public MunicipioResumoResponse toResumo(MunicipioEntity m) {
        if (m == null) {
            return null;
        }
        return new MunicipioResumoResponse(m.getId(), m.getNome(), m.getEstado().getSigla());
    }

    @Transactional(readOnly = true)
    public MunicipioResumoResponse resumoPorId(Integer id) {
        if (id == null) {
            return null;
        }
        return municipioRepository.findById(id).map(this::toResumo).orElse(null);
    }

    private MunicipioResponse toResponse(MunicipioEntity m) {
        return new MunicipioResponse(
                m.getId(),
                m.getNome(),
                m.getEstado().getSigla(),
                Boolean.TRUE.equals(m.getFavorito()),
                m.getUsoCount() != null ? m.getUsoCount() : 0);
    }
}
