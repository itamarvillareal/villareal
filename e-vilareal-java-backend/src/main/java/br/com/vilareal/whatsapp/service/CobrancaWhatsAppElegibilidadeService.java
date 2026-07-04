package br.com.vilareal.whatsapp.service;

import br.com.vilareal.calculo.application.CalculoApplicationService;
import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.whatsapp.config.CobrancaWhatsAppProperties;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.ZoneId;
import java.time.format.DateTimeParseException;
import java.util.List;
import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Elegibilidade unificada para cobrança WhatsApp — ver {@link CobrancaWhatsAppRegras}.
 */
@Service
public class CobrancaWhatsAppElegibilidadeService {

    public static final String ORIGEM_PROCESSO = "PROCESSO";
    public static final String ORIGEM_IMOVEL = "IMOVEL";

    private static final ZoneId ZONE_BRASILIA = ZoneId.of("America/Sao_Paulo");
    private static final Pattern DATA_BR = Pattern.compile("^(\\d{1,2})/(\\d{1,2})/(\\d{4})$");

    private final CalculoApplicationService calculoApplicationService;
    private final CalculoRodadaRepository calculoRodadaRepository;
    private final ProcessoRepository processoRepository;
    private final PagamentoRepository pagamentoRepository;
    private final CobrancaWhatsAppProperties cobrancaWhatsAppProperties;

    public CobrancaWhatsAppElegibilidadeService(
            CalculoApplicationService calculoApplicationService,
            CalculoRodadaRepository calculoRodadaRepository,
            ProcessoRepository processoRepository,
            PagamentoRepository pagamentoRepository,
            CobrancaWhatsAppProperties cobrancaWhatsAppProperties) {
        this.calculoApplicationService = calculoApplicationService;
        this.calculoRodadaRepository = calculoRodadaRepository;
        this.processoRepository = processoRepository;
        this.pagamentoRepository = pagamentoRepository;
        this.cobrancaWhatsAppProperties = cobrancaWhatsAppProperties;
    }

    public record Avaliacao(
            boolean elegivelCobranca,
            String motivoInelegivel,
            boolean calculoDesatualizado,
            String dataCalculo,
            int debitosAbertos,
            int parcelasAbertas,
            BigDecimal valorDebitoAberto) {}

    @Transactional(readOnly = true)
    public Optional<Avaliacao> avaliarPorProcessoId(Long processoId) {
        if (processoId == null || processoId <= 0) {
            return Optional.empty();
        }
        return processoRepository
                .findById(processoId)
                .flatMap(p -> {
                    if (p.getCliente() == null || !StringUtils.hasText(p.getCliente().getCodigoCliente())) {
                        return Optional.empty();
                    }
                    if (p.getNumeroInterno() == null) {
                        return Optional.empty();
                    }
                    String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(p.getCliente().getCodigoCliente());
                    return Optional.of(avaliarProcessoEscritorio(cod8, p.getNumeroInterno()));
                });
    }

