package br.com.vilareal.common.exception;

import br.com.vilareal.whatsapp.WhatsAppApiException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.ConstraintViolationException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.BadCredentialsException;
import org.springframework.security.core.AuthenticationException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.core.env.Environment;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.multipart.MaxUploadSizeExceededException;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * Respostas de erro JSON padronizadas.
 * <p>Contrato com o front: <strong>401</strong> apenas para falha de autenticação (JWT inválido/expirado,
 * credenciais erradas) — o SPA limpa a sessão. Regras de negócio e permissão devem preferir
 * <strong>422</strong> / <strong>403</strong>, para não deslogar o utilizador por engano.</p>
 */
@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);
    private static final int MENSAGEM_500_DEV_MAX = 500;

    private final Environment environment;

    public ApiExceptionHandler(Environment environment) {
        this.environment = environment;
    }

    @ExceptionHandler(MaxUploadSizeExceededException.class)
    public ResponseEntity<Map<String, Object>> maxUpload(MaxUploadSizeExceededException ex, HttpServletRequest req) {
        log.warn("Upload excedeu o limite: {} — {}", req.getRequestURI(), ex.getMessage());
        return body(
                HttpStatus.PAYLOAD_TOO_LARGE,
                "O envio excedeu o tamanho máximo permitido (250 MB por lote). "
                        + "Envie menos arquivos .p7s por vez ou divida em lotes menores.",
                req);
    }

    @ExceptionHandler(ResourceNotFoundException.class)
    public ResponseEntity<Map<String, Object>> notFound(ResourceNotFoundException ex, HttpServletRequest req) {
        return body(HttpStatus.NOT_FOUND, ex.getMessage(), req);
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> noResource(NoResourceFoundException ex, HttpServletRequest req) {
        return body(HttpStatus.NOT_FOUND, ex.getMessage(), req);
    }

    @ExceptionHandler(BusinessRuleException.class)
    public ResponseEntity<Map<String, Object>> rule(BusinessRuleException ex, HttpServletRequest req) {
        return body(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), req);
    }

    @ExceptionHandler(WhatsAppApiException.class)
    public ResponseEntity<Map<String, Object>> whatsAppApi(WhatsAppApiException ex, HttpServletRequest req) {
        log.warn("WhatsApp API {} — {}", req.getRequestURI(), ex.getMessage());
        HttpStatus status;
        int code = ex.getHttpStatusCode();
        if (code >= 500) {
            status = HttpStatus.BAD_GATEWAY;
        } else if (code >= 400) {
            status = HttpStatus.BAD_REQUEST;
        } else {
            status = HttpStatus.BAD_GATEWAY;
        }
        return body(status, ex.getMessage(), req);
    }

    @ExceptionHandler(DataIntegrityViolationException.class)
    public ResponseEntity<Map<String, Object>> dataIntegrity(DataIntegrityViolationException ex, HttpServletRequest req) {
        if (violacaoUkImovelClienteNumeroPlanilha(ex)) {
            return body(
                    HttpStatus.UNPROCESSABLE_ENTITY,
                    "Número da planilha já vinculado a outro imóvel deste cliente.",
                    req);
        }
        log.warn("Violação de integridade {} — {}", req.getRequestURI(), ex.getMostSpecificCause());
        return body(HttpStatus.UNPROCESSABLE_ENTITY, "Operação rejeitada: registro duplicado ou referência inválida.", req);
    }

    @ExceptionHandler(InvalidAssigneeException.class)
    public ResponseEntity<Map<String, Object>> invalidAssignee(InvalidAssigneeException ex, HttpServletRequest req) {
        return body(HttpStatus.BAD_REQUEST, ex.getMessage(), req);
    }

    @ExceptionHandler(IllegalStateException.class)
    public ResponseEntity<Map<String, Object>> illegalState(IllegalStateException ex, HttpServletRequest req) {
        return body(HttpStatus.CONFLICT, ex.getMessage(), req);
    }

    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<Map<String, Object>> illegalArgument(IllegalArgumentException ex, HttpServletRequest req) {
        return body(HttpStatus.UNPROCESSABLE_ENTITY, ex.getMessage(), req);
    }

    @ExceptionHandler(BadCredentialsException.class)
    public ResponseEntity<Map<String, Object>> badCreds(BadCredentialsException ex, HttpServletRequest req) {
        return body(HttpStatus.UNAUTHORIZED, "Login ou senha inválidos.", req);
    }

    @ExceptionHandler(AuthenticationException.class)
    public ResponseEntity<Map<String, Object>> auth(AuthenticationException ex, HttpServletRequest req) {
        return body(HttpStatus.UNAUTHORIZED, ex.getMessage() != null ? ex.getMessage() : "Não autorizado.", req);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> validation(MethodArgumentNotValidException ex, HttpServletRequest req) {
        String msg = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .collect(Collectors.joining("; "));
        return body(HttpStatus.BAD_REQUEST, msg.isBlank() ? "Dados inválidos." : msg, req);
    }

    @ExceptionHandler(ConstraintViolationException.class)
    public ResponseEntity<Map<String, Object>> constraint(ConstraintViolationException ex, HttpServletRequest req) {
        return body(HttpStatus.BAD_REQUEST, ex.getMessage(), req);
    }

    @ExceptionHandler(ResponseStatusException.class)
    public ResponseEntity<Map<String, Object>> responseStatus(ResponseStatusException ex, HttpServletRequest req) {
        HttpStatus status = HttpStatus.resolve(ex.getStatusCode().value());
        if (status == null) {
            status = HttpStatus.INTERNAL_SERVER_ERROR;
        }
        String message = ex.getReason();
        if (message == null || message.isBlank()) {
            message = ex.getMessage() != null ? ex.getMessage() : status.getReasonPhrase();
        }
        return body(status, message, req);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> generic(Exception ex, HttpServletRequest req) {
        log.error("Erro não tratado {} {}", req.getRequestURI(), ex.toString(), ex);
        String message = "Erro interno.";
        if (environment.matchesProfiles("dev")) {
            String detail = ex.getMessage();
            String shortClass = ex.getClass().getSimpleName();
            if (detail != null && !detail.isBlank()) {
                message = shortClass + ": " + detail;
            } else {
                message = shortClass;
            }
            if (message.length() > MENSAGEM_500_DEV_MAX) {
                message = message.substring(0, MENSAGEM_500_DEV_MAX - 3) + "...";
            }
        }
        return body(HttpStatus.INTERNAL_SERVER_ERROR, message, req);
    }

    private static boolean violacaoUkImovelClienteNumeroPlanilha(DataIntegrityViolationException ex) {
        String msg = ex.getMostSpecificCause() != null
                ? ex.getMostSpecificCause().getMessage()
                : ex.getMessage();
        if (msg == null) {
            return false;
        }
        String lower = msg.toLowerCase();
        return lower.contains("uk_imovel_cliente_numero_planilha");
    }

    private static ResponseEntity<Map<String, Object>> body(HttpStatus status, String message, HttpServletRequest req) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("timestamp", Instant.now().toString());
        m.put("status", status.value());
        m.put("error", status.getReasonPhrase());
        m.put("message", message);
        m.put("path", req.getRequestURI());
        return ResponseEntity.status(status).body(m);
    }
}
