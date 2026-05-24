package br.com.vilareal.whatsapp.service;

import br.com.vilareal.calculo.application.CalculoApplicationService;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.text.NumberFormat;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

@Service
public class WhatsAppFinanceiroContextService {

    private static final Logger log = LoggerFactory.getLogger(WhatsAppFinanceiroContextService.class);
    private static final DateTimeFormatter DATA_BR = DateTimeFormatter.ofPattern("dd/MM/yyyy");
    private static final NumberFormat MOEDA_BR = NumberFormat.getCurrencyInstance(new Locale("pt", "BR"));

    private static final Set<String> STATUS_ENCERRADOS = Set.of(
            PagamentoDominio.ST_PAGO_CONFIRMADO,
            PagamentoDominio.ST_PAGO_SEM_COMPROVANTE,
            PagamentoDominio.ST_CANCELADO,
            PagamentoDominio.ST_SUBSTITUIDO,
            PagamentoDominio.ST_CONFERIDO,
            PagamentoDominio.ST_ACERTADO);

    private final PagamentoRepository pagamentoRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final CalculoApplicationService calculoApplicationService;

    public WhatsAppFinanceiroContextService(
            PagamentoRepository pagamentoRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            CalculoApplicationService calculoApplicationService) {
        this.pagamentoRepository = pagamentoRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.calculoApplicationService = calculoApplicationService;
    }

    @Transactional(readOnly = true)
    public String montarContextoFinanceiro(Long clienteId) {
        if (clienteId == null) {
            return "Dados financeiros indisponíveis (cliente não identificado).";
        }

        log.info("Consulta financeira via WhatsApp para cliente {}", clienteId);

        ClienteEntity cliente = clienteRepository.findById(clienteId).orElse(null);
        if (cliente == null) {
            return "Dados financeiros indisponíveis (cliente não identificado).";
        }

        LocalDate hoje = LocalDate.now();
        List<PagamentoEntity> abertos =
                pagamentoRepository.findAbertosPorCliente(clienteId, STATUS_ENCERRADOS);

        List<String> linhasCalculo = montarLinhasCalculoHonorarios(cliente);

        if (abertos.isEmpty() && linhasCalculo.isEmpty()) {
            return "Nenhum débito pendente.";
        }

        StringBuilder sb = new StringBuilder();
        BigDecimal totalPendente = BigDecimal.ZERO;
        BigDecimal totalVencido = BigDecimal.ZERO;

        if (!abertos.isEmpty()) {
            Map<String, List<PagamentoEntity>> porGrupo = agruparPagamentos(abertos);
            for (Map.Entry<String, List<PagamentoEntity>> entry : porGrupo.entrySet()) {
                sb.append("- ").append(entry.getKey()).append('\n');
                for (PagamentoEntity p : entry.getValue()) {
                    BigDecimal valor = p.getValor() != null ? p.getValor() : BigDecimal.ZERO;
                    String status = formatarStatusPagamento(p, hoje);
                    if (status.startsWith("VENCIDO")) {
                        totalVencido = totalVencido.add(valor);
                    } else {
                        totalPendente = totalPendente.add(valor);
                    }
                    sb.append("   ")
                            .append(formatarParcela(p))
                            .append(" — ")
                            .append(formatarMoeda(valor))
                            .append(" — Vencimento: ")
                            .append(formatarData(p.getDataVencimento()))
                            .append(" — Status: ")
                            .append(status);
                    if (StringUtils.hasText(p.getFormaPagamento())) {
                        sb.append(" — Forma: ").append(p.getFormaPagamento());
                    }
                    if (StringUtils.hasText(p.getCodigoBarras()) || StringUtils.hasText(p.getBoletoArquivoPath())) {
                        sb.append(" — Boleto disponível");
                    }
                    sb.append('\n');
                }
            }
        }

        if (!linhasCalculo.isEmpty()) {
            sb.append("\nCÁLCULOS / HONORÁRIOS (parcelamento aceito):\n");
            for (String linha : linhasCalculo) {
                sb.append(linha).append('\n');
            }
        }

        sb.append('\n');
        sb.append("Total pendente (a vencer): ").append(formatarMoeda(totalPendente)).append('\n');
        sb.append("Total vencido: ").append(formatarMoeda(totalVencido));

        return sb.toString().trim();
    }

    private Map<String, List<PagamentoEntity>> agruparPagamentos(List<PagamentoEntity> pagamentos) {
        Map<String, List<PagamentoEntity>> map = new LinkedHashMap<>();
        for (PagamentoEntity p : pagamentos) {
            String grupo = formatarGrupoPagamento(p);
            map.computeIfAbsent(grupo, k -> new ArrayList<>()).add(p);
        }
        return map;
    }

    private String formatarGrupoPagamento(PagamentoEntity p) {
        ProcessoEntity proc = p.getProcesso();
        if (proc != null) {
            String cnj = proc.getNumeroCnj();
            if (StringUtils.hasText(cnj)) {
                return "Processo " + cnj + ": " + tituloDescricao(p);
            }
            return "Processo nº interno "
                    + (proc.getNumeroInterno() != null ? proc.getNumeroInterno() : "—")
                    + ": "
                    + tituloDescricao(p);
        }
        if (StringUtils.hasText(p.getCategoria())) {
            return p.getCategoria() + ": " + tituloDescricao(p);
        }
        return tituloDescricao(p);
    }

