package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.CalculoCobrancaMergeService;
import br.com.vilareal.calculo.application.DebitoNovo;
import br.com.vilareal.calculo.application.ResultadoMerge;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.List;

@Service
public class CobrancaAutomaticaUnidadeTransactionalService {

    private final CobrancaUnidadeResolverService resolverService;
    private final CalculoCobrancaMergeService mergeService;
    private final CobrancaAndamentoService andamentoService;

    public CobrancaAutomaticaUnidadeTransactionalService(
            CobrancaUnidadeResolverService resolverService,
            CalculoCobrancaMergeService mergeService,
            CobrancaAndamentoService andamentoService) {
        this.resolverService = resolverService;
        this.mergeService = mergeService;
        this.andamentoService = andamentoService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public UnidadeProcessamentoResult processarUnidade(
            long clienteId,
            long clientePessoaId,
            String codigoCliente8,
            CobrancaUnidadeRequestDto unidade,
            String importacaoId) {
        String codUnidade = unidade.codigoUnidadeNormalizada().trim().toUpperCase();
        if (!StringUtils.hasText(codUnidade)) {
            throw new BusinessRuleException("Código da unidade é obrigatório.");
        }

        ResolverUnidadeInput resolverIn = new ResolverUnidadeInput(
                clienteId,
                clientePessoaId,
                codigoCliente8,
                codUnidade,
                unidade.proprietarioNome().trim(),
                unidade.proprietarioDocDigitos(),
                importacaoId);

        ResolucaoUnidade resolucao = resolverService.resolverUnidade(resolverIn);

        List<DebitoNovo> debitos = toDebitosNovos(unidade.cobrancas());
        ResultadoMerge merge =
                mergeService.mesclarDebitos(codigoCliente8, resolucao.numeroInterno(), debitos, importacaoId);

        andamentoService.registrarAndamentosCobranca(resolucao.processoId(), importacaoId, resolucao, merge);

        return new UnidadeProcessamentoResult(unidade, resolucao, merge);
    }

    private static List<DebitoNovo> toDebitosNovos(List<InadimplenciaCobrancaDto> cobrancas) {
        List<DebitoNovo> out = new ArrayList<>();
        if (cobrancas == null) {
            return out;
        }
        for (InadimplenciaCobrancaDto c : cobrancas) {
            if (c == null) {
                continue;
            }
            String venc = c.vencimento() != null ? c.vencimento().trim() : "";
            String desc = c.receita() != null ? c.receita().trim() : "";
            if (!StringUtils.hasText(venc)) {
                continue;
            }
            out.add(new DebitoNovo(venc, c.valorCentavos(), desc));
        }
        return out;
    }
}
