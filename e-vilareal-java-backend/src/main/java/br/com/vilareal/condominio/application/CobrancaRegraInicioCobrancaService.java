package br.com.vilareal.condominio.application;

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
 * Regra de início de cobrança (D+T): só unidades com ao menos um título com {@code dias >= T}
 * entram no pipeline de /processar.
 */
@Component
public class CobrancaRegraInicioCobrancaService {

    private static final DateTimeFormatter VENCIMENTO_FMT = DateTimeFormatter.ofPattern("dd/MM/yyyy");

    public record FiltragemRegraInicio(
            List<CobrancaUnidadeRequestDto> acionadas,
            int devedoresDescartados,
            int titulosDescartados) {}

    public FiltragemRegraInicio filtrarUnidadesAcionadas(
            List<CobrancaUnidadeRequestDto> unidades, LocalDate dataImportacao, int regraDias) {
        List<CobrancaUnidadeRequestDto> acionadas = new ArrayList<>();
        int devedoresDescartados = 0;
        int titulosDescartados = 0;
        if (unidades == null) {
            return new FiltragemRegraInicio(List.of(), 0, 0);
        }
        for (CobrancaUnidadeRequestDto u : unidades) {
            if (unidadeAcionada(u, dataImportacao, regraDias)) {
                acionadas.add(u);
            } else {
                devedoresDescartados++;
                titulosDescartados += contarTitulosUnidade(u);
            }
        }
        return new FiltragemRegraInicio(acionadas, devedoresDescartados, titulosDescartados);
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
        LocalDate venc = parseVencimento(cobranca.vencimento().trim());
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
