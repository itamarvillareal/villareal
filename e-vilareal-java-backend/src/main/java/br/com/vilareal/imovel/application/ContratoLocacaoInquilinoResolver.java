package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.processo.application.ProcessoPartesVinculoTextoResolver;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

/** Resolve todos os locatários (inquilinos) para contrato/PDF. */
@Service
public class ContratoLocacaoInquilinoResolver {

    private final ImovelProcessoRepository imovelProcessoRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;

    public ContratoLocacaoInquilinoResolver(
            ImovelProcessoRepository imovelProcessoRepository,
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository) {
        this.imovelProcessoRepository = imovelProcessoRepository;
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
    }

    @Transactional(readOnly = true)
    public List<Long> resolverLocatariosPessoaIds(ContratoLocacaoEntity contrato, List<Long> overrideIds) {
        LinkedHashSet<Long> ids = new LinkedHashSet<>();
        if (overrideIds != null) {
            for (Long id : overrideIds) {
                if (id != null && id > 0) {
                    ids.add(id);
                }
            }
        }
        if (contrato != null) {
            ids.addAll(ContratoLocacaoFiadorSupport.extrairPessoaIds(contrato.getInquilinosJson()));
            if (ids.isEmpty()
                    && contrato.getInquilinoPessoa() != null
                    && contrato.getInquilinoPessoa().getId() != null) {
                ids.add(contrato.getInquilinoPessoa().getId());
            }
            ids.addAll(extrairPessoaIdsParteOpostaDoImovel(contrato.getImovel()));
        }
        return List.copyOf(ids);
    }

    private List<Long> extrairPessoaIdsParteOpostaDoImovel(ImovelEntity imovel) {
        if (imovel == null || imovel.getId() == null) {
            return List.of();
        }
        Long processoId = imovelProcessoRepository
                .findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(imovel.getId())
                .map(v -> v.getProcesso())
                .map(ProcessoEntity::getId)
                .orElse(null);
        if (processoId == null && imovel.getProcesso() != null) {
            processoId = imovel.getProcesso().getId();
        }
        if (processoId == null) {
            return List.of();
        }
        ProcessoEntity processo =
                processoRepository.findById(processoId).orElse(null);
        if (processo == null) {
            return List.of();
        }
        List<ProcessoParteEntity> partes =
                processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId);
        return ProcessoPartesVinculoTextoResolver.listarPessoaIdsParteOposta(processo, partes);
    }
}
