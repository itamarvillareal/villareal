package br.com.vilareal.totp.infrastructure.persistence.repository;

import br.com.vilareal.totp.domain.TribunalIntegracao;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CredencialTotpRepository extends JpaRepository<CredencialTotpEntity, Long> {

    Optional<CredencialTotpEntity> findByTribunalAndLogin(TribunalIntegracao tribunal, String login);

    Optional<CredencialTotpEntity> findByIdAndAtivoTrue(Long id);

    Optional<CredencialTotpEntity> findByTribunalAndLoginAndAtivoTrue(TribunalIntegracao tribunal, String login);

    List<CredencialTotpEntity> findAllByTribunalAndAtivoTrue(TribunalIntegracao tribunal);

    List<CredencialTotpEntity> findAllByTribunalOrderByIdDesc(TribunalIntegracao tribunal);
}
