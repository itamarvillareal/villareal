package br.com.vilareal.financeiro.application.cora;

import br.com.vilareal.financeiro.application.FinanceiroApplicationService;
import br.com.vilareal.financeiro.domain.EtapaLancamento;
import br.com.vilareal.financeiro.domain.StatusLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Reverte a Fase 2 (e elos) aplicando o log de auditoria em ordem inversa + {@link FinanceiroApplicationService#reativarLancamentos}.
 */
@Service
public class CoraDuplicataLoteAReversaoService {

    private static final Logger log = LoggerFactory.getLogger(CoraDuplicataLoteAReversaoService.class);

    private final CoraDuplicataMigracaoAuditoriaWriter auditoriaWriter;
    private final FinanceiroApplicationService financeiroApplicationService;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final LocacaoRepasseLancamentoRepository vinculoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final ProcessoRepository processoRepository;
    private final ClienteRepository clienteRepository;

    public CoraDuplicataLoteAReversaoService(
            CoraDuplicataMigracaoAuditoriaWriter auditoriaWriter,
            FinanceiroApplicationService financeiroApplicationService,
            LancamentoFinanceiroRepository lancamentoRepository,
            LocacaoRepasseLancamentoRepository vinculoRepository,
            PagamentoRepository pagamentoRepository,
            ContaContabilRepository contaContabilRepository,
            ProcessoRepository processoRepository,
            ClienteRepository clienteRepository) {
        this.auditoriaWriter = auditoriaWriter;
        this.financeiroApplicationService = financeiroApplicationService;
        this.lancamentoRepository = lancamentoRepository;
        this.vinculoRepository = vinculoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.processoRepository = processoRepository;
        this.clienteRepository = clienteRepository;
    }

    @Transactional
    public int reverterPeloLog(Path auditFile) throws IOException {
        List<CoraDuplicataMigracaoAuditoriaLinha> linhas = new ArrayList<>(auditoriaWriter.ler(auditFile));
        java.util.Collections.reverse(linhas);
        Set<Long> plReativar = new HashSet<>();
        int alteracoes = 0;

        for (CoraDuplicataMigracaoAuditoriaLinha linha : linhas) {
            if ("financeiro_lancamento".equals(linha.tabela()) && "status".equals(linha.campo())) {
                if (linha.planilhaId() != null) {
                    plReativar.add(linha.planilhaId());
                }
                continue;
            }
            alteracoes += reverterLinha(linha);
        }
        alteracoes += financeiroApplicationService.reativarLancamentos(plReativar);
        log.info("Reversão Lote A pelo log {}: {} alterações + {} PL reativados", auditFile, alteracoes, plReativar.size());
        return alteracoes;
    }

    private int reverterLinha(CoraDuplicataMigracaoAuditoriaLinha linha) {
        return switch (linha.tabela()) {
            case "locacao_repasse_lancamento" -> reverterVinculo(linha);
            case "pagamento" -> reverterPagamento(linha);
            case "financeiro_lancamento" -> reverterLancamento(linha);
            default -> 0;
        };
    }

    private int reverterVinculo(CoraDuplicataMigracaoAuditoriaLinha linha) {
        if (!"lancamento_financeiro_id".equals(linha.campo()) || linha.planilhaId() == null || linha.ofxId() == null) {
            return 0;
        }
        var vinculos = vinculoRepository.findByLancamentoFinanceiro_IdIn(Set.of(linha.ofxId()));
        for (var v : vinculos) {
            if (v.getLancamentoFinanceiro().getId().equals(linha.ofxId())) {
                v.setLancamentoFinanceiro(lancamentoRepository.findById(linha.planilhaId()).orElseThrow());
                vinculoRepository.save(v);
                return 1;
            }
        }
        return 0;
    }

    private int reverterPagamento(CoraDuplicataMigracaoAuditoriaLinha linha) {
        if (!"financeiro_lancamento_id".equals(linha.campo()) || linha.planilhaId() == null || linha.ofxId() == null) {
            return 0;
        }
        var pagamentos = pagamentoRepository.findByFinanceiroLancamento_IdIn(Set.of(linha.ofxId()));
        for (var p : pagamentos) {
            p.setFinanceiroLancamento(lancamentoRepository.findById(linha.planilhaId()).orElseThrow());
            pagamentoRepository.save(p);
            return 1;
        }
        return 0;
    }

    private int reverterLancamento(CoraDuplicataMigracaoAuditoriaLinha linha) {
        if (linha.ofxId() == null) {
            return 0;
        }
        LancamentoFinanceiroEntity ox =
                lancamentoRepository.findById(linha.ofxId()).orElse(null);
        if (ox == null) {
            return 0;
        }
        switch (linha.campo()) {
            case "grupo_compensacao" -> ox.setGrupoCompensacao(linha.valorAntes());
            case "conta_contabil_id" -> {
                if (!StringUtils.hasText(linha.valorAntes())) {
                    ox.setContaContabil(null);
                } else {
                    ox.setContaContabil(contaContabilRepository
                            .findById(Long.parseLong(linha.valorAntes()))
                            .orElse(null));
                }
            }
            case "processo_id" -> {
                if (!StringUtils.hasText(linha.valorAntes())) {
                    ox.setProcesso(null);
                } else {
                    ox.setProcesso(processoRepository
                            .findById(Long.parseLong(linha.valorAntes()))
                            .orElse(null));
                }
            }
            case "cliente_id" -> {
                if (!StringUtils.hasText(linha.valorAntes())) {
                    ox.setClienteEntidade(null);
                } else {
                    ox.setClienteEntidade(clienteRepository
                            .findById(Long.parseLong(linha.valorAntes()))
                            .orElse(null));
                }
            }
            case "etapa" -> ox.setEtapa(
                    StringUtils.hasText(linha.valorAntes())
                            ? EtapaLancamento.valueOf(linha.valorAntes())
                            : EtapaLancamento.IMPORTADO);
            default -> {
                return 0;
            }
        }
        lancamentoRepository.save(ox);
        return 1;
    }
}
