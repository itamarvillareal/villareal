package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.RegraInicioCobrancaDiasValidator;
import br.com.vilareal.condominio.api.dto.CobrancaUnidadeRequestDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import org.springframework.stereotype.Component;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.List;

/**
 * Regras de início de cobrança automática (.xls):
 * <ul>
 *   <li>{@code 1} — importar tudo (qualquer taxa vencida na planilha, D+1)</li>
 *   <li>{@code 61} — 60+1 condicional: na planilha exige &gt;60 dias; se já houver débito cadastrado &gt;60 dias,
 *       importa todas as taxas em aberto da unidade</li>
 * </ul>
 */
@Component
public class CobrancaRegraInicioCobrancaService {

    /** Dias mínimos na planilha para acionar unidade nova (regra 61): &gt;60 = {@code >= 61}. */
    static final int DIAS_MINIMOS_PLANILHA_CONDICIONAL = 61;

    private static final DateTimeFormatter VENCIMENTO_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    private final CobrancaDebitosCadastradosConsultaService debitosCadastradosConsulta;

    public CobrancaRegraInicioCobrancaService(CobrancaDebitosCadastradosConsultaService debitosCadastradosConsulta) {
        this.debitosCadastradosConsulta = debitosCadastradosConsulta;
    }

    public record FiltragemRegraInicio(
            List<CobrancaUnidadeRequestDto> acionadas,
            int devedoresDescartados,
            int titulosDescartados) {}

    public FiltragemRegraInicio filtrarUnidadesAcionadas(
            List<CobrancaUnidadeRequestDto> unidades,
            LocalDate dataImportacao,
            int regraDias,
            long clienteId,
            String codigoCliente8) {
        int regra = RegraInicioCobrancaDiasValidator.validar(regraDias);
        List<CobrancaUnidadeRequestDto> acionadas = new ArrayList<>();
        int devedoresDescartados = 0;
        int titulosDescartados = 0;
        if (unidades == null) {
            return new FiltragemRegraInicio(List.of(), 0, 0);
        }
        for (CobrancaUnidadeRequestDto u : unidades) {
            boolean acionada =
                    switch (regra) {
                        case RegraInicioCobrancaDiasValidator.REGRA_CONDICIONAL_60_MAIS_1 -> unidadeAcionadaCondicional60Mais1(
                                u, dataImportacao, clienteId, codigoCliente8);
                        default -> unidadeAcionada(u, dataImportacao, RegraInicioCobrancaDiasValidator.REGRA_IMPORTAR_TUDO);
                    };
            if (acionada) {
                acionadas.add(u);
            } else {
                devedoresDescartados++;
                titulosDescartados += contarTitulosUnidade(u);
            }
        }
        return new FiltragemRegraInicio(acionadas, devedoresDescartados, titulosDescartados);
    }

    /**
     * Regra 61: se já existe débito cadastrado com &gt;60 dias, importa a unidade inteira; senão exige taxa na
     * planilha com &gt;60 dias.
     */
    boolean unidadeAcionadaCondicional60Mais1(
            CobrancaUnidadeRequestDto unidade,
            LocalDate dataImportacao,
            long clienteId,
            String codigoCliente8) {
        if (unidade == null || unidade.cobrancas() == null || unidade.cobrancas().isEmpty()) {
            return false;
        }
        String cod = unidade.codigoUnidadeNormalizada();
        if (debitosCadastradosConsulta.unidadeTemDebitoAbertoAcimaDe60Dias(
                clienteId, codigoCliente8, cod, dataImportacao)) {
            return true;
        }
        return unidadeAcionada(unidade, dataImportacao, DIAS_MINIMOS_PLANILHA_CONDICIONAL);
    }

    public boolean unidadeAcionada(CobrancaUnidadeRequestDto unidade, LocalDate dataImportacao, int regraDias) {
        if (unidade == null || unidade.cobrancas() == null) {
            return false;
        }
        for (InadimplenciaCobrancaDto c : unidade.cobrancas()) {
            Long dias = diasDesdeVencimento(c, dataImportacao);
            if (dias != null && dias >= regraDias) {
                return true;
            }
        }
        return false;
    }

    /** Dias entre vencimento e data de importação; vencimento futuro ou inválido → {@code null}. */
    static Long diasDesdeVencimento(InadimplenciaCobrancaDto cobranca, LocalDate dataImportacao) {
        if (cobranca == null || cobranca.vencimento() == null || cobranca.vencimento().isBlank()) {
            return null;
        }
        return diasDesdeVencimentoTexto(cobranca.vencimento().trim(), dataImportacao);
    }

    static Long diasDesdeVencimentoTexto(String vencimento, LocalDate dataImportacao) {
        LocalDate venc = parseVencimento(vencimento);
        if (venc == null) {
            return null;
        }
        long dias = ChronoUnit.DAYS.between(venc, dataImportacao);
        if (dias <= 0) {
            return null;
        }
        return dias;
    }

    static LocalDate parseVencimento(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        try {
            return LocalDate.parse(texto, VENCIMENTO_FMT);
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    static int contarTitulosUnidade(CobrancaUnidadeRequestDto u) {
        if (u.cobrancas() == null) {
            return 0;
        }
        int n = 0;
        for (InadimplenciaCobrancaDto c : u.cobrancas()) {
            if (c != null && c.vencimento() != null && !c.vencimento().isBlank()) {
                n++;
            }
        }
        return n;
    }
}
