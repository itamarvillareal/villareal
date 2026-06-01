package br.com.vilareal.documento;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.TimeUnit;

/**
 * OCR sob demanda via {@code ocrmypdf} (CLI).
 *
 * <p>Modos permitidos: {@code --skip-text} (padrão/robô) e {@code --redo-ocr} (backfill redo).
 * Nunca {@code --force-ocr}.</p>
 *
 * <p>Flags por modo:</p>
 * <ul>
 *   <li>SKIP_TEXT: {@code --skip-text --deskew --clean --rotate-pages}</li>
 *   <li>REDO_OCR: {@code --redo-ocr --clean --rotate-pages} (sem {@code --deskew})</li>
 * </ul>
 *
 * <p>Dependências no host (não Maven):</p>
 * <ul>
 *   <li>macOS: {@code brew install ocrmypdf tesseract tesseract-lang unpaper}</li>
 *   <li>Debian/Ubuntu: {@code apt install ocrmypdf tesseract-ocr tesseract-ocr-por unpaper}</li>
 * </ul>
 */
@Service
public class OcrService {

    private static final Logger log = LoggerFactory.getLogger(OcrService.class);

    private final boolean enabled;
    private final String ocrmypdfCommand;
    private final String language;
    private final int minCaracteres;
    private final long timeoutSeconds;

    public OcrService(
            @Value("${vilareal.ocr.enabled:true}") boolean enabled,
            @Value("${vilareal.ocr.ocrmypdf.command:ocrmypdf}") String ocrmypdfCommand,
            @Value("${vilareal.ocr.language:por}") String language,
            @Value("${vilareal.ocr.min-caracteres:32}") int minCaracteres,
            @Value("${vilareal.ocr.timeout-seconds:180}") long timeoutSeconds) {
        this.enabled = enabled;
        this.ocrmypdfCommand = ocrmypdfCommand == null ? "ocrmypdf" : ocrmypdfCommand.trim();
        this.language = language == null || language.isBlank() ? "por" : language.trim();
        this.minCaracteres = Math.max(1, minCaracteres);
        this.timeoutSeconds = Math.max(30L, timeoutSeconds);
    }

    public boolean isEnabled() {
        return enabled;
    }

    public int getMinCaracteres() {
        return minCaracteres;
    }

    /**
     * Pipeline do robô: só roda se o PDF inteiro está abaixo do limiar de texto.
     * Usa {@code --skip-text --deskew --clean --rotate-pages} (best-effort).
     */
    public ResultadoOcr processarPdfSeNecessario(byte[] pdfBytes) {
        if (!PdfTextoExtracaoUtil.parecePdf(pdfBytes)) {
            return ResultadoOcr.semOcr(pdfBytes, "");
        }
        String texto = PdfTextoExtracaoUtil.extrairTexto(pdfBytes);
        if (!PdfTextoExtracaoUtil.precisaOcr(texto, minCaracteres)) {
            return ResultadoOcr.semOcr(pdfBytes, texto);
        }
        return aplicarOcr(pdfBytes, ModoOcr.SKIP_TEXT);
    }

