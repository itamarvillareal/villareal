package br.com.vilareal.importacao;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.importacao.dto.ImportacaoInformacoesProcessosResponse;
import br.com.vilareal.importacao.dto.ImportacaoLinhaDetalhe;
import br.com.vilareal.importacao.dto.ImportacaoLinhaStatus;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
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
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
/**
 * Planilha «Dados complementares processos»: A=código cliente, B=proc., C–L cabeçalho (linha 1 cabeçalho).
 * Não altera {@code processo_parte}.
 */
@Service
public class ComplementaresProcessosImportService {

    private static final Logger log = LoggerFactory.getLogger(ComplementaresProcessosImportService.class);

    private final PessoaRepository pessoaRepository;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final ComplementaresProcessosImportRowMerger rowMerger;

    @Value("${vilareal.import.complementares-processos.path:}")
    private String configuredPath;

    public ComplementaresProcessosImportService(
            PessoaRepository pessoaRepository,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            ComplementaresProcessosImportRowMerger rowMerger) {
        this.pessoaRepository = pessoaRepository;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.rowMerger = rowMerger;
    }

    public ImportacaoInformacoesProcessosResponse importarDeArquivo(Path pathOverride) {
        Path path = pathOverride != null ? pathOverride : resolverPathPadrao();
        if (!Files.isRegularFile(path)) {
            throw new BusinessRuleException("Arquivo não encontrado: " + path.toAbsolutePath());
        }

        ImportacaoInformacoesProcessosResponse resp = new ImportacaoInformacoesProcessosResponse();
        resp.setArquivo(path.toAbsolutePath().toString());

        try (InputStream in = Files.newInputStream(path);
                Workbook workbook = WorkbookFactory.create(in)) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                throw new BusinessRuleException("Planilha sem abas.");
            }

            int lastRowIdx = sheet.getLastRowNum();
            resp.setTotalLinhasCorpo(Math.max(0, lastRowIdx));

            int ok = 0;
            int erros = 0;

            for (int rowNum = 1; rowNum <= lastRowIdx; rowNum++) {
                Row row = sheet.getRow(rowNum);
                String colA = PlanilhaExcelUtil.cellString(row, 0);
                if (!StringUtils.hasText(colA)) {
                    log.info(
                            "[import-complementares-processos] fim na linha Excel {} (col. A vazia; lastRow={})",
                            rowNum + 1,
                            lastRowIdx + 1);
                    break;
                }
                int linhaExcel = rowNum + 1;
                try {
                    String colB = PlanilhaExcelUtil.cellString(row, 1);
                    if (!StringUtils.hasText(colB)) {
                        throw new IllegalArgumentException("Coluna B (Proc.) obrigatória.");
                    }
                    long clienteId = clienteCodigoPessoaResolver.resolverPessoaId(colA);
                    if (!pessoaRepository.existsById(clienteId)) {
                        throw new IllegalArgumentException("Cliente não encontrado para o código da coluna A: " + colA);
                    }
                    int numeroInterno = parseInteiroPositivo(colB, "B (Proc.)");

                    ComplementaresProcessosImportRowMerger.LinhaParsed linha = parseLinha(row);
                    ComplementaresProcessosImportRowMerger.MergeResult res =
                            rowMerger.aplicar(clienteId, numeroInterno, linhaExcel, linha);

                    ok++;
                    ImportacaoLinhaDetalhe d = new ImportacaoLinhaDetalhe();
                    d.setLinhaExcel(linhaExcel);
                    d.setStatus(ImportacaoLinhaStatus.SUCESSO);
                    d.setMensagem((res.criado() ? "Processo criado" : "Processo atualizado") + " id=" + res.processoId());
                    d.setClientePessoaId(clienteId);
                    d.setNumeroInterno(numeroInterno);
                    resp.getDetalhes().add(d);
                } catch (Exception e) {
                    erros++;
                    log.warn("[import-complementares-processos] linha={} ERRO: {}", linhaExcel, e.getMessage());
                    ImportacaoLinhaDetalhe d = new ImportacaoLinhaDetalhe();
                    d.setLinhaExcel(linhaExcel);
                    d.setStatus(ImportacaoLinhaStatus.ERRO);
                    d.setMensagem(e.getMessage());
                    resp.getDetalhes().add(d);
                }
            }

            resp.setLinhasIgnoradas(0);
            resp.setLinhasProcessadasComSucesso(ok);
            resp.setLinhasComErro(erros);
            log.info("[import-complementares-processos] ficheiro={} ok={} erros={}", path, ok, erros);
            return resp;
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            log.error("[import-complementares-processos] falha ao ler planilha", e);
            throw new BusinessRuleException("Falha ao ler planilha: " + e.getMessage());
        }
    }

    public Path resolverPathPadrao() {
        if (StringUtils.hasText(configuredPath)) {
            return Paths.get(configuredPath.trim());
        }
        String home = System.getProperty("user.home");
        return Paths.get(home, "Dropbox", "COMUM", "Dados Complentares Processos.xlsx");
    }

    private static ComplementaresProcessosImportRowMerger.LinhaParsed parseLinha(Row row) {
        String c = trimToNull(PlanilhaExcelUtil.cellString(row, 2));
        String d = trimToNull(PlanilhaExcelUtil.cellString(row, 3));
        String e = trimToNull(PlanilhaExcelUtil.cellString(row, 4));
        String f = trimToNull(PlanilhaExcelUtil.cellString(row, 5));
        LocalDate g = ComplementaresProcessosPlanilhaUtil.parseDataCelulaOpcional(row, 6);
        String h = trimToNull(PlanilhaExcelUtil.cellString(row, 7));
        String i = trimToNull(PlanilhaExcelUtil.cellString(row, 8));
        BigDecimal j = ImoveisPlanilhaImportSupport.parseValorRealBr(PlanilhaExcelUtil.cellString(row, 9));
        String obsFase = trimToNull(PlanilhaExcelUtil.cellString(row, 10));
        LocalDate l = ComplementaresProcessosPlanilhaUtil.parseDataCelulaOpcional(row, 11);

        return new ComplementaresProcessosImportRowMerger.LinhaParsed(
                c, d, e, f, g, h, i, j, obsFase, l);
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }

    private static int parseInteiroPositivo(String s, String nomeColuna) {
        try {
            int n = Integer.parseInt(s.trim().replaceFirst("^0+(?!$)", ""));
            if (n < 1) {
                throw new IllegalArgumentException("Coluna " + nomeColuna + " deve ser inteiro ≥ 1.");
            }
            return n;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException("Coluna " + nomeColuna + " inválida: " + s);
        }
    }
}
