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
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;

@Service
public class ImportClientesPlanilhaService {

    private static final Logger log = LoggerFactory.getLogger(ImportClientesPlanilhaService.class);

    /** A–R (índices 0..17); coluna S ignorada. */
    private static final int COL_ATE_INCLUSIVE = 17;

    private final PessoaRepository pessoaRepository;
    private final InformacoesProcessosImportRowApplier rowApplier;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final Pasta1ClientePessoaImportService pasta1ClientePessoaImportService;

    @Value("${vilareal.import.clientes-planilha.path:}")
    private String configuredPath;

    public ImportClientesPlanilhaService(
            PessoaRepository pessoaRepository,
            InformacoesProcessosImportRowApplier rowApplier,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            Pasta1ClientePessoaImportService pasta1ClientePessoaImportService) {
        this.pessoaRepository = pessoaRepository;
        this.rowApplier = rowApplier;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.pasta1ClientePessoaImportService = pasta1ClientePessoaImportService;
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
                            "[import-clientes-planilha] encerrado na linha Excel {} (coluna A vazia; último índice folha={})",
                            rowNum + 1,
                            lastRowIdx + 1);
                    break;
                }
                int linhaExcel = rowNum + 1;
                try {
                    DadosImportacaoLinha dados = parseLinha(row, linhaExcel);
                    InformacoesProcessosImportRowApplier.ResultadoAplicacao res = rowApplier.aplicar(dados);
                    ok++;
                    ImportacaoLinhaDetalhe d = new ImportacaoLinhaDetalhe();
                    d.setLinhaExcel(linhaExcel);
                    d.setStatus(ImportacaoLinhaStatus.SUCESSO);
                    d.setMensagem(
                            (res.processoCriado() ? "Processo criado" : "Processo atualizado") + " id=" + res.processoId());
                    d.setClientePessoaId(dados.clientePessoaId());
                    d.setNumeroInterno(dados.numeroInterno());
                    d.setAutoresVinculados(res.autoresVinculados());
                    d.setReusVinculados(res.reusVinculados());
                    resp.getDetalhes().add(d);
                } catch (Exception e) {
                    erros++;
                    log.warn("[import-clientes-planilha] linha={} ERRO: {}", linhaExcel, e.getMessage());
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
            log.info("[import-clientes-planilha] ficheiro={} ok={} erros={}", path, ok, erros);
            return resp;
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            log.error("[import-clientes-planilha] falha ao ler planilha", e);
            throw new BusinessRuleException("Falha ao ler planilha: " + e.getMessage());
        }
    }

    public Path resolverPathPadrao() {
        if (StringUtils.hasText(configuredPath)) {
            return Paths.get(configuredPath.trim());
        }
        return Paths.get(System.getProperty("user.home"), "Documents", "import clientes.xlsx");
    }

    private DadosImportacaoLinha parseLinha(Row row, int linhaExcel) {
        String[] cel = new String[COL_ATE_INCLUSIVE + 1];
        for (int c = 0; c < cel.length; c++) {
            cel[c] = PlanilhaExcelUtil.cellString(row, c);
        }

        String colA = cel[0].trim();
        String colB = cel[1];
        String colC = cel[2];
        String colK = cel[10];
        String colL = cel[11];
        String colQ = cel[16];
        String colR = cel[17];

        if (!StringUtils.hasText(colK)) {
            throw new IllegalArgumentException(
                    "Coluna K (Proc.) obrigatória quando a linha tem dados (linha " + linhaExcel + ").");
        }

        long pessoaIdPlanilha = parseLongPessoa(colB, "B (pessoa)", linhaExcel);
        pasta1ClientePessoaImportService.upsertMapeamentoClientePasta1(colA, pessoaIdPlanilha);

        long clientePessoaId = clienteCodigoPessoaResolver.resolverPessoaIdAposMapeamentoChaveExacta(colA);
        if (clientePessoaId != pessoaIdPlanilha) {
            throw new IllegalArgumentException(
                    "Inconsistência A/B: coluna B (pessoa "
                            + pessoaIdPlanilha
                            + ") difere do mapeamento resolvido para A=\""
                            + colA
                            + "\" ("
                            + clientePessoaId
                            + "). Linha "
                            + linhaExcel);
        }
        if (!pessoaRepository.existsById(clientePessoaId)) {
            throw new IllegalArgumentException("Pessoa cliente não encontrada: id=" + clientePessoaId);
        }

        int numeroInterno = parseInteiroPositivo(colK, "K (Proc.)", linhaExcel);

        Optional<String> faseOpt;
        if (!StringUtils.hasText(colL)) {
            faseOpt = Optional.empty();
        } else {
            try {
                faseOpt = FasePlanilhaNormalizer.normalizarOuVazio(colL);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException(
                        "Linha " + linhaExcel + ": fase inválida (coluna L): " + ex.getMessage());
            }
        }

        boolean ativo = parseAtivoColunaC(colC, linhaExcel);

        List<DadosImportacaoLinha.ParteSlot> partes = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            int colIdx = 3 + i;
            String s = cel[colIdx];
            if (!StringUtils.hasText(s)) {
                continue;
            }
            long pid = parseLongPessoa(s, "Autor coluna " + (char) ('D' + i), linhaExcel);
            if (!pessoaRepository.existsById(pid)) {
                throw new IllegalArgumentException("Pessoa não encontrada (autor): id=" + pid + " linha " + linhaExcel);
            }
            partes.add(new DadosImportacaoLinha.ParteSlot(InformacoesProcessosImportRowApplier.POLO_AUTOR, i + 1, pid));
        }
        int[][] reuCols = {{8, 1}, {9, 2}, {12, 3}, {13, 4}, {14, 5}, {15, 6}};
        for (int[] pair : reuCols) {
            String s = cel[pair[0]];
            if (!StringUtils.hasText(s)) {
                continue;
            }
            long pid = parseLongPessoa(s, "Réu coluna índice " + pair[0], linhaExcel);
            if (!pessoaRepository.existsById(pid)) {
                throw new IllegalArgumentException("Pessoa não encontrada (réu): id=" + pid + " linha " + linhaExcel);
            }
            partes.add(new DadosImportacaoLinha.ParteSlot(InformacoesProcessosImportRowApplier.POLO_REU, pair[1], pid));
        }

        return new DadosImportacaoLinha(
                linhaExcel,
                clientePessoaId,
                numeroInterno,
                faseOpt,
                StringUtils.hasText(colQ) ? colQ.trim() : null,
                StringUtils.hasText(colR) ? colR.trim() : null,
                partes,
                Optional.of(ativo),
                true);
    }

    private static boolean parseAtivoColunaC(String colC, int linhaExcel) {
        if (!StringUtils.hasText(colC)) {
            return true;
        }
        String t = colC.trim().toUpperCase(Locale.ROOT);
        if ("ATIVO".equals(t)) {
            return true;
        }
        if ("INATIVO".equals(t)) {
            return false;
        }
        throw new IllegalArgumentException(
                "Coluna C inválida na linha " + linhaExcel + ": \"" + colC + "\" (use ATIVO, INATIVO ou vazio).");
    }

    private static int parseInteiroPositivo(String s, String nomeColuna, int linhaExcel) {
        try {
            int n = Integer.parseInt(s.trim().replaceFirst("^0+(?!$)", ""));
            if (n < 1) {
                throw new IllegalArgumentException(
                        "Linha " + linhaExcel + ": coluna " + nomeColuna + " deve ser inteiro ≥ 1.");
            }
            return n;
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "Linha " + linhaExcel + ": coluna " + nomeColuna + " inválida: " + s);
        }
    }

    private static long parseLongPessoa(String s, String contexto, int linhaExcel) {
        try {
            return Long.parseLong(s.trim().replaceFirst("^0+(?!$)", ""));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(
                    "Linha " + linhaExcel + ": " + contexto + " — número inválido: " + s);
        }
    }
}