    /**
     * Backfill: roda ocrmypdf em todo PDF da pasta Movimentações (sem gate precisaOcr).
     * {@code redoOcr=false}: {@code --skip-text}; {@code redoOcr=true}: {@code --redo-ocr}.
     * Regrava só se {@code paginasOcr >= 1} e validação de saída OK.
     */
    public ResultadoBackfill processarPdfBackfill(byte[] pdfBytes, boolean redoOcr) {
        if (!PdfTextoExtracaoUtil.parecePdf(pdfBytes)) {
            return ResultadoBackfill.erro(pdfBytes, "não é PDF");
        }
        if (!enabled) {
            return ResultadoBackfill.semMudanca(pdfBytes, 0);
        }
        ModoOcr modo = redoOcr ? ModoOcr.REDO_OCR : ModoOcr.SKIP_TEXT;
        try {
            byte[] pesquisavel = executarOcrmypdf(pdfBytes, modo);
            int paginasOcr = contarPaginasProcessadas(pdfBytes, pesquisavel, modo);
            String textoPos = PdfTextoExtracaoUtil.extrairTexto(pesquisavel);
            if (paginasOcr >= 1) {
                PdfTextoExtracaoUtil.ValidacaoPdfSaida validacao =
                        PdfTextoExtracaoUtil.validarPdfSaida(pdfBytes, pesquisavel, modo == ModoOcr.REDO_OCR,
                                minCaracteres);
                if (!validacao.aceito()) {
                    log.warn("OCR backfill ({}): saída rejeitada, mantendo original — {}", modo,
                            validacao.motivoRejeicao());
                    return ResultadoBackfill.rejeitadoValidacao(pdfBytes, paginasOcr, validacao.motivoRejeicao());
                }
                log.info("OCR backfill ({}): {} página(s) processada(s)", modo, paginasOcr);
                return new ResultadoBackfill(pesquisavel, paginasOcr, textoPos, null, null);
            }
            return ResultadoBackfill.semMudanca(pdfBytes, 0);
        } catch (Exception e) {
            log.warn("Falha OCR backfill {} (ocrmypdf): {}", modo, e.getMessage());
            return ResultadoBackfill.erro(pdfBytes, e.getMessage());
        }
    }

    private ResultadoOcr aplicarOcr(byte[] pdfBytes, ModoOcr modo) {
        if (!enabled) {
            log.debug("OCR desabilitado (vilareal.ocr.enabled=false)");
            String texto = PdfTextoExtracaoUtil.extrairTexto(pdfBytes);
            return ResultadoOcr.semOcr(pdfBytes, texto);
        }
        try {
            byte[] pesquisavel = executarOcrmypdf(pdfBytes, modo);
            int paginasOcr = contarPaginasProcessadas(pdfBytes, pesquisavel, modo);
            String textoPos = PdfTextoExtracaoUtil.extrairTexto(pesquisavel);
            if (paginasOcr >= 1) {
                PdfTextoExtracaoUtil.ValidacaoPdfSaida validacao =
                        PdfTextoExtracaoUtil.validarPdfSaida(pdfBytes, pesquisavel, false, minCaracteres);
                if (!validacao.aceito()) {
                    log.warn("OCR ({}): saída rejeitada, mantendo original — {}", modo,
                            validacao.motivoRejeicao());
                    String textoOriginal = PdfTextoExtracaoUtil.extrairTexto(pdfBytes);
                    return ResultadoOcr.rejeitadoValidacao(pdfBytes, textoOriginal, validacao.motivoRejeicao());
                }
                log.info("OCR ({}) aplicado em {} página(s)", modo, paginasOcr);
                return new ResultadoOcr(pesquisavel, textoPos, true, false, null);
            }
            log.debug("ocrmypdf {} não processou nenhuma página", modo);
            return ResultadoOcr.semOcr(pdfBytes, textoPos);
        } catch (Exception e) {
            log.warn("Falha OCR {} (ocrmypdf): {}", modo, e.getMessage());
            String texto = PdfTextoExtracaoUtil.extrairTexto(pdfBytes);
            return ResultadoOcr.falha(pdfBytes, texto, e.getMessage());
        }
    }

    private static int contarPaginasProcessadas(byte[] pdfAntes, byte[] pdfDepois, ModoOcr modo) {
        if (modo == ModoOcr.REDO_OCR) {
            int alteradas = PdfTextoExtracaoUtil.contarPaginasComTextoAlterado(pdfAntes, pdfDepois);
            if (alteradas == 0 && !java.util.Arrays.equals(pdfAntes, pdfDepois)) {
                return 1;
            }
            return alteradas;
        }
        return PdfTextoExtracaoUtil.contarPaginasComOcrAdicionado(pdfAntes, pdfDepois);
    }

