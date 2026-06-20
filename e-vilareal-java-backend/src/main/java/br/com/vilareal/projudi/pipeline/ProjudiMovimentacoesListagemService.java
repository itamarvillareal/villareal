package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.projudi.ProjudiNumeroReduzidoUtil;
import br.com.vilareal.projudi.ProjudiTeorService;
import br.com.vilareal.projudi.ProjudiTeorService.ConsultaProcessoProjudi;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.util.List;

/**
 * Listagem de movimentações PROJUDI com fallback CNJ reduzido → CNJ completo.
 */
@Component
public class ProjudiMovimentacoesListagemService {

    public record ListagemMovimentacoes(List<MovimentacaoProjudi> movimentacoes, LocalDate dataDistribuicao) {}

    private final ProjudiTeorService teorService;

    public ProjudiMovimentacoesListagemService(ProjudiTeorService teorService) {
        this.teorService = teorService;
    }

    /**
     * Tenta {@link ProjudiNumeroReduzidoUtil#cnjParaNumeroReduzido}; se a lista vier vazia e o
     * reduzido for diferente do CNJ informado, repete com o número completo.
     */
    public ListagemMovimentacoes listarComFallbackReduzido(Long credencialId, String numeroCnj) {
        String reduzido = ProjudiNumeroReduzidoUtil.cnjParaNumeroReduzido(numeroCnj);
        ConsultaProcessoProjudi consultaReduzida = teorService.consultarProcesso(credencialId, reduzido);
        if (!consultaReduzida.movimentacoes().isEmpty() || reduzido.equals(numeroCnj)) {
            return new ListagemMovimentacoes(
                    consultaReduzida.movimentacoes(), consultaReduzida.dataDistribuicao());
        }
        ConsultaProcessoProjudi consultaCompleta = teorService.consultarProcesso(credencialId, numeroCnj);
        LocalDate dataDistribuicao = consultaCompleta.dataDistribuicao() != null
                ? consultaCompleta.dataDistribuicao()
                : consultaReduzida.dataDistribuicao();
        return new ListagemMovimentacoes(consultaCompleta.movimentacoes(), dataDistribuicao);
    }

    /** Compatibilidade com chamadas que só precisam das movimentações. */
    public List<MovimentacaoProjudi> listarMovimentacoesComFallbackReduzido(Long credencialId, String numeroCnj) {
        return listarComFallbackReduzido(credencialId, numeroCnj).movimentacoes();
    }
}
