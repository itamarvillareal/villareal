package br.com.vilareal.processo.application.rag;

import br.com.vilareal.documento.GoogleDriveService;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.concurrent.TimeUnit;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Indexação RAG incremental: após upload PROJUDI → Drive, baixa o PDF e chama
 * {@code python3 -m processo_rag indexar-arquivo} com idempotência por {@code fonte_id}.
 */
@Service
@EnableConfigurationProperties(RagIndexacaoProperties.class)
public class RagIndexacaoService {

    private static final Logger log = LoggerFactory.getLogger(RagIndexacaoService.class);
    private static final Pattern DATA_BR =
            Pattern.compile("(\\d{2})/(\\d{2})/(\\d{4})");

    private final RagIndexacaoProperties properties;
    private final GoogleDriveService googleDriveService;

    public RagIndexacaoService(RagIndexacaoProperties properties, GoogleDriveService googleDriveService) {
        this.properties = properties;
        this.googleDriveService = googleDriveService;
    }

    /** Dispara indexação em background (não bloqueia o robô PROJUDI). */
    @Async("ragIndexacaoTaskExecutor")
    public void indexarArquivosNovos(String numeroCnj, List<RagArquivoDriveEnviado> arquivos) {
        if (!properties.isEnabled()) {
            return;
        }
        if (!StringUtils.hasText(numeroCnj) || arquivos == null || arquivos.isEmpty()) {
            return;
        }
        for (RagArquivoDriveEnviado arquivo : arquivos) {
            indexarUm(numeroCnj.trim(), arquivo);
        }
    }

    void indexarUm(String numeroCnj, RagArquivoDriveEnviado arquivo) {
        if (arquivo == null || !StringUtils.hasText(arquivo.driveFileId())) {
            return;
        }
        if (!googleDriveService.isConfigurado()) {
            log.warn("RAG: Drive não configurado; indexação ignorada (cnj={}, fonte={})",
                    numeroCnj, arquivo.fonteId());
            return;
        }

        Path pdfTemp = null;
        try {
            byte[] bytes = googleDriveService.baixarBytesArquivo(arquivo.driveFileId());
            if (bytes == null || bytes.length == 0) {
                log.warn("RAG: PDF vazio no Drive (cnj={}, fileId={})", numeroCnj, arquivo.driveFileId());
                return;
            }
            pdfTemp = Files.createTempFile("vilareal-rag-", ".pdf");
            Files.write(pdfTemp, bytes);

            List<String> cmd = montarComando(
                    numeroCnj,
                    pdfTemp,
                    arquivo.tipoPeca(),
                    arquivo.driveFileId(),
                    arquivo.dataMov());

            ProcessBuilder pb = new ProcessBuilder(cmd);
            pb.redirectErrorStream(true);
            Path scriptsDir = resolverScriptsDir();
            pb.directory(scriptsDir.toFile());

            Process proc = pb.start();
            String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
            boolean finished = proc.waitFor(properties.getTimeoutSegundos(), TimeUnit.SECONDS);
            if (!finished) {
                proc.destroyForcibly();
                log.error(
                        "RAG: timeout {}s (cnj={}, fonte={})",
                        properties.getTimeoutSegundos(),
                        numeroCnj,
                        arquivo.fonteId());
                return;
            }
            int code = proc.exitValue();
            if (code != 0) {
                log.error(
                        "RAG: indexação falhou exit {} (cnj={}, fonte={}): {}",
                        code,
                        numeroCnj,
                        arquivo.fonteId(),
                        out);
                return;
            }
            log.info(
                    "RAG: indexado cnj={} fonte={} tipo={} ({})",
                    numeroCnj,
                    arquivo.fonteId(),
                    arquivo.tipoPeca(),
                    out.isEmpty() ? "ok" : out);
        } catch (Exception e) {
            log.warn(
                    "RAG: falha ao indexar cnj={} fonte={}: {}",
                    numeroCnj,
                    arquivo.fonteId(),
                    e.getMessage());
        } finally {
            if (pdfTemp != null) {
                try {
                    Files.deleteIfExists(pdfTemp);
                } catch (IOException ignored) {
                    // best effort
                }
            }
        }
    }

    List<String> montarComando(
            String numeroCnj, Path pdf, String tipoPeca, String driveFileId, String dataMovIso) {
        List<String> cmd = new ArrayList<>();
        cmd.add(properties.getPython());
        cmd.add("-m");
        cmd.add("processo_rag");
        cmd.add("indexar-arquivo");
        cmd.add(numeroCnj);
        cmd.add(pdf.toAbsolutePath().toString());
        cmd.add("--tipo");
        cmd.add(StringUtils.hasText(tipoPeca) ? tipoPeca.trim() : "outros");
        cmd.add("--drive-file-id");
        cmd.add(driveFileId.trim());
        if (StringUtils.hasText(dataMovIso)) {
            cmd.add("--data-mov");
            cmd.add(dataMovIso.trim());
        }
        return cmd;
    }

    Path resolverScriptsDir() {
        String env = System.getenv("VILAREAL_PROCESSO_RAG_SCRIPTS_DIR");
        if (StringUtils.hasText(env)) {
            return Path.of(env.trim()).toAbsolutePath().normalize();
        }
        if (StringUtils.hasText(properties.getScriptsDir())) {
            return Path.of(properties.getScriptsDir().trim()).toAbsolutePath().normalize();
        }
        Path cwd = Path.of("").toAbsolutePath();
        for (Path base : List.of(cwd, cwd.getParent(), cwd.resolve("e-vilareal-java-backend"))) {
            Path scripts = base.resolve("scripts");
            if (Files.isDirectory(scripts.resolve("processo_rag"))) {
                return scripts.toAbsolutePath().normalize();
            }
        }
        throw new IllegalStateException(
                "Pasta scripts/processo_rag não encontrada. Defina vilareal.rag.indexacao.scripts-dir "
                        + "ou VILAREAL_PROCESSO_RAG_SCRIPTS_DIR.");
    }

    /** Converte data/hora PROJUDI (dd/MM/yyyy ...) para ISO yyyy-MM-dd. */
    public static String extrairDataMovIso(String dataHoraProjudi) {
        if (!StringUtils.hasText(dataHoraProjudi)) {
            return null;
        }
        String parte = dataHoraProjudi.trim().split("\\s+")[0];
        Matcher m = DATA_BR.matcher(parte);
        if (!m.matches()) {
            return null;
        }
        return m.group(3) + "-" + m.group(2) + "-" + m.group(1);
    }

    /** Normaliza tipo de peça para chunking (minúsculas, sem acentos extras). */
    public static String normalizarTipoPeca(String tipo) {
        if (!StringUtils.hasText(tipo)) {
            return "outros";
        }
        return tipo.trim().toLowerCase(Locale.ROOT);
    }
}
