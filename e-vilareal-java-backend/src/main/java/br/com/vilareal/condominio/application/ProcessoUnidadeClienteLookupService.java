package br.com.vilareal.condominio.application;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;
import java.util.Set;

/** Localiza processo do cliente pela unidade normalizada (variantes de formato). */
@Service
public class ProcessoUnidadeClienteLookupService {

    private final ProcessoRepository processoRepository;

    public ProcessoUnidadeClienteLookupService(ProcessoRepository processoRepository) {
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public Optional<ProcessoEntity> buscarPorCodigoUnidade(long clienteId, String codigoUnidade) {
        if (clienteId < 1 || !StringUtils.hasText(codigoUnidade)) {
            return Optional.empty();
        }
        String codigo = CobrancaUnidadeFormatUtil.normalizarCodigoUnidade(codigoUnidade);
        for (String chave : CobrancaUnidadeFormatUtil.chavesBuscaProcessoPorCodigo(codigo)) {
            Optional<ProcessoEntity> found = processoRepository.findByCliente_IdAndUnidade(clienteId, chave);
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    @Transactional(readOnly = true)
    public List<ProcessoEntity> listarTodosPorCodigoUnidade(long clienteId, String codigoUnidade) {
        if (clienteId < 1 || !StringUtils.hasText(codigoUnidade)) {
            return List.of();
        }
        String codigo = CobrancaUnidadeFormatUtil.normalizarCodigoUnidade(codigoUnidade);
        Set<Long> vistos = new LinkedHashSet<>();
        List<ProcessoEntity> out = new ArrayList<>();
        for (String chave : CobrancaUnidadeFormatUtil.chavesBuscaProcessoPorCodigo(codigo)) {
            for (ProcessoEntity proc : processoRepository.findAllByCliente_IdAndUnidade(clienteId, chave)) {
                if (vistos.add(proc.getId())) {
                    out.add(proc);
                }
            }
        }
        return out;
    }
}
