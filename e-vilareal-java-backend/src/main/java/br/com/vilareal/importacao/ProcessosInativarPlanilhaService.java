package br.com.vilareal.importacao;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.importacao.dto.ImportacaoInativarProcessosLinhaDetalhe;
import br.com.vilareal.importacao.dto.ImportacaoInativarProcessosResponse;
import br.com.vilareal.importacao.dto.InativacaoProcessoLinhaStatus;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@Service
public class ProcessosInativarPlanilhaService {

    private static final Logger log = LoggerFactory.getLogger(ProcessosInativarPlanilhaService.class);

    private final ProcessosInativarPlanilhaRowApplier rowApplier;

    @Value("${vilareal.import.processos-inativar.path:}")
    private String configuredPath;

    public ProcessosInativarPlanilhaService(ProcessosInativarPlanilhaRowApplier rowApplier) {
        this.rowApplier = rowApplier;
    }

    public Path resolverPathPadrao() {
        if (StringUtils.hasText(configuredPath)) {
            return Paths.get(configuredPath.trim());
        }
        return Paths.get(System.getProperty("user.home"), "Documents", "inativos.xls");
    }

    public ImportacaoInativarProcessosResponse importarDeArquivo(Path pathOverride, int primeiraLinhaDados) {
        Path path = pathOverride != null ? pathOverride : resolverPathPadrao();
        if (!Files.isRegularFile(path)) {
            throw new BusinessRuleException("Arquivo não encontrado: " + path.toAbsolutePath());
        }
        if (primeiraLinhaDados < 0) {
            throw new BusinessRuleException("primeiraLinhaDados deve ser ≥ 0 (índice 0-based da planilha).");
        }

        ImportacaoInativarProcessosResponse resp = new ImportacaoInativarProcessosResponse();
        resp.setArquivo(path.toAbsolutePath().toString());

        try (InputStream in = Files.newInputStream(path);
                Workbook workbook = WorkbookFactory.create(in)) {
            return processarWorkbook(workbook, resp, primeiraLinhaDados);
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            log.error("[import-processos-inativar] falha ao ler planilha", e);
            throw new BusinessRuleException("Falha ao ler planilha: " + e.getMessage());
        }
    }

    public ImportacaoInativarProcessosResponse importarDeInputStream(InputStream in, String nomeArquivo, int primeiraLinhaDados) {
        if (primeiraLinhaDados < 0) {
            throw new BusinessRuleException("primeiraLinhaDados deve ser ≥ 0 (índice 0-based da planilha).");
        }
        ImportacaoInativarProcessosResponse resp = new ImportacaoInativarProcessosResponse();
        resp.setArquivo(nomeArquivo != null ? nomeArquivo : "(upload)");

        try (Workbook workbook = WorkbookFactory.create(in)) {
            return processarWorkbook(workbook, resp, primeiraLinhaDados);
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            log.error("[import-processos-inativar] falha ao ler upload", e);
            throw new BusinessRuleException("Falha ao ler planilha: " + e.getMessage());
        }
    }

    private ImportacaoInativarProcessosResponse processarWorkbook(
            Workbook workbook, ImportacaoInativarProcessosResponse resp, int primeiraLinhaDados) {
        Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
        if (sheet == null) {
            throw new BusinessRuleException("Planilha sem abas.");
        }

        int lastRowIdx = sheet.getLastRowNum();
        resp.setTotalLinhasCorpo(Math.max(0, lastRowIdx));

        int inativados = 0;
        int naoEncontrados = 0;
        int erros = 0;

        for (int rowNum = primeiraLinhaDados; rowNum <= lastRowIdx; rowNum++) {
            Row row = sheet.getRow(rowNum);
            String colA = PlanilhaExcelUtil.cellString(row, 0);
            if (!StringUtils.hasText(colA)) {
                log.info(
                        "[import-processos-inativar] encerrado na linha Excel {} (coluna A vazia; último índice folha={})",
                        rowNum + 1,
                        lastRowIdx + 1);
                break;
            }
            int linhaExcel = rowNum + 1;
            ImportacaoInativarProcessosLinhaDetalhe d = new ImportacaoInativarProcessosLinhaDetalhe();
            d.setLinhaExcel(linhaExcel);
            d.setCodigoCliente(colA.trim());

            try {
                String colB = PlanilhaExcelUtil.cellString(row, 1);
                if (!StringUtils.hasText(colB)) {
                    throw new IllegalArgumentException("Coluna B (Proc.) é obrigatória.");
                }
                int proc = parseNumeroInternoProc(colB);
                d.setNumeroInterno(proc);

                ProcessosInativarPlanilhaRowApplier.Resultado r = rowApplier.aplicar(colA.trim(), proc);
                if (r.inativado()) {
                    inativados++;
                    d.setStatus(InativacaoProcessoLinhaStatus.INATIVADO);
                    d.setProcessoId(r.processoId());
                    d.setMensagem("Processo inativado id=" + r.processoId());
                    log.info(
                            "[import-processos-inativar] linha={} cliente={} proc={} id={}",
                            linhaExcel,
                            colA.trim(),
                            proc,
                            r.processoId());
                } else {
                    naoEncontrados++;
                    d.setStatus(InativacaoProcessoLinhaStatus.NAO_ENCONTRADO);
                    d.setMensagem("Processo não encontrado para cliente/proc.");
                }
            } catch (Exception e) {
                erros++;
                log.warn("[import-processos-inativar] linha={} ERRO: {}", linhaExcel, e.getMessage());
                d.setStatus(InativacaoProcessoLinhaStatus.ERRO);
                d.setMensagem(e.getMessage());
            }
            resp.getDetalhes().add(d);
        }

        resp.setInativados(inativados);
        resp.setNaoEncontrados(naoEncontrados);
        resp.setLinhasComErro(erros);
        log.info("[import-processos-inativar] ficheiro={} inativados={} naoEncontrados={} erros={}", resp.getArquivo(), inativados, naoEncontrados, erros);
        return resp;
    }

    private static int parseNumeroInternoProc(String s) {
        String t = s.trim();
        if (!StringUtils.hasText(t)) {
            throw new IllegalArgumentException("Coluna B (Proc.) vazia.");
        }
        try {
            if (t.contains(".") || t.contains(",")) {
                double d = Double.parseDouble(t.replace(',', '.'));
                if (d < 1.0 || d != Math.floor(d)) {
                    throw new IllegalArgumentException("Coluna B (Proc.) deve ser inteiro ≥ 1: " + s);
                }
                return (int) d;
            }
            int n = Integer.parseInt(t.replaceFirst("^0+(?!$)", ""));
            if (n < 1) {
                throw new IllegalArgumentException("Coluna B (Proc.) deve ser inteiro ≥ 1.");
            }
            return n;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Coluna B (Proc.) inválida: " + s);
        }
    }
}
