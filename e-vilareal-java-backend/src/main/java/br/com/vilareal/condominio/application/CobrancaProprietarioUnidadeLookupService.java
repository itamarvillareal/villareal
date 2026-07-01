package br.com.vilareal.condominio.application;

import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Resolve proprietário (RÉU) cadastrado por unidade — usado na extração PDF da cobrança automática. */
@Service
public class CobrancaProprietarioUnidadeLookupService {

    private static final String POLO_REU = "REU";

    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final PessoaRepository pessoaRepository;

    public CobrancaProprietarioUnidadeLookupService(
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            PessoaRepository pessoaRepository) {
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.pessoaRepository = pessoaRepository;
    }

    public record ProprietarioUnidade(String nome, String docDigitos) {}

    @Transactional(readOnly = true)
    public Optional<ProprietarioUnidade> buscarPorUnidade(long clienteId, String codigoUnidade) {
        if (!StringUtils.hasText(codigoUnidade)) {
            return Optional.empty();
        }
        for (String chave : CobrancaUnidadeFormatUtil.chavesBuscaProcessoPorCodigo(codigoUnidade)) {
            Optional<ProcessoEntity> procOpt = processoRepository.findByCliente_IdAndUnidade(clienteId, chave);
            if (procOpt.isEmpty()) {
                continue;
            }
            List<Long> reuIds = listarReuPessoaIds(procOpt.get().getId());
            for (Long pessoaId : reuIds) {
                Optional<PessoaEntity> pessoaOpt = pessoaRepository.findById(pessoaId);
                if (pessoaOpt.isEmpty()) {
                    continue;
                }
                PessoaEntity pessoa = pessoaOpt.get();
                String doc = somenteDigitos(pessoa.getCpf());
                if (!StringUtils.hasText(pessoa.getNome()) || (doc.length() != 11 && doc.length() != 14)) {
                    continue;
                }
                return Optional.of(new ProprietarioUnidade(pessoa.getNome().trim(), doc));
            }
        }
        return Optional.empty();
    }

    private List<Long> listarReuPessoaIds(Long processoId) {
        List<Long> ids = new ArrayList<>();
        for (ProcessoParteEntity pp :
                processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(processoId)) {
            if (pp.getPessoa() != null) {
                ids.add(pp.getPessoa().getId());
            }
        }
        return ids;
    }

    private static String somenteDigitos(String raw) {
        return raw == null ? "" : raw.replaceAll("\\D", "");
    }
}
