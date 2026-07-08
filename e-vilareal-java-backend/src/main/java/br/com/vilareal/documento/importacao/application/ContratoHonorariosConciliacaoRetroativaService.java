package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.documento.ContratoHonorariosRecebiveisConciliacaoService;
import br.com.vilareal.documento.ContratoHonorariosSugestaoFinanceiroResponse;
import br.com.vilareal.documento.importacao.api.dto.ConciliacaoSugestaoItem;
import br.com.vilareal.documento.importacao.api.dto.ContratoHonorariosConciliacaoRetroativaResponse;
import br.com.vilareal.documento.importacao.infrastructure.persistence.entity.ContratoHonorariosImportacaoEntity;
import br.com.vilareal.documento.importacao.infrastructure.persistence.repository.ContratoHonorariosImportacaoRepository;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Service
public class ContratoHonorariosConciliacaoRetroativaService {

    private static final Set<String> STATUS_QUITADO =
            Set.of(PagamentoDominio.ST_RECEBIDO, PagamentoDominio.ST_CONCILIADO);

    private final ContratoHonorariosRecebiveisConciliacaoService conciliacaoService;
    private final ContratoHonorariosRepository contratoRepository;
    private final ContratoHonorariosImportacaoRepository importacaoRepository;
    private final ExtratoCoberturaApplicationService extratoCoberturaService;
    private final ObjectMapper objectMapper;

    public ContratoHonorariosConciliacaoRetroativaService(
            ContratoHonorariosRecebiveisConciliacaoService conciliacaoService,
            ContratoHonorariosRepository contratoRepository,
            ContratoHonorariosImportacaoRepository importacaoRepository,
            ExtratoCoberturaApplicationService extratoCoberturaService,
            ObjectMapper objectMapper) {
        this.conciliacaoService = conciliacaoService;
        this.contratoRepository = contratoRepository;
        this.importacaoRepository = importacaoRepository;
        this.extratoCoberturaService = extratoCoberturaService;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public ContratoHonorariosConciliacaoRetroativaResponse rodar(Long importacaoId) {
        ContratoHonorariosImportacaoEntity item = importacaoRepository
                .findById(importacaoId)
                .orElseThrow(() -> new IllegalArgumentException("Importação não encontrada: " + importacaoId));
        if (item.getContratoHonorarios() == null || item.getProcesso() == null) {
            throw new IllegalArgumentException("Importação ainda não possui contrato/processos vinculados.");
        }
        ContratoHonorariosEntity contrato = contratoRepository
                .findByProcessoIdWithDetalhes(item.getProcesso().getId())
                .orElseThrow(() -> new IllegalArgumentException("Contrato não encontrado."));
        LocalDate de = contrato.getDataContrato() != null ? contrato.getDataContrato() : LocalDate.now().minusYears(2);
        LocalDate ate = LocalDate.now();
        var cobertura = extratoCoberturaService.verificar(de, ate);
        List<String> avisos = new ArrayList<>(cobertura.avisos());

        Long processoId = item.getProcesso().getId();
        List<ContratoHonorariosSugestaoFinanceiroResponse> sugestoes =
                conciliacaoService.listarSugestoesFinanceiro(processoId, null, de, ate);

        Set<Integer> parcelasComSugestao = new HashSet<>();
        List<ConciliacaoSugestaoItem> itensSugestao = new ArrayList<>();
        for (ContratoHonorariosSugestaoFinanceiroResponse s : sugestoes) {
            if (s.numeroParcela() != null) {
                parcelasComSugestao.add(s.numeroParcela());
            }
            itensSugestao.add(new ConciliacaoSugestaoItem(
                    s.numeroParcela(),
                    s.parcelaValor(),
                    s.parcelaDataVencimento(),
                    s.financeiroLancamentoId(),
                    s.financeiroValor(),
                    s.financeiroData(),
                    s.score(),
                    s.motivo()));
        }

        int quitadas = 0;
        BigDecimal valorQuitadas = BigDecimal.ZERO;
        int paraRevisar = 0;
        int passivo = 0;
        BigDecimal valorPassivo = BigDecimal.ZERO;
        List<ContratoHonorariosParcelaEntity> parcelas =
                contrato.getParcelas() != null ? contrato.getParcelas() : List.of();
        int total = parcelas.size();

        for (ContratoHonorariosParcelaEntity parcela : parcelas) {
            BigDecimal valor = parcela.getValor() != null ? parcela.getValor() : BigDecimal.ZERO;
            if (parcelaQuitada(parcela)) {
                quitadas++;
                valorQuitadas = valorQuitadas.add(valor);
            } else if (parcela.getNumeroParcela() != null && parcelasComSugestao.contains(parcela.getNumeroParcela())) {
                paraRevisar++;
            } else {
                passivo++;
                valorPassivo = valorPassivo.add(valor);
            }
        }

        ContratoHonorariosConciliacaoRetroativaResponse resp = new ContratoHonorariosConciliacaoRetroativaResponse(
                importacaoId,
                de,
                ate,
                cobertura.suficiente(),
                total,
                quitadas,
                valorQuitadas,
                paraRevisar,
                itensSugestao,
                passivo,
                valorPassivo,
                avisos);
        try {
            item.setConciliacaoJson(objectMapper.writeValueAsString(resp));
            importacaoRepository.save(item);
        } catch (Exception ignored) {
            // não bloqueia
        }
        return resp;
    }

    private static boolean parcelaQuitada(ContratoHonorariosParcelaEntity parcela) {
        PagamentoEntity pag = parcela.getPagamento();
        if (pag == null) {
            return false;
        }
        if (pag.getFinanceiroLancamento() != null && pag.getFinanceiroLancamento().getId() != null) {
            return true;
        }
        String st = pag.getStatus();
        return st != null && STATUS_QUITADO.contains(st);
    }
}
