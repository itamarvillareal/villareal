package br.com.vilareal.documento;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.List;

/** Resolve gênero/número do(s) contratante(s) a partir de pessoa(s) cadastrada(s). */
@Service
public class ContratoContratanteFlexaoResolver {

    private final QualificacaoPessoaUtil qualificacaoPessoaUtil;

    public ContratoContratanteFlexaoResolver(QualificacaoPessoaUtil qualificacaoPessoaUtil) {
        this.qualificacaoPessoaUtil = qualificacaoPessoaUtil;
    }

    @Transactional(readOnly = true)
    public ContratoContratanteFlexao resolver(Long pessoaId, List<Long> contratantePessoaIds) {
        List<Long> ids = new ArrayList<>();
        if (contratantePessoaIds != null) {
            for (Long id : contratantePessoaIds) {
                if (id != null) {
                    ids.add(id);
                }
            }
        }
        if (ids.isEmpty() && pessoaId != null) {
            ids.add(pessoaId);
        }
        if (ids.isEmpty()) {
            return ContratoContratanteFlexao.padrao();
        }

        List<FlexaoUtil.Genero> generos = new ArrayList<>(ids.size());
        for (Long id : ids) {
            generos.add(qualificacaoPessoaUtil.generoFlexaoPorPessoaId(id));
        }
        return ContratoContratanteFlexao.from(PoloFlexao.determinar(generos));
    }
}
