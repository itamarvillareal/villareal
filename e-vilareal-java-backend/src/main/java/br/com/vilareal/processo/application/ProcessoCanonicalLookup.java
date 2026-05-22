package br.com.vilareal.processo.application;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

public final class ProcessoCanonicalLookup {

    private ProcessoCanonicalLookup() {}

    /**
     * Quando existem várias linhas para o mesmo (cliente_id, numero_interno), prefere titular =
     * {@code cliente.pessoa_id}, depois mais vínculos e id mais recente.
     */
    public static Optional<ProcessoEntity> escolher(List<ProcessoEntity> candidatos, Long clientePessoaId) {
        if (candidatos == null || candidatos.isEmpty()) {
            return Optional.empty();
        }
        return candidatos.stream()
                .max(Comparator.comparing((ProcessoEntity p) -> titularAlinhado(p, clientePessoaId))
                        .thenComparing(ProcessoEntity::getId));
    }

    private static boolean titularAlinhado(ProcessoEntity p, Long clientePessoaId) {
        if (clientePessoaId == null || p.getPessoa() == null) {
            return false;
        }
        return Objects.equals(p.getPessoa().getId(), clientePessoaId);
    }
}
