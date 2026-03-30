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
import java.util.Optional;

@Service
public class InformacoesProcessosImportService {

    private static final Logger log = LoggerFactory.getLogger(InformacoesProcessosImportService.class);

    /** Última coluna lida na linha (O = índice 14): A–O, mesma regra para todas as linhas de dados. */
    private static final int COL_LEITURA_ATE_INCLUSIVE = 14;

    private final PessoaRepository pessoaRepository;
    private final InformacoesProcessosImportRowApplier rowApplier;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;

    @Value("${vilareal.import.informacoes-processos.path:}")
    private String configuredPath;

    public InformacoesProcessosImportService(
            PessoaRepository pessoaRepository,
            InformacoesProcessosImportRowApplier rowApplier,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver) {
        this.pessoaRepository = pessoaRepository;
        this.rowApplier = rowApplier;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
    }

    /**
     * Importa a partir do ficheiro local. {@code pathOverride} tem prioridade sobre a property.
     */
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

            // Linha 1 Excel (índice 0) = cabeçalho, não importa. Dados a partir da linha 2 (índice 1).
            // Percorre sequencialmente todas as linhas até à primeira com coluna A vazia — aí encerra (não salta «buracos» como ignoradas).
            for (int rowNum = 1; rowNum <= lastRowIdx; rowNum++) {
                Row row = sheet.getRow(rowNum);
                String colA = PlanilhaExcelUtil.cellString(row, 0);
                if (!StringUtils.hasText(colA)) {
                    log.info(
                            "[import-informacoes-processos] encerrado na linha Excel {} (coluna A vazia; último índice folha={})",
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
                    log.warn("[import-informacoes-processos] linha={} ERRO: {}", linhaExcel, e.getMessage());
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
            log.info("[import-informacoes-processos] ficheiro={} ok={} erros={}", path, ok, erros);
            return resp;
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            log.error("[import-informacoes-processos] falha ao ler planilha", e);
            throw new BusinessRuleException("Falha ao ler planilha: " + e.getMessage());
        }
    }

    public Path resolverPathPadrao() {
        if (StringUtils.hasText(configuredPath)) {
            return Paths.get(configuredPath.trim());
        }
        return Paths.get(System.getProperty("user.home"), "Documents", "Informacoes de processos.xls");
    }

    private DadosImportacaoLinha parseLinha(Row row, int linhaExcel) {
        // Lê sempre A–O (índices 0..14) com a mesma regra de célula para toda a linha.
        String[] cel = new String[COL_LEITURA_ATE_INCLUSIVE + 1];
        for (int c = 0; c < cel.length; c++) {
            cel[c] = PlanilhaExcelUtil.cellString(row, c);
        }

        String colA = cel[0];
        String colL = cel[11];
        if (!StringUtils.hasText(colA) || !StringUtils.hasText(colL)) {
            throw new IllegalArgumentException(
                    "Colunas A (cliente) e L (proc.) são obrigatórias quando a linha tem dados (linha " + linhaExcel + ").");
        }

        long clienteId = clienteCodigoPessoaResolver.resolverPessoaId(colA);
        if (!pessoaRepository.existsById(clienteId)) {
            throw new IllegalArgumentException("Cliente (pessoa) não encontrado para o código da coluna A: " + colA);
        }

        int numeroInterno = parseInteiroPositivo(colL, "L (Proc.)");

        String colM = cel[12];
        Optional<String> faseOpt;
        if (!StringUtils.hasText(colM)) {
            faseOpt = Optional.empty();
        } else {
            try {
                faseOpt = FasePlanilhaNormalizer.normalizarOuVazio(colM);
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException(ex.getMessage());
            }
        }

        String colN = cel[13];
        String colO = cel[14];

        List<DadosImportacaoLinha.ParteSlot> partes = new ArrayList<>();
        for (int i = 0; i < 5; i++) {
            String s = cel[1 + i];
            if (!StringUtils.hasText(s)) {
                continue;
            }
            long pid = parseLongPessoa(s, "Autor coluna " + (char) ('B' + i));
            if (!pessoaRepository.existsById(pid)) {
                throw new IllegalArgumentException("Pessoa não encontrada (autor): id=" + pid);
            }
            partes.add(new DadosImportacaoLinha.ParteSlot(InformacoesProcessosImportRowApplier.POLO_AUTOR, i + 1, pid));
        }
        for (int i = 0; i < 5; i++) {
            String s = cel[6 + i];
            if (!StringUtils.hasText(s)) {
                continue;
            }
            long pid = parseLongPessoa(s, "Réu coluna " + (char) ('G' + i));
            if (!pessoaRepository.existsById(pid)) {
                throw new IllegalArgumentException("Pessoa não encontrada (réu): id=" + pid);
            }
            partes.add(new DadosImportacaoLinha.ParteSlot(InformacoesProcessosImportRowApplier.POLO_REU, i + 1, pid));
        }

        return new DadosImportacaoLinha(
                linhaExcel,
                clienteId,
                numeroInterno,
                faseOpt,
                StringUtils.hasText(colN) ? colN.trim() : null,
                StringUtils.hasText(colO) ? colO.trim() : null,
                partes);
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

    private static long parseLongPessoa(String s, String contexto) {
        try {
            return Long.parseLong(s.trim().replaceFirst("^0+(?!$)", ""));
        } catch (NumberFormatException e) {
            throw new IllegalArgumentException(contexto + " — número inválido: " + s);
        }
    }
}
