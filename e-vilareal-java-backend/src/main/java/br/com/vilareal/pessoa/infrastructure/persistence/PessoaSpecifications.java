package br.com.vilareal.pessoa.infrastructure.persistence;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

public final class PessoaSpecifications {

    private PessoaSpecifications() {
    }

    public static Specification<PessoaEntity> comFiltros(
            Boolean apenasAtivos,
            String nomeContem,
            String cpfDigitos,
            Long codigoId,
            String cpfAdicionalDigitos) {

        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (Boolean.TRUE.equals(apenasAtivos)) {
                p.add(cb.isTrue(root.get("ativo")));
            }
            if (StringUtils.hasText(nomeContem)) {
                p.add(cb.like(cb.lower(root.get("nome")), "%" + nomeContem.trim().toLowerCase() + "%"));
            }
            if (StringUtils.hasText(cpfDigitos)) {
                String digits = cpfDigitos.replaceAll("\\D", "");
                if (!digits.isEmpty()) {
                    p.add(cb.like(root.get("cpf"), "%" + digits + "%"));
                }
            }
            if (StringUtils.hasText(cpfAdicionalDigitos)) {
                String d2 = cpfAdicionalDigitos.replaceAll("\\D", "");
                if (!d2.isEmpty()) {
                    p.add(cb.like(root.get("cpf"), "%" + d2 + "%"));
                }
            }
            if (codigoId != null) {
                p.add(cb.equal(root.get("id"), codigoId));
            }
            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
