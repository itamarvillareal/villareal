package br.com.vilareal.documento.tema;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.infrastructure.persistence.repository.DocumentoModeloRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import org.springframework.stereotype.Service;

/**
 * Resolve timbrado a partir do responsável do processo ({@code usuario_responsavel_id}).
 * <ul>
 *   <li>Sem responsável → {@link TemaDocumento#padrao()}</li>
 *   <li>Modelo ativo no banco → {@link DocumentoModeloMapper#toTemaDocumento}</li>
 *   <li>Sem modelo → padrão, sem erro</li>
 * </ul>
 */
@Service
public class DocumentoTemaResolver {

    private final ProcessoRepository processoRepository;
    private final DocumentoModeloRepository documentoModeloRepository;
    private final DocumentoModeloMapper documentoModeloMapper;

    public DocumentoTemaResolver(
            ProcessoRepository processoRepository,
            DocumentoModeloRepository documentoModeloRepository,
            DocumentoModeloMapper documentoModeloMapper) {
        this.processoRepository = processoRepository;
        this.documentoModeloRepository = documentoModeloRepository;
        this.documentoModeloMapper = documentoModeloMapper;
    }

    /** Geração avulsa / sem vínculo com processo. */
    public TemaDocumento resolverSemProcesso() {
        return TemaDocumento.padrao();
    }

    public TemaDocumento resolverPorProcessoId(Long processoId) {
        if (processoId == null) {
            return resolverSemProcesso();
        }
        ProcessoEntity processo = processoRepository
                .findByIdForJuliaEnactment(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        return resolverPorProcesso(processo);
    }

    public TemaDocumento resolverPorProcesso(ProcessoEntity processo) {
        if (processo == null) {
            return resolverSemProcesso();
        }
        UsuarioEntity responsavel = processo.getUsuarioResponsavel();
        if (responsavel == null || responsavel.getId() == null) {
            return TemaDocumento.padrao();
        }
        return resolverPorUsuarioResponsavelId(responsavel.getId());
    }

    public TemaDocumento resolverPorUsuarioResponsavelId(Long usuarioResponsavelId) {
        if (usuarioResponsavelId == null) {
            return TemaDocumento.padrao();
        }
        return documentoModeloRepository
                .findByUsuarioResponsavelIdAndAtivoTrue(usuarioResponsavelId)
                .map(documentoModeloMapper::toTemaDocumento)
                .orElse(TemaDocumento.padrao());
    }
}
