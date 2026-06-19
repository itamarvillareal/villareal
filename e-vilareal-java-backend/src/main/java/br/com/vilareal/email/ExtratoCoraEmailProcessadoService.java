package br.com.vilareal.email;

import br.com.vilareal.email.infrastructure.persistence.entity.ExtratoCoraEmailProcessadoEntity;
import br.com.vilareal.email.infrastructure.persistence.repository.ExtratoCoraEmailProcessadoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.util.Set;

@Service
public class ExtratoCoraEmailProcessadoService {

    private final ExtratoCoraEmailProcessadoRepository repository;

    public ExtratoCoraEmailProcessadoService(ExtratoCoraEmailProcessadoRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Set<String> messageIdsJaProcessados(String gmailUser) {
        return repository.findMessageIdsByGmailUser(gmailUser);
    }

    @Transactional
    public void registrarProcessado(
            String gmailUser,
            String gmailMessageId,
            int lancamentosCriados,
            int lancamentosJaExistiam,
            int falhas) {
        ExtratoCoraEmailProcessadoEntity e = repository
                .findById(new ExtratoCoraEmailProcessadoEntity.Pk(gmailMessageId, gmailUser))
                .orElseGet(() -> {
                    ExtratoCoraEmailProcessadoEntity n = new ExtratoCoraEmailProcessadoEntity();
                    n.setGmailMessageId(gmailMessageId);
                    n.setGmailUser(gmailUser);
                    return n;
                });
        e.setProcessadoEm(Instant.now());
        e.setLancamentosCriados(lancamentosCriados);
        e.setLancamentosJaExistiam(lancamentosJaExistiam);
        e.setFalhas(falhas);
        repository.save(e);
    }
}
