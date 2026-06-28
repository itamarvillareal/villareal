package br.com.vilareal.orgaojulgador.application;

import br.com.vilareal.orgaojulgador.api.dto.TribunalResponse;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.TribunalEntity;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.repository.TribunalRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
public class TribunalApplicationService {

    private final TribunalRepository tribunalRepository;

    public TribunalApplicationService(TribunalRepository tribunalRepository) {
        this.tribunalRepository = tribunalRepository;
    }

    @Transactional(readOnly = true)
    public List<TribunalResponse> listarTribunais(Boolean somenteAtivos) {
        List<TribunalEntity> lista =
                Boolean.TRUE.equals(somenteAtivos)
                        ? tribunalRepository.findByAtivoTrueOrderBySiglaAsc()
                        : tribunalRepository.findAllByOrderBySiglaAsc();
        return lista.stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public TribunalEntity carregar(Integer id) {
        return tribunalRepository
                .findById(id)
                .orElseThrow(() -> new br.com.vilareal.common.exception.ResourceNotFoundException(
                        "Tribunal não encontrado: " + id));
    }

    private TribunalResponse toResponse(TribunalEntity t) {
        String uf = t.getEstado() != null ? t.getEstado().getSigla() : null;
        return new TribunalResponse(
                t.getId(), t.getSigla(), t.getNome(), uf, t.getDatajudAlias(), Boolean.TRUE.equals(t.getAtivo()));
    }
}
