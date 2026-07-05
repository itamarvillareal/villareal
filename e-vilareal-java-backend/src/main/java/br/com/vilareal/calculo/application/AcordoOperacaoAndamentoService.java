package br.com.vilareal.calculo.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class AcordoOperacaoAndamentoService {

    public static final String ORIGEM_DESCUMPRIMENTO = "ACORDO_DESCUMPRIMENTO_PROPOSTO";
    public static final String ORIGEM_COBRANCA = "ACORDO_COBRANCA_WHATSAPP";
    public static final String ORIGEM_VINCULO = "ACORDO_VINCULO_EXTRATO";
    public static final String ORIGEM_DOCUMENTO = "ACORDO_DOCUMENTO_GERADO";

    private final ProcessoRepository processoRepository;
    private final ProcessoAndamentoRepository andamentoRepository;

    public AcordoOperacaoAndamentoService(
            ProcessoRepository processoRepository, ProcessoAndamentoRepository andamentoRepository) {
        this.processoRepository = processoRepository;
        this.andamentoRepository = andamentoRepository;
    }

    @Transactional
    public void registrar(
            long processoId, String origem, String titulo, String detalhe, String importacaoId) {
        ProcessoEntity proc = processoRepository
                .findById(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
        ProcessoAndamentoEntity a = new ProcessoAndamentoEntity();
        a.setProcesso(proc);
        a.setMovimentoEm(Instant.now());
        a.setTitulo(titulo);
        a.setDetalhe(detalhe);
        a.setOrigem(origem);
        a.setOrigemAutomatica(true);
        if (StringUtils.hasText(importacaoId)) {
            a.setImportacaoId(importacaoId.trim());
        }
        andamentoRepository.save(a);
    }

    public static String novoImportacaoId() {
        return UUID.randomUUID().toString();
    }

    public static String tituloDescumprimento(int proc, int dimOrigem, int dimNova) {
        return String.format(
                Locale.ROOT,
                "Acordo descumprido — proc. %d (dim. %d → proposta dim. %d)",
                proc,
                dimOrigem,
                dimNova);
    }
}
