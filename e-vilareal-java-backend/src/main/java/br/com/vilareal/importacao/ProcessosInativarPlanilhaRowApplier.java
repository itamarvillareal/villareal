package br.com.vilareal.importacao;

import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

/**
 * Uma transação por linha (commit isolado), alinhado a {@link InformacoesProcessosImportRowApplier}.
 */
@Service
public class ProcessosInativarPlanilhaRowApplier {

    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final ProcessoRepository processoRepository;
    private final ProcessoApplicationService processoApplicationService;

    public ProcessosInativarPlanilhaRowApplier(
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService) {
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
    }

    public record Resultado(boolean inativado, Long processoId) {
        public static Resultado ok(long processoId) {
            return new Resultado(true, processoId);
        }

        public static Resultado naoEncontrado() {
            return new Resultado(false, null);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, rollbackFor = Exception.class)
    public Resultado aplicar(String codigoCliente, int numeroInterno) {
        long pessoaId = clienteCodigoPessoaResolver.resolverPessoaId(codigoCliente);
        return processoRepository
                .findByPessoa_IdAndNumeroInterno(pessoaId, numeroInterno)
                .map(e -> {
                    processoApplicationService.patchAtivo(e.getId(), false);
                    return Resultado.ok(e.getId());
                })
                .orElseGet(Resultado::naoEncontrado);
    }
}
