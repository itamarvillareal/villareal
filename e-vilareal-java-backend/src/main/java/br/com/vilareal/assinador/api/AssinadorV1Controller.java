package br.com.vilareal.assinador.api;

import br.com.vilareal.assinador.AssinadorSecurityConstants;
import br.com.vilareal.assinador.api.dto.AssinadorConcluirResponse;
import br.com.vilareal.assinador.api.dto.AssinadorFalhaRequest;
import br.com.vilareal.assinador.api.dto.AssinadorLotePendenteResponse;
import br.com.vilareal.assinador.application.AssinadorApiService;
import br.com.vilareal.assinador.config.AssinadorApiProperties;
import br.com.vilareal.common.exception.BusinessRuleException;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import jakarta.validation.Valid;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.scheduling.TaskScheduler;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.context.request.async.DeferredResult;
import org.springframework.web.multipart.MultipartFile;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * API pull do assinador local (Windows + token A3). Autenticação: {@link AssinadorSecurityConstants#HEADER_SECRET}.
 *
 * <p><strong>HTTPS obrigatório</strong> quando {@code assinador.api.require-https=true} (padrão em produção) —
 * o segredo trafega no header e não pode ir em HTTP puro.</p>
 *
 * <p>Long-poll: usa {@link DeferredResult} + {@link TaskScheduler} para não bloquear threads do pool por 55s.
 * Limitação v1: uma tentativa de claim a cada {@code assinador.api.long-poll-interval-ms} (padrão 2s).</p>
 */
@RestController
@RequestMapping(AssinadorSecurityConstants.API_PREFIX)
@Tag(name = "Assinador local", description = "Pull HTTPS do assinador Windows (token PKCS#11)")
public class AssinadorV1Controller {

    private static final int TIMEOUT_MIN = 1;
    private static final int TIMEOUT_MAX = 120;

    private final AssinadorApiService assinadorApiService;
    private final AssinadorApiProperties properties;
    private final TaskScheduler taskScheduler;

    public AssinadorV1Controller(
            AssinadorApiService assinadorApiService,
            AssinadorApiProperties properties,
            TaskScheduler taskScheduler) {
        this.assinadorApiService = assinadorApiService;
        this.properties = properties;
        this.taskScheduler = taskScheduler;
    }

    @GetMapping("/lotes/pendente")
    @Operation(summary = "Long-poll: próximo lote liberado (claim atômico)")
    public DeferredResult<ResponseEntity<AssinadorLotePendenteResponse>> longPollPendente(
            @RequestParam(name = "timeout", defaultValue = "55") int timeoutSegundos,
            @RequestHeader(AssinadorSecurityConstants.HEADER_ASSINADOR_ID) String assinadorId) {
        validarAssinadorId(assinadorId);
        int timeout = Math.clamp(timeoutSegundos, TIMEOUT_MIN, TIMEOUT_MAX);
        long timeoutMs = timeout * 1000L;
        long deadline = System.currentTimeMillis() + timeoutMs;

        DeferredResult<ResponseEntity<AssinadorLotePendenteResponse>> resultado =
                new DeferredResult<>(timeoutMs, ResponseEntity.noContent().build());

        AtomicBoolean concluido = new AtomicBoolean(false);
        resultado.onTimeout(() -> concluido.set(true));
        resultado.onCompletion(() -> concluido.set(true));

        agendarProximaTentativa(resultado, assinadorId.trim(), deadline, concluido);
        return resultado;
    }

    @GetMapping("/lotes/{loteId}/pdfs/{arquivoId}")
    @Operation(summary = "Baixa PDF pendente do lote em assinatura (somente pelo assinador que fez claim)")
    public ResponseEntity<byte[]> baixarPdf(
            @PathVariable Long loteId,
            @PathVariable Long arquivoId,
            @RequestHeader(AssinadorSecurityConstants.HEADER_ASSINADOR_ID) String assinadorId) {
        validarAssinadorId(assinadorId);
        byte[] pdf = assinadorApiService.obterPdfDoLote(loteId, arquivoId, assinadorId.trim());
        String filename = assinadorApiService.nomePdfParaDownload(loteId, arquivoId, assinadorId.trim());
        return ResponseEntity.ok()
                .contentType(MediaType.APPLICATION_PDF)
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(filename).build().toString())
                .body(pdf);
    }

    @PostMapping(value = "/lotes/{loteId}/concluir", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Envia .p7s assinados; pareia via ProjudiPeticaoAssinaturaService e conclui o lote")
    public AssinadorConcluirResponse concluir(
            @PathVariable Long loteId,
            @RequestHeader(AssinadorSecurityConstants.HEADER_ASSINADOR_ID) String assinadorId,
            @RequestParam("arquivosP7s") List<MultipartFile> arquivosP7s) {
        validarAssinadorId(assinadorId);
        return assinadorApiService.concluirLote(loteId, assinadorId.trim(), arquivosP7s);
    }

    @PostMapping("/lotes/{loteId}/falha")
    @Operation(summary = "Registra falha (ex.: TOKEN_OCUPADO) e libera lock")
    public ResponseEntity<Void> falha(
            @PathVariable Long loteId,
            @RequestHeader(AssinadorSecurityConstants.HEADER_ASSINADOR_ID) String assinadorId,
            @Valid @RequestBody AssinadorFalhaRequest body) {
        validarAssinadorId(assinadorId);
        assinadorApiService.registrarFalha(loteId, assinadorId.trim(), body.codigo(), body.mensagem());
        return ResponseEntity.noContent().build();
    }

    private void agendarProximaTentativa(
            DeferredResult<ResponseEntity<AssinadorLotePendenteResponse>> resultado,
            String assinadorId,
            long deadlineMs,
            AtomicBoolean concluido) {
        if (concluido.get()) {
            return;
        }
        Optional<AssinadorLotePendenteResponse> claim = assinadorApiService.tentarClaimProximoLote(assinadorId);
        if (claim.isPresent()) {
            resultado.setResult(ResponseEntity.ok(claim.get()));
            return;
        }
        if (System.currentTimeMillis() >= deadlineMs) {
            resultado.setResult(ResponseEntity.noContent().build());
            return;
        }
        int intervalo = Math.max(properties.longPollIntervalMs(), 500);
        taskScheduler.schedule(
                () -> agendarProximaTentativa(resultado, assinadorId, deadlineMs, concluido),
                Instant.now().plusMillis(intervalo));
    }

    private static void validarAssinadorId(String assinadorId) {
        if (!StringUtils.hasText(assinadorId)) {
            throw new BusinessRuleException(
                    "Header " + AssinadorSecurityConstants.HEADER_ASSINADOR_ID + " é obrigatório.");
        }
    }
}
