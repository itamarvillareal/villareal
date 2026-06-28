package br.com.vilareal.orgaojulgador.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.OrgaoJulgadorEntity;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.repository.OrgaoJulgadorRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class OrgaoJulgadorUsoService {

    private final OrgaoJulgadorRepository orgaoJulgadorRepository;

    public OrgaoJulgadorUsoService(OrgaoJulgadorRepository orgaoJulgadorRepository) {
        this.orgaoJulgadorRepository = orgaoJulgadorRepository;
    }

    @Transactional
    public OrgaoJulgadorEntity carregarObrigatorio(Long orgaoJulgadorId) {
        if (orgaoJulgadorId == null) {
            throw new BusinessRuleException("orgaoJulgadorId é obrigatório.");
        }
        return orgaoJulgadorRepository
                .findByIdDetalhado(orgaoJulgadorId)
                .orElseThrow(() -> new ResourceNotFoundException("Órgão julgador não encontrado: " + orgaoJulgadorId));
    }

    @Transactional
    public OrgaoJulgadorEntity carregarOpcional(Long orgaoJulgadorId) {
        if (orgaoJulgadorId == null) {
            return null;
        }
        return carregarObrigatorio(orgaoJulgadorId);
    }

    @Transactional
    public void registrarUso(Long orgaoJulgadorId) {
        if (orgaoJulgadorId == null) {
            return;
        }
        carregarObrigatorio(orgaoJulgadorId);
        orgaoJulgadorRepository.incrementarUsoCount(orgaoJulgadorId);
    }
}
