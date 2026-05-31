package br.com.vilareal.projudi;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.publicacao.api.dto.PublicacaoVinculoPatchRequest;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import br.com.vilareal.publicacao.application.PublicacaoApplicationService;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Transações isoladas por publicação PROJUDI (evita self-invocation e rollback cruzado).
 */
@Service
public class ProjudiPublicacaoTransacaoService {

    private final PublicacaoApplicationService publicacaoApplicationService;

    public ProjudiPublicacaoTransacaoService(PublicacaoApplicationService publicacaoApplicationService) {
        this.publicacaoApplicationService = publicacaoApplicationService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public Long criarPublicacaoProjudi(PublicacaoWriteRequest req) {
        try {
            return publicacaoApplicationService.criar(req).getId();
        } catch (BusinessRuleException ex) {
            String msg = String.valueOf(ex.getMessage()).toLowerCase();
            if (msg.contains("duplicad")) {
                return null;
            }
            throw ex;
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void vincularPublicacaoAoProcesso(Long publicacaoId, Long processoId) {
        PublicacaoVinculoPatchRequest vinculo = new PublicacaoVinculoPatchRequest();
        vinculo.setProcessoId(processoId);
        vinculo.setObservacao("Vínculo automático na importação PROJUDI.");
        publicacaoApplicationService.patchVinculoProcesso(publicacaoId, vinculo);
    }
}