    private static String tituloDescricao(PagamentoEntity p) {
        if (StringUtils.hasText(p.getDescricao())) {
            return p.getDescricao().trim();
        }
        return "Pagamento";
    }

    private String formatarParcela(PagamentoEntity p) {
        if (p.getRecorrenciaParcelaAtual() != null && p.getRecorrenciaQuantidadeParcelas() != null) {
            return "Parcela " + p.getRecorrenciaParcelaAtual() + "/" + p.getRecorrenciaQuantidadeParcelas();
        }
        return "Parcela única";
    }

    private String formatarStatusPagamento(PagamentoEntity p, LocalDate hoje) {
        if (PagamentoDominio.ST_VENCIDO.equals(p.getStatus())) {
            return formatarVencido(p.getDataVencimento(), hoje);
        }
        if (p.getDataVencimento() != null && p.getDataVencimento().isBefore(hoje)) {
            return formatarVencido(p.getDataVencimento(), hoje);
        }
        if (p.getDataVencimento() != null && !p.getDataVencimento().isBefore(hoje)) {
            return "A VENCER";
        }
        return StringUtils.hasText(p.getStatus()) ? p.getStatus() : "PENDENTE";
    }

    private String formatarVencido(LocalDate vencimento, LocalDate hoje) {
        if (vencimento == null) {
            return "VENCIDO";
        }
        long dias = ChronoUnit.DAYS.between(vencimento, hoje);
        if (dias <= 0) {
            return "VENCIDO";
        }
        return "VENCIDO (" + dias + " dias)";
    }

    private List<String> montarLinhasCalculoHonorarios(ClienteEntity cliente) {
        List<String> linhas = new ArrayList<>();
        String codigo = cliente.getCodigoCliente();
        if (!StringUtils.hasText(codigo)) {
            return linhas;
        }

        List<ProcessoEntity> processos = processoRepository
                .findByCliente_Id(cliente.getId(), PageRequest.of(0, 15))
                .getContent()
                .stream()
                .filter(p -> Boolean.TRUE.equals(p.getAtivo()))
                .toList();

        for (ProcessoEntity proc : processos) {
            if (proc.getNumeroInterno() == null) {
                continue;
            }
            calculoApplicationService
                    .obterRodada(codigo, proc.getNumeroInterno(), 0)
                    .filter(payload -> payload.has("parcelamentoAceito") && payload.get("parcelamentoAceito").asBoolean(false))
                    .ifPresent(payload -> {
                        ResumoCalculo resumo = calcularResumoTitulos(payload.get("titulos"));
                        if (resumo.totalGeral().compareTo(BigDecimal.ZERO) <= 0
                                && resumo.totalHonorarios().compareTo(BigDecimal.ZERO) <= 0) {
                            return;
                        }
                        String ref = StringUtils.hasText(proc.getNumeroCnj())
                                ? proc.getNumeroCnj()
                                : "nº interno " + proc.getNumeroInterno();
                        linhas.add("- Processo " + ref + ": honorários " + formatarMoeda(resumo.totalHonorarios())
                                + ", total do cálculo " + formatarMoeda(resumo.totalGeral())
                                + " (parcelamento aceito — consulte parcelas acima se houver boletos gerados)");
                    });
        }
        return linhas;
    }

    private ResumoCalculo calcularResumoTitulos(JsonNode titulosNode) {
        BigDecimal totalHonorarios = BigDecimal.ZERO;
        BigDecimal totalGeral = BigDecimal.ZERO;
        if (titulosNode != null && titulosNode.isArray()) {
            for (JsonNode t : titulosNode) {
                if (t == null || !t.isObject()) {
                    continue;
                }
                String vi = textOrEmpty(t.get("valorInicial"));
                if (vi.isBlank()) {
                    continue;
                }
                totalHonorarios = totalHonorarios.add(parseMonetario(textOrEmpty(t.get("honorarios"))));
                totalGeral = totalGeral.add(parseMonetario(textOrEmpty(t.get("total"))));
            }
        }
        return new ResumoCalculo(totalHonorarios, totalGeral);
    }

    private static String textOrEmpty(JsonNode n) {
        if (n == null || n.isNull()) {
            return "";
        }
        return n.asText("").trim();
    }

    private static BigDecimal parseMonetario(String raw) {
        if (!StringUtils.hasText(raw)) {
            return BigDecimal.ZERO;
        }
        String s = raw.replaceAll("(?i)R\\$\\s?", "").trim().replace(".", "").replace(",", ".");
        s = s.replaceAll("[^\\d.-]", "");
        if (s.isBlank()) {
            return BigDecimal.ZERO;
        }
        try {
            return new BigDecimal(s);
        } catch (NumberFormatException e) {
            return BigDecimal.ZERO;
        }
    }

    private static String formatarMoeda(BigDecimal valor) {
        return MOEDA_BR.format(valor != null ? valor : BigDecimal.ZERO);
    }

    private static String formatarData(LocalDate data) {
        return data != null ? data.format(DATA_BR) : "—";
    }

    private record ResumoCalculo(BigDecimal totalHonorarios, BigDecimal totalGeral) {}
}
