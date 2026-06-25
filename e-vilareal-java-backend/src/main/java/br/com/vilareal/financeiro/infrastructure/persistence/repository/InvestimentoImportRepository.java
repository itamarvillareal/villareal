package br.com.vilareal.financeiro.infrastructure.persistence.repository;

import br.com.vilareal.financeiro.infrastructure.persistence.entity.InvestimentoImportEntity;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface InvestimentoImportRepository extends JpaRepository<InvestimentoImportEntity, Long> {

    List<InvestimentoImportEntity> findByContaBancaria_IdOrderByImportadoEmDesc(Long contaBancariaId);

    Optional<InvestimentoImportEntity> findByContaBancaria_IdAndArquivoHash(Long contaBancariaId, String arquivoHash);
}
