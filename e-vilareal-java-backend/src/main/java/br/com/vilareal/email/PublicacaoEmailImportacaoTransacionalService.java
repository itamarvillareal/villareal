package br.com.vilareal.email;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import br.com.vilareal.publicacao.application.PublicacaoApplicationService;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Uma transação por publicação na importação Gmail — evita corromper a sessão Hibernate
 * quando um INSERT falha (ex.: schema desatualizado) e o lote continua.
 */
@Service
public class PublicacaoEmailImportacaoTransacionalService {

    private final PublicacaoApplicationService publicacaoApplicationService;
    private final PublicacaoRepository publicacaoRepository;

    public PublicacaoEmailImportacaoTransacionalService(
            PublicacaoApplicationService publicacaoApplicationService,
            PublicacaoRepository publicacaoRepository) {
        this.publicacaoApplicationService = publicacaoApplicationService;
        this.publicacaoRepository = publicacaoRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public int removerPublicacoesDoEmail(String messageId) {
        return publicacaoRepository.deleteByArquivoOrigemNomeContaining("[" + messageId + "]");
    }

    /**
     * @return id da publicação gravada, ou {@code null} se duplicada (regra de negócio)
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public Long criarPublicacaoEmail(PublicacaoWriteRequest req) {
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
    public boolean tentarVinculoAutomaticoPorCnj(Long publicacaoId) {
        return publicacaoApplicationService.tentarVinculoAutomaticoPorCnj(publicacaoId);
    }
}
