package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.ResultadoMerge;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoAndamentoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoAndamentoRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

/**
 * Registra andamentos automáticos da cobrança por inadimplência (.xls).
 */
@Service
public class CobrancaAndamentoService {

    public static final String ORIGEM_COBRANCA_AUTOMATICA = "COBRANCA_AUTOMATICA";
    public static final String ORIGEM_REVISAO_TROCA_DONO = "COBRANCA_REVISAO_TROCA_DONO";

    private final ProcessoRepository processoRepository;
    private final ProcessoAndamentoRepository andamentoRepository;

    public CobrancaAndamentoService(
            ProcessoRepository processoRepository, ProcessoAndamentoRepository andamentoRepository) {
        this.processoRepository = processoRepository;
        this.andamentoRepository = andamentoRepository;
    }

    @Transactional
    public void registrarAndamentosCobranca(
            long processoId,
            String importacaoId,
            ResolucaoUnidade resolucao,
            ResultadoMerge merge) {
        ProcessoEntity proc = processoRepository
                .findById(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));

        String detalhe = montarDetalheCobranca(resolucao, merge);
        salvarAndamento(proc, importacaoId, ORIGEM_COBRANCA_AUTOMATICA, tituloCobranca(resolucao), detalhe);

        if (resolucao.revisaoTrocaDono()) {
            String detRev =
                    montarDetalheRevisaoTrocaDono(resolucao, merge) + "\n\n" + detalhe;
            salvarAndamento(
                    proc,
                    importacaoId,
                    ORIGEM_REVISAO_TROCA_DONO,
                    "Revisão — troca de proprietário (cobrança automática)",
                    detRev);
        }
    }

    private void salvarAndamento(
            ProcessoEntity proc, String importacaoId, String origem, String titulo, String detalhe) {
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

    static String tituloCobranca(ResolucaoUnidade resolucao) {
        if (resolucao == null) {
            return "Cobrança automática";
        }
        return String.format(Locale.ROOT, "Cobrança automática — proc. %d", resolucao.numeroInterno());
    }

    static String montarDetalheCobranca(ResolucaoUnidade resolucao, ResultadoMerge merge) {
        List<String> linhas = new ArrayList<>();
        if (resolucao != null) {
            linhas.add("Processo nº interno: " + resolucao.numeroInterno());
            linhas.add("Processo criado nesta execução: " + (resolucao.processoCriado() ? "sim" : "não"));
            linhas.add("Pessoa devedora (id): " + resolucao.pessoaIdDevedor());
            if (resolucao.pessoaCriada()) {
                linhas.add("Pessoa criada: sim" + (resolucao.generoDefinido() != null ? " (gênero " + resolucao.generoDefinido() + ")" : ""));
            }
            if (resolucao.reuVinculado()) {
                linhas.add("RÉU Proprietário vinculado nesta execução.");
            }
        }
        if (merge != null) {
            int inseridos = contarInseridos(merge);
            int ignorados = merge.debitosIgnorados() != null ? merge.debitosIgnorados().size() : 0;
            linhas.add("Débitos inseridos: " + inseridos);
            linhas.add("Débitos ignorados (já existentes): " + ignorados);
            Integer dim = dimensaoPrincipal(merge);
            if (dim != null) {
                linhas.add("Dimensão principal: " + dim);
            }
            for (ResultadoMerge.DimensaoTocada d : merge.dimensoesTocadas()) {
                linhas.add(String.format(
                        Locale.ROOT,
                        "  Dim. %d: %d inserção(ões)%s",
                        d.dimensao(),
                        d.insercoes() != null ? d.insercoes().size() : 0,
                        d.dimensaoCriada() ? " (dimensão criada)" : ""));
            }
            for (ResultadoMerge.DebitoIgnorado ig : merge.debitosIgnorados()) {
                linhas.add(String.format(
                        Locale.ROOT,
                        "  Ignorado: venc. %s — %d centavos (já na dim. %d) — %s",
                        ig.vencimento(),
                        ig.valorCentavos(),
                        ig.dimensaoExistente(),
                        ig.motivo()));
            }
        }
        return String.join("\n", linhas);
    }

    static String montarDetalheRevisaoTrocaDono(ResolucaoUnidade resolucao, ResultadoMerge merge) {
        StringBuilder sb = new StringBuilder();
        sb.append("Troca de dono detectada: novo processo alocado para a unidade.");
        if (resolucao != null && resolucao.pessoaIdReuAnterior() != null) {
            sb.append(" RÉU anterior (pessoa id): ").append(resolucao.pessoaIdReuAnterior()).append('.');
        }
        sb.append(" O processo anterior da unidade não foi alterado.");
        if (merge != null) {
            int ins = contarInseridos(merge);
            if (ins > 0) {
                sb.append(" Débitos aplicados no novo processo: ").append(ins).append('.');
            }
        }
        return sb.toString();
    }

    static int contarInseridos(ResultadoMerge merge) {
        if (merge == null || merge.dimensoesTocadas() == null) {
            return 0;
        }
        int n = 0;
        for (ResultadoMerge.DimensaoTocada d : merge.dimensoesTocadas()) {
            if (d.insercoes() != null) {
                n += d.insercoes().size();
            }
        }
        return n;
    }

    static Integer dimensaoPrincipal(ResultadoMerge merge) {
        if (merge == null) {
            return null;
        }
        if (merge.dimensoesTocadas() != null && !merge.dimensoesTocadas().isEmpty()) {
            return merge.dimensoesTocadas().stream()
                    .mapToInt(ResultadoMerge.DimensaoTocada::dimensao)
                    .max()
                    .orElse(0);
        }
        if (merge.debitosIgnorados() != null && !merge.debitosIgnorados().isEmpty()) {
            return merge.debitosIgnorados().getFirst().dimensaoExistente();
        }
        return 0;
    }
}
