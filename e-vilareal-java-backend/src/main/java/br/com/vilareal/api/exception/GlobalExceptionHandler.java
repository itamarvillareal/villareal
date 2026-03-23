package br.com.vilareal.api.exception;

import br.com.vilareal.api.monitoring.exception.MonitoringNotFoundException;
import jakarta.servlet.http.HttpServletRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;

import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;

@RestControllerAdvice
public class GlobalExceptionHandler {

    @ExceptionHandler(CadastroPessoaNaoEncontradaException.class)
    public ResponseEntity<ErroResponse> cadastroPessoaNaoEncontrado(
            CadastroPessoaNaoEncontradaException ex,
            HttpServletRequest request) {
        ErroResponse body = new ErroResponse(
                Instant.now(),
                HttpStatus.NOT_FOUND.value(),
                "Not Found",
                ex.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(MonitoringNotFoundException.class)
    public ResponseEntity<ErroResponse> monitoringNaoEncontrado(
            MonitoringNotFoundException ex,
            HttpServletRequest request) {
        ErroResponse body = new ErroResponse(
                Instant.now(),
                HttpStatus.NOT_FOUND.value(),
                "Not Found",
                ex.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(body);
    }

    @ExceptionHandler(RegraNegocioException.class)
    public ResponseEntity<ErroResponse> regraNegocio(
            RegraNegocioException ex,
            HttpServletRequest request) {
        ErroResponse body = new ErroResponse(
                Instant.now(),
                HttpStatus.UNPROCESSABLE_ENTITY.value(),
                "Unprocessable Entity",
                ex.getMessage(),
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.UNPROCESSABLE_ENTITY).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ErroResponse> validacao(
            MethodArgumentNotValidException ex,
            HttpServletRequest request) {
        List<ErroResponse.CampoErro> erros = ex.getBindingResult().getAllErrors().stream()
                .map(error -> {
                    String campo = error instanceof FieldError ? ((FieldError) error).getField() : error.getObjectName();
                    String mensagem = error.getDefaultMessage();
                    return new ErroResponse.CampoErro(campo, mensagem);
                })
                .collect(Collectors.toList());
        ErroResponse body = new ErroResponse(
                Instant.now(),
                HttpStatus.BAD_REQUEST.value(),
                "Bad Request",
                "Erro de validação",
                request.getRequestURI(),
                erros
        );
        return ResponseEntity.badRequest().body(body);
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<ErroResponse> generico(Exception ex, HttpServletRequest request) {
        log.error("Erro não tratado em {}: {}", request.getRequestURI(), ex.getMessage(), ex);
        ErroResponse body = new ErroResponse(
                Instant.now(),
                HttpStatus.INTERNAL_SERVER_ERROR.value(),
                "Internal Server Error",
                "Erro interno do servidor.",
                request.getRequestURI()
        );
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(body);
    }
}
