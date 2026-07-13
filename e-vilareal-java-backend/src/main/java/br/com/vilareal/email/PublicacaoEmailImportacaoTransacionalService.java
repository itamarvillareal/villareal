package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import br.com.vilareal.publicacao.application.PublicacaoApplicationService;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.Optional;

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
     * @return id da publicação gravada, ou {@code null} se duplicada (regra de negócio).
     *
     * <p>Usa {@code criarSeNaoDuplicada} em vez de capturar {@code BusinessRuleException}: a
     * exceção atravessando o proxy transacional de {@code criar} marcava esta transação
     * REQUIRES_NEW como rollback-only e o commit falhava com "Transaction silently rolled back
     * because it has been marked as rollback-only".
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public Long criarPublicacaoEmail(PublicacaoWriteRequest req) {
        var criada = publicacaoApplicationService.criarSeNaoDuplicada(req);
        return criada != null ? criada.getId() : null;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public boolean tentarVinculoAutomaticoPorCnj(Long publicacaoId) {
        return publicacaoApplicationService.tentarVinculoAutomaticoPorCnj(publicacaoId);
    }

    public Optional<Long> tentarVinculoAutomaticoPorCnjDevolvendoProcessoId(Long publicacaoId) {
        return publicacaoApplicationService.tentarVinculoAutomaticoPorCnjDevolvendoProcessoId(publicacaoId);
    }
}
