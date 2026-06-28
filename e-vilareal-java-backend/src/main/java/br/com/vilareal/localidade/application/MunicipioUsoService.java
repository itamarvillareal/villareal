package br.com.vilareal.localidade.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import br.com.vilareal.localidade.infrastructure.persistence.repository.MunicipioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class MunicipioUsoService {

    private final MunicipioRepository municipioRepository;

    public MunicipioUsoService(MunicipioRepository municipioRepository) {
        this.municipioRepository = municipioRepository;
    }

    @Transactional
    public MunicipioEntity carregarObrigatorio(Integer municipioId) {
        if (municipioId == null) {
            throw new BusinessRuleException("municipioId é obrigatório.");
        }
        return municipioRepository
                .findById(municipioId)
                .orElseThrow(() -> new ResourceNotFoundException("Município não encontrado: " + municipioId));
    }

    @Transactional
    public MunicipioEntity carregarOpcional(Integer municipioId) {
        if (municipioId == null) {
            return null;
        }
        return carregarObrigatorio(municipioId);
    }

    @Transactional
    public void registrarUso(Integer municipioId) {
        if (municipioId == null) {
            return;
        }
        carregarObrigatorio(municipioId);
        municipioRepository.incrementarUsoCount(municipioId);
    }
}
