package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.projudi.ProjudiNumeroReduzidoUtil;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import org.springframework.stereotype.Component;

import java.util.List;

/**
 * Listagem de movimentações PROJUDI com fallback CNJ reduzido → CNJ completo.
 */
@Component
public class ProjudiMovimentacoesListagemService {

    private final ProjudiTeorService teorService;

    public ProjudiMovimentacoesListagemService(ProjudiTeorService teorService) {
        this.teorService = teorService;
    }

    /**
     * Tenta {@link ProjudiNumeroReduzidoUtil#cnjParaNumeroReduzido}; se a lista vier vazia e o
     * reduzido for diferente do CNJ informado, repete com o número completo.
     */
    public List<MovimentacaoProjudi> listarComFallbackReduzido(Long credencialId, String numeroCnj) {
        String reduzido = ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido(numeroCnj);
        List<MovimentacaoProjudi> movs = teorService.listarMovimentacoes(credencialId, reduzido);
        if (movs.isEmpty() && !reduzido.equals(numeroCnj)) {
            movs = teorService.listarMovimentacoes(credencialId, numeroCnj);
        }
        return movs;
    }
}
