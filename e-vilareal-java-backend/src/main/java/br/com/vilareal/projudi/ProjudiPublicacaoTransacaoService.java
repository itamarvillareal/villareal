package br.com.vilareal.projudi;

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

    /**
     * @return id da publicação gravada, ou {@code null} se duplicada (hash_conteudo).
     *
     * <p>Usa {@code criarSeNaoDuplicada} em vez de capturar {@code BusinessRuleException}: a
     * exceção atravessando o proxy transacional de {@code criar} marcava esta transação
     * REQUIRES_NEW como rollback-only e o commit falhava com "Transaction silently rolled back".
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public Long criarPublicacaoProjudi(PublicacaoWriteRequest req) {
        var criada = publicacaoApplicationService.criarSeNaoDuplicada(req);
        return criada != null ? criada.getId() : null;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void vincularPublicacaoAoProcesso(Long publicacaoId, Long processoId) {
        PublicacaoVinculoPatchRequest vinculo = new PublicacaoVinculoPatchRequest();
        vinculo.setProcessoId(processoId);
        vinculo.setObservacao("Vínculo automático na importação PROJUDI.");
        publicacaoApplicationService.patchVinculoProcesso(publicacaoId, vinculo);
    }
}
