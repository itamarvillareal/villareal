package br.com.vilareal.condominio.application;

import br.com.vilareal.calculo.application.CalculoApplicationService;
import br.com.vilareal.calculo.infrastructure.persistence.projection.CalculoRodadaResumoProjection;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.fasterxml.jackson.databind.JsonNode;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.Optional;

/**
 * Consulta débitos já cadastrados em Cálculos (rodadas não aceitas) para a regra 60+1 condicional.
 */
@Service
public class CobrancaDebitosCadastradosConsultaService {

    /** Limite da regra: importar só acima de 60 dias (= 61+ dias de atraso). */
    public static final int LIMITE_DIAS_ATRASO = 60;

    private final ProcessoRepository processoRepository;
    private final CalculoRodadaRepository rodadaRepository;
    private final CalculoApplicationService calculoApplicationService;

    public CobrancaDebitosCadastradosConsultaService(
            ProcessoRepository processoRepository,
            CalculoRodadaRepository rodadaRepository,
            CalculoApplicationService calculoApplicationService) {
        this.processoRepository = processoRepository;
        this.rodadaRepository = rodadaRepository;
        this.calculoApplicationService = calculoApplicationService;
    }

    @Transactional(readOnly = true)
    public boolean unidadeTemDebitoAbertoAcimaDe60Dias(
            long clienteId, String codigoCliente8, String codigoUnidadeNormalizada, LocalDate dataReferencia) {
        Optional<ProcessoEntity> proc = buscarProcessoPorCodigoUnidade(clienteId, codigoUnidadeNormalizada);
        if (proc.isEmpty()) {
            return false;
        }
        Integer numeroInterno = proc.get().getNumeroInterno();
        if (numeroInterno == null || numeroInterno < 1) {
            return false;
        }
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente8);
        List<CalculoRodadaResumoProjection> dims =
                rodadaRepository.findResumoByCodigoClienteAndNumeroProcessoOrderByDimensaoAsc(cod8, numeroInterno);
        for (CalculoRodadaResumoProjection dim : dims) {
            if (dim.parcelamentoAceito()) {
                continue;
            }
            Optional<JsonNode> payload = calculoApplicationService.obterRodada(cod8, numeroInterno, dim.dimensao());
            if (payload.isEmpty() || !payload.get().isObject()) {
                continue;
            }
            JsonNode titulos = payload.get().get("titulos");
            if (titulos == null || !titulos.isArray()) {
                continue;
            }
            for (JsonNode titulo : titulos) {
                if (titulo == null || !titulo.isObject()) {
                    continue;
                }
                String venc = textOrEmpty(titulo.get("dataVencimento"));
                Long dias = CobrancaRegraInicioCobrancaService.diasDesdeVencimentoTexto(venc, dataReferencia);
                if (dias != null && dias > LIMITE_DIAS_ATRASO) {
                    return true;
                }
            }
        }
        return false;
    }

    private Optional<ProcessoEntity> buscarProcessoPorCodigoUnidade(long clienteId, String codigoUnidade) {
        for (String chave : CobrancaUnidadeFormatUtil.chavesBuscaProcessoPorCodigo(codigoUnidade)) {
            Optional<ProcessoEntity> found = processoRepository.findByCliente_IdAndUnidade(clienteId, chave);
            if (found.isPresent()) {
                return found;
            }
        }
        return Optional.empty();
    }

    private static String textOrEmpty(JsonNode n) {
        if (n == null || n.isNull()) {
            return "";
        }
        return n.asText("").trim();
    }
}