    @Transactional(readOnly = true)
    public Avaliacao avaliarProcessoEscritorio(String codigoCliente8, int numeroProcessoInterno) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente8);
        Optional<JsonNode> rodadaOpt = calculoApplicationService.obterRodada(cod8, numeroProcessoInterno, 0);
        boolean parcelamentoAceito = calculoRodadaRepository
                .findByCodigoClienteAndNumeroProcessoAndDimensao(cod8, numeroProcessoInterno, 0)
                .map(CalculoRodadaEntity::isParcelamentoAceito)
                .orElse(false);

        if (rodadaOpt.isEmpty()) {
            return inelegivelSemCalculo();
        }

        JsonNode rodada = rodadaOpt.get();
        String dataCalculo = texto(rodada.path("meta").path("dataCalculo"));
        boolean calculoDesatualizado = dataCalculoDesatualizada(dataCalculo);

        int debitosAbertos = 0;
        int parcelasAbertas = 0;
        BigDecimal valorAberto = BigDecimal.ZERO;

        JsonNode debitos = rodada.path("debitos");
        if (debitos.isArray()) {
            for (JsonNode d : debitos) {
                if (debitoQuitado(d)) {
                    continue;
                }
                debitosAbertos++;
                valorAberto = valorAberto.add(totalDebitoLinha(d));
            }
        }

        JsonNode parcelas = rodada.path("parcelas");
        if (parcelas.isArray()) {
            for (JsonNode p : parcelas) {
                if (parcelaQuitada(p)) {
                    continue;
                }
                parcelasAbertas++;
                valorAberto = valorAberto.add(valorParcela(p));
            }
        }

        valorAberto = valorAberto.setScale(2, RoundingMode.HALF_UP);
        int totalDebitos = debitos.isArray() ? debitos.size() : 0;
        int totalParcelas = parcelas.isArray() ? parcelas.size() : 0;

        if (debitosAbertos == 0 && parcelasAbertas == 0) {
            String motivo = motivoQuitado(totalDebitos, totalParcelas, parcelamentoAceito);
            return new Avaliacao(
                    false,
                    motivo,
                    calculoDesatualizado,
                    dataCalculo,
                    0,
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        }

        return new Avaliacao(true, null, calculoDesatualizado, dataCalculo, debitosAbertos, parcelasAbertas, valorAberto);
    }

    @Transactional(readOnly = true)
    public Avaliacao avaliarImovel(Long imovelId, Long clienteId) {
        if (imovelId == null || clienteId == null) {
            return new Avaliacao(
                    false,
                    "Imóvel ou cliente inválido",
                    false,
                    null,
                    0,
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        }
        List<PagamentoEntity> abertos = pagamentoRepository.findReceberAbertosPorImovelOuCliente(imovelId, clienteId);
        BigDecimal valorAberto = abertos.stream()
                .map(PagamentoEntity::getValor)
                .filter(v -> v != null)
                .reduce(BigDecimal.ZERO, BigDecimal::add)
                .setScale(2, RoundingMode.HALF_UP);
        if (valorAberto.compareTo(BigDecimal.ZERO) <= 0) {
            return new Avaliacao(
                    false,
                    "Sem recebíveis em aberto",
                    false,
                    null,
                    0,
                    0,
                    BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
        }
        return new Avaliacao(true, null, false, null, 0, 0, valorAberto);
    }

    @Transactional(readOnly = true)
    public Optional<String> motivoInelegivelEnvio(Long imovelId, Long processoId, Long clienteId) {
        if (imovelId != null && clienteId != null) {
            return motivoInelegivel(avaliarImovel(imovelId, clienteId));
        }
        if (processoId != null) {
            return avaliarPorProcessoId(processoId)
                    .filter(av -> !av.elegivelCobranca())
                    .map(av -> av.motivoInelegivel() != null ? av.motivoInelegivel() : "Inelegível para cobrança");
        }
        return Optional.empty();
    }

    private Optional<String> motivoInelegivel(Avaliacao av) {
        if (av.elegivelCobranca()) {
            return Optional.empty();
        }
        return Optional.of(av.motivoInelegivel() != null ? av.motivoInelegivel() : "Inelegível para cobrança");
    }

    private static Avaliacao inelegivelSemCalculo() {
        return new Avaliacao(
                false,
                "Sem cálculo cadastrado",
                false,
                null,
                0,
                0,
                BigDecimal.ZERO.setScale(2, RoundingMode.HALF_UP));
    }

    private static String motivoQuitado(int totalDebitos, int totalParcelas, boolean parcelamentoAceito) {
        if (totalDebitos == 0 && totalParcelas == 0) {
            return "Sem débitos no cálculo";
        }
        if (parcelamentoAceito && totalParcelas > 0) {
            return "Parcelamento quitado no cálculo";
        }
        return "Quitado no cálculo";
    }

    boolean dataCalculoDesatualizada(String dataCalculo) {
        LocalDate data = parseDataBr(dataCalculo);
        if (data == null) {
            return true;
        }
        if (data.getYear() < 2000) {
            return true;
        }
        LocalDate limite =
                LocalDate.now(ZONE_BRASILIA).minusMonths(cobrancaWhatsAppProperties.getMesesCalculoDesatualizado());
        return data.isBefore(limite);
    }

    static LocalDate parseDataBr(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        Matcher m = DATA_BR.matcher(raw.trim());
        if (!m.matches()) {
            return null;
        }
        try {
            int dia = Integer.parseInt(m.group(1));
            int mes = Integer.parseInt(m.group(2));
            int ano = Integer.parseInt(m.group(3));
            return LocalDate.of(ano, mes, dia);
        } catch (DateTimeParseException | NumberFormatException e) {
            return null;
        }
    }

    private static boolean debitoQuitado(JsonNode d) {
        return StringUtils.hasText(texto(d.path("dataPagamento")));
    }

    private static boolean parcelaQuitada(JsonNode p) {
        return StringUtils.hasText(texto(p.path("dataPagamento")));
    }

    private static BigDecimal totalDebitoLinha(JsonNode d) {
        double total = parseBrlMonetario(texto(d.path("valor")))
                + parseBrlMonetario(texto(d.path("atualizacaoMonetaria")))
                + parseBrlMonetario(texto(d.path("juros")))
                + parseBrlMonetario(texto(d.path("multa")))
                + parseBrlMonetario(texto(d.path("honorarios")));
        return BigDecimal.valueOf(trunc2(total));
    }

    private static BigDecimal valorParcela(JsonNode p) {
        String raw = texto(p.path("valorParcela"));
        if (!StringUtils.hasText(raw)) {
            raw = texto(p.path("valor"));
        }
        return BigDecimal.valueOf(trunc2(parseBrlMonetario(raw)));
    }

    private static double parseBrlMonetario(String raw) {
        if (!StringUtils.hasText(raw)) {
            return 0;
        }
        String s = raw.replaceAll("(?i)R\\$\\s?", "").trim().replace(".", "").replace(",", ".");
        s = s.replaceAll("[^\\d.-]", "");
        if (s.isBlank()) {
            return 0;
        }
        try {
            return Double.parseDouble(s);
        } catch (NumberFormatException e) {
            return 0;
        }
    }

    private static double trunc2(double n) {
        return Math.floor(n * 100.0) / 100.0;
    }

    private static String texto(JsonNode n) {
        if (n == null || n.isNull()) {
            return "";
        }
        return n.asText("").trim();
    }
}
