package br.com.vilareal.email;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import br.com.vilareal.publicacao.application.PublicacaoApplicationService;
import br.com.vilareal.publicacao.infrastructure.persistence.repository.PublicacaoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.HashMap;
import java.util.Map;
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

    /** Captura status TRATADA/IGNORADA indexados por {@code hash_conteudo} antes do reprocessamento Gmail. */
    @Transactional(readOnly = true)
    public Map<String, String> capturarStatusPreservaveisDoEmail(String messageId) {
        String fragment = "[" + messageId + "]";
        Map<String, String> out = new HashMap<>();
        for (Object[] row : publicacaoRepository.findHashStatusPreservaveisByArquivoOrigemNomeContaining(fragment)) {
            String hash = row[0] != null ? String.valueOf(row[0]).trim() : "";
            String status = row[1] != null ? String.valueOf(row[1]).trim() : "";
            if (!hash.isEmpty() && ("TRATADA".equals(status) || "IGNORADA".equals(status))) {
                out.putIfAbsent(hash, status);
            }
        }
        return out;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public int removerPublicacoesDoEmail(String messageId) {
        return publicacaoRepository.deleteByArquivoOrigemNomeContaining("[" + messageId + "]");
    }

    /** Reaplica TRATADA/IGNORADA após reimportação quando o {@code hash_conteudo} coincide. */
    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public void reaplicarStatusPreservados(Long publicacaoId, Map<String, String> statusPorHash) {
        if (publicacaoId == null || statusPorHash == null || statusPorHash.isEmpty()) {
            return;
        }
        publicacaoRepository
                .findById(publicacaoId)
                .ifPresent(
                        pub -> {
                            String hash = pub.getHashConteudo() != null ? pub.getHashConteudo().trim() : "";
                            String status = statusPorHash.get(hash);
                            if (status == null || status.equals(pub.getStatusTratamento())) {
                                return;
                            }
                            pub.setStatusTratamento(status);
                            publicacaoRepository.save(pub);
                        });
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

    public Optional<Long> tentarVinculoAutomaticoPorCnjDevolvendoProcessoId(Long publicacaoId) {
        return publicacaoApplicationService.tentarVinculoAutomaticoPorCnjDevolvendoProcessoId(publicacaoId);
    }
}
