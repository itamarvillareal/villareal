package br.com.vilareal.usuario.infrastructure.persistence;

import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import jakarta.persistence.criteria.Join;
import jakarta.persistence.criteria.JoinType;
import jakarta.persistence.criteria.Predicate;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

public final class UsuarioSpecifications {

    private UsuarioSpecifications() {
    }

    public static Specification<UsuarioEntity> comFiltros(
            Boolean apenasAtivos,
            String nomeUsuarioContem,
            String loginContem,
            Long usuarioId,
            Long pessoaId,
            String nomePessoaContem) {
        return (root, query, cb) -> {
            List<Predicate> p = new ArrayList<>();
            if (Boolean.TRUE.equals(apenasAtivos)) {
                p.add(cb.isTrue(root.get("ativo")));
            }
            if (StringUtils.hasText(nomeUsuarioContem)) {
                String pattern = "%" + nomeUsuarioContem.trim().toLowerCase() + "%";
                var porNome = cb.like(cb.lower(root.get("nome")), pattern);
                var porApelido = cb.and(
                        cb.isNotNull(root.get("apelido")),
                        cb.like(cb.lower(root.get("apelido")), pattern));
                p.add(cb.or(porNome, porApelido));
            }
            if (StringUtils.hasText(loginContem)) {
                String pattern = "%" + loginContem.trim().toLowerCase() + "%";
                p.add(cb.like(cb.lower(root.get("login")), pattern));
            }
            if (usuarioId != null) {
                p.add(cb.equal(root.get("id"), usuarioId));
            }
            Join<UsuarioEntity, ?> pessoaJoin = null;
            if (pessoaId != null || StringUtils.hasText(nomePessoaContem)) {
                pessoaJoin = root.join("pessoa", JoinType.INNER);
            }
            if (pessoaId != null) {
                p.add(cb.equal(pessoaJoin.get("id"), pessoaId));
            }
            if (StringUtils.hasText(nomePessoaContem)) {
                String pattern = "%" + nomePessoaContem.trim().toLowerCase() + "%";
                p.add(cb.like(cb.lower(pessoaJoin.get("nome")), pattern));
            }
            return cb.and(p.toArray(new Predicate[0]));
        };
    }
}
