package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.financeiro.api.dto.LancamentoFinanceiroWriteRequest;
import br.com.vilareal.financeiro.domain.NaturezaLancamento;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.ofx.OfxParser;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.List;

/**
 * Importação de extrato Cora a partir de bytes OFX (e-mail ou upload futuro).
 */
@Service
public class ExtratoCoraImportService {

    private static final Logger log = LoggerFactory.getLogger(ExtratoCoraImportService.class);

    private static final int NUMERO_BANCO_CORA = 26;
    private static final String BANCO_NOME_CORA = "CORA";
    private static final String ORIGEM_OFX_EMAIL = "OFX_EMAIL_CORA";
    private static final String CONTA_NAO_IDENTIFICADO = "N";

    private final FinanceiroApplicationService financeiroApplicationService;
    private final ContaContabilRepository contaContabilRepository;

    public ExtratoCoraImportService(
            FinanceiroApplicationService financeiroApplicationService,
            ContaContabilRepository contaContabilRepository) {
        this.financeiroApplicationService = financeiroApplicationService;
        this.contaContabilRepository = contaContabilRepository;
    }

    public ExtratoCoraImportResult importar(byte[] ofx) {
        ExtratoCoraImportResult resumo = new ExtratoCoraImportResult();
        if (ofx == null || ofx.length == 0) {
            return resumo;
        }

        ContaContabilEntity contaN = contaContabilRepository
                .findFirstByCodigoIgnoreCase(CONTA_NAO_IDENTIFICADO)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Conta contábil N (Conta Não Identificados) não encontrada — necessária para importação OFX."));

        String texto = OfxParser.decodificarOfx(ofx);
        List<OfxParser.OfxTransacao> transacoes = OfxParser.parseTransacoes(texto);
        resumo.setTotalNoArquivo(transacoes.size());

        for (OfxParser.OfxTransacao tx : transacoes) {
            try {
                LancamentoFinanceiroWriteRequest req = montarRequest(tx, contaN.getId());
                if (req == null) {
                    resumo.setFalhas(resumo.getFalhas() + 1);
                    continue;
                }
                financeiroApplicationService.criarLancamento(req);
                resumo.setCriados(resumo.getCriados() + 1);
            } catch (DataIntegrityViolationException ex) {
                if (violacaoUkNumeroBancoLancamento(ex)) {
                    resumo.setJaExistia(resumo.getJaExistia() + 1);
                } else {
                    log.warn(
                            "Falha de integridade ao importar lançamento Cora FITID={}: {}",
                            tx.fitId(),
                            mensagemRaiz(ex));
                    resumo.setFalhas(resumo.getFalhas() + 1);
                }
            } catch (Exception ex) {
                log.warn(
                        "Falha ao importar lançamento Cora FITID={}: {}",
                        tx.fitId(),
                        mensagemRaiz(ex));
                resumo.setFalhas(resumo.getFalhas() + 1);
            }
        }

        return resumo;
    }

    private LancamentoFinanceiroWriteRequest montarRequest(OfxParser.OfxTransacao tx, Long contaContabilId) {
        if (!StringUtils.hasText(tx.fitId()) || tx.dataLancamento() == null) {
            log.warn(
                    "Transação OFX ignorada: FITID ou data ausente (fitId={}, data={})",
                    tx.fitId(),
                    tx.dataLancamento());
            return null;
        }

        String descricao = StringUtils.hasText(tx.memo()) ? tx.memo() : tx.name();
        if (!StringUtils.hasText(descricao)) {
            descricao = "LANÇAMENTO";
        }

        BigDecimal trnAmt = tx.trnAmt() != null ? tx.trnAmt() : BigDecimal.ZERO;
        NaturezaLancamento natureza =
                trnAmt.compareTo(BigDecimal.ZERO) >= 0 ? NaturezaLancamento.CREDITO : NaturezaLancamento.DEBITO;
        BigDecimal valor = trnAmt.abs().setScale(2, RoundingMode.HALF_UP);

        LancamentoFinanceiroWriteRequest req = new LancamentoFinanceiroWriteRequest();
        req.setContaContabilId(contaContabilId);
        req.setBancoNome(BANCO_NOME_CORA);
        req.setNumeroBanco(NUMERO_BANCO_CORA);
        req.setNumeroLancamento(tx.fitId().trim());
        req.setDataLancamento(tx.dataLancamento());
        req.setDescricao(descricao.trim());
        if (StringUtils.hasText(tx.trnType())) {
            req.setDescricaoDetalhada(tx.trnType() + (StringUtils.hasText(tx.memo()) ? " — " + tx.memo() : ""));
        }
        req.setValor(valor);
        req.setNatureza(natureza);
        req.setRefTipo("N");
        req.setOrigem(ORIGEM_OFX_EMAIL);
        req.setStatus("ATIVO");
        return req;
    }

    private static boolean violacaoUkNumeroBancoLancamento(DataIntegrityViolationException ex) {
        String msg = mensagemRaiz(ex).toLowerCase();
        return msg.contains("uk_fl_numero_banco_lancamento")
                || msg.contains("duplicate")
                || msg.contains("duplicat");
    }

    private static String mensagemRaiz(Throwable ex) {
        Throwable t = ex;
        String last = t.getMessage() != null ? t.getMessage() : t.getClass().getSimpleName();
        while (t.getCause() != null && t.getCause() != t) {
            t = t.getCause();
            if (t.getMessage() != null && !t.getMessage().isBlank()) {
                last = t.getMessage();
            }
        }
        return last;
    }
}
