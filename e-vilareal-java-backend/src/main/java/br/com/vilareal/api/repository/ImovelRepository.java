package br.com.vilareal.api.repository;

import br.com.vilareal.api.entity.Imovel;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ImovelRepository extends JpaRepository<Imovel, Long> {
    List<Imovel> findByClienteIdOrderByIdDesc(Long clienteId);

    Optional<Imovel> findByProcessoId(Long processoId);
}
