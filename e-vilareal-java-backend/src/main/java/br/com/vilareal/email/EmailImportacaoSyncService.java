package br.com.vilareal.email;

import br.com.vilareal.email.infrastructure.persistence.entity.EmailImportacaoSyncEntity;
import br.com.vilareal.email.infrastructure.persistence.repository.EmailImportacaoSyncRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.Optional;

@Service
public class EmailImportacaoSyncService {

    /** Margem para não perder emails no limite do cursor (Gmail after: em segundos). */
    private static final long MARGEM_SEGUNDOS = 120L;

    private final EmailImportacaoSyncRepository repository;

    public EmailImportacaoSyncService(EmailImportacaoSyncRepository repository) {
        this.repository = repository;
    }

    @Transactional(readOnly = true)
    public Optional<Instant> obterUltimaSincronizacao(EmailImportacaoSyncTipo tipo) {
        return repository.findById(tipo.getId()).map(EmailImportacaoSyncEntity::getUltimaSincronizacaoEm);
    }

    /** Cursor para busca incremental; na primeira execução usa janela inicial de 30 dias. */
    @Transactional(readOnly = true)
    public Instant obterCursorParaBuscaIncremental(EmailImportacaoSyncTipo tipo) {
        return obterUltimaSincronizacao(tipo).orElse(Instant.now().minus(30, ChronoUnit.DAYS));
    }

    @Transactional
    public Instant registrarSincronizacao(EmailImportacaoSyncTipo tipo, Instant instant) {
        Instant gravar = instant != null ? instant : Instant.now();
        EmailImportacaoSyncEntity e = repository
                .findById(tipo.getId())
                .orElseGet(() -> {
                    EmailImportacaoSyncEntity n = new EmailImportacaoSyncEntity();
                    n.setTipo(tipo.getId());
                    return n;
                });
        e.setUltimaSincronizacaoEm(gravar);
        e.setUpdatedAt(Instant.now());
        repository.save(e);
        return gravar;
    }

    public static String montarQueryIncremental(String remetente, Instant cursorDesde) {
        Instant desde = cursorDesde != null ? cursorDesde.minus(MARGEM_SEGUNDOS, ChronoUnit.SECONDS) : Instant.now();
        long epoch = Math.max(0L, desde.getEpochSecond());
        return "from:" + remetente + " after:" + epoch;
    }

    public static String montarQueryCaixaCompleta(String remetente) {
        return "from:" + remetente;
    }
}
