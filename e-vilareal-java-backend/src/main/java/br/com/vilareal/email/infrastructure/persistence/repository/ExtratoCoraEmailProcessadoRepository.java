package br.com.vilareal.email.infrastructure.persistence.repository;

import br.com.vilareal.email.infrastructure.persistence.entity.ExtratoCoraEmailProcessadoEntity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Set;

public interface ExtratoCoraEmailProcessadoRepository
        extends JpaRepository<ExtratoCoraEmailProcessadoEntity, ExtratoCoraEmailProcessadoEntity.Pk> {

    @Query(
            """
            SELECT e.gmailMessageId
            FROM ExtratoCoraEmailProcessadoEntity e
            WHERE e.gmailUser = :gmailUser
            """)
    Set<String> findMessageIdsByGmailUser(@Param("gmailUser") String gmailUser);
}