    /** Nunca {@code --force-ocr}. Flags incompatíveis com {@code --redo-ocr} ficam fora do modo REDO. */
    private byte[] executarOcrmypdf(byte[] pdfBytes, ModoOcr modo) throws Exception {
        Path input = Files.createTempFile("vilareal-ocr-in-", ".pdf");
        Path output = Files.createTempFile("vilareal-ocr-out-", ".pdf");
        try {
            Files.write(input, pdfBytes);
            List<String> cmd = new ArrayList<>();
            cmd.add(ocrmypdfCommand);
            cmd.add("--language");
            cmd.add(language);
            adicionarFlagsOcrmypdf(cmd, modo);
            cmd.add("--optimize");
            cmd.add("0");
            cmd.add(input.toString());
            cmd.add(output.toString());

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Process process = pb.start();
            StringBuilder saida = new StringBuilder();
            try (BufferedReader reader = new BufferedReader(
                    new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
                String linha;
                while ((linha = reader.readLine()) != null) {
                    saida.append(linha).append('\n');
                }
            }
            boolean terminou = process.waitFor(timeoutSeconds, TimeUnit.SECONDS);
            if (!terminou) {
                process.destroyForcibly();
                throw new IllegalStateException(
                        "ocrmypdf excedeu timeout de " + timeoutSeconds + "s");
            }
            int exit = process.exitValue();
            if (exit != 0) {
                throw new IllegalStateException(
                        "ocrmypdf exit=" + exit + " — " + saida.toString().trim());
            }
            if (!Files.isRegularFile(output) || Files.size(output) == 0) {
                throw new IllegalStateException("ocrmypdf não gerou PDF de saída");
            }
            return Files.readAllBytes(output);
        } finally {
            Files.deleteIfExists(input);
            Files.deleteIfExists(output);
        }
    }

    private static void adicionarFlagsOcrmypdf(List<String> cmd, ModoOcr modo) {
        if (modo == ModoOcr.REDO_OCR) {
            cmd.add("--redo-ocr");
            cmd.add("--clean");
            cmd.add("--rotate-pages");
        } else {
            cmd.add("--skip-text");
            cmd.add("--deskew");
            cmd.add("--clean");
            cmd.add("--rotate-pages");
        }
    }

    private enum ModoOcr {
        SKIP_TEXT,
        REDO_OCR
    }

    public record ResultadoOcr(
            byte[] pdfPesquisavel,
            String textoExtraido,
            boolean ocrAplicado,
            boolean aindaVazioPosOcr,
            String erro) {

        static ResultadoOcr semOcr(byte[] pdf, String texto) {
            return new ResultadoOcr(pdf, texto, false, false, null);
        }

        static ResultadoOcr falha(byte[] pdf, String texto, String erro) {
            return new ResultadoOcr(pdf, texto, false, true, erro);
        }

        static ResultadoOcr rejeitadoValidacao(byte[] pdf, String texto, String motivo) {
            return new ResultadoOcr(pdf, texto, false, false, motivo);
        }
    }

    public record ResultadoBackfill(
            byte[] pdfPesquisavel,
            int paginasOcr,
            String textoExtraido,
            String erro,
            String avisoValidacao) {

        public boolean deveRegravar() {
            return erro == null && avisoValidacao == null && paginasOcr >= 1;
        }

        static ResultadoBackfill semMudanca(byte[] pdf, int paginasOcr) {
            return new ResultadoBackfill(pdf, paginasOcr, PdfTextoExtracaoUtil.extrairTexto(pdf), null, null);
        }

        static ResultadoBackfill rejeitadoValidacao(byte[] pdf, int paginasOcr, String aviso) {
            return new ResultadoBackfill(pdf, paginasOcr, PdfTextoExtracaoUtil.extrairTexto(pdf), null, aviso);
        }

        static ResultadoBackfill erro(byte[] pdf, String erro) {
            return new ResultadoBackfill(pdf, 0, PdfTextoExtracaoUtil.extrairTexto(pdf), erro, null);
        }
    }
}
