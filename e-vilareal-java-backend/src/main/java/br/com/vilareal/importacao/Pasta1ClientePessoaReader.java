package br.com.vilareal.importacao;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaItemResponse;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaListaResponse;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Lê planilhas no formato «Pasta1»: <strong>coluna A</strong> (índice 0) = identificador do cliente
 * (texto ou número como no Excel); <strong>coluna B</strong> (índice 1) = número da pessoa.
 *
 * <p>Regra de fim: para na primeira linha em que a coluna A estiver vazia (após trim). Os dados
 * podem começar na linha 1 do Excel (índice 0); se a primeira linha parecer cabeçalho textual
 * («Cliente», «Pessoa», etc.), é ignorada.
 */
@Service
public class Pasta1ClientePessoaReader {

    private static final int COL_CLIENTE = 0;
    private static final int COL_PESSOA_ID = 1;

    public Pasta1ClientePessoaListaResponse lerArquivo(Path path) {
        if (!Files.isRegularFile(path)) {
            throw new BusinessRuleException("Arquivo não encontrado: " + path.toAbsolutePath());
        }
        try (InputStream in = Files.newInputStream(path);
                Workbook workbook = WorkbookFactory.create(in)) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                throw new BusinessRuleException("Planilha sem abas.");
            }
            return lerSheet(sheet, path.toAbsolutePath().toString());
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessRuleException("Falha ao ler planilha: " + e.getMessage());
        }
    }

    Pasta1ClientePessoaListaResponse lerSheet(Sheet sheet, String arquivoParaResposta) {
        Pasta1ClientePessoaListaResponse resp = new Pasta1ClientePessoaListaResponse();
        resp.setArquivo(arquivoParaResposta);
        int last = sheet.getLastRowNum();
        int lidas = 0;
        for (int rowNum = 0; rowNum <= last; rowNum++) {
            Row row = sheet.getRow(rowNum);
            String colA = PlanilhaExcelUtil.cellString(row, COL_CLIENTE);
            if (!StringUtils.hasText(colA)) {
                break;
            }
            if (rowNum == 0 && pareceCabecalho(colA)) {
                continue;
            }
            String colB = PlanilhaExcelUtil.cellString(row, COL_PESSOA_ID);
            int linhaExcel = rowNum + 1;
            Pasta1ClientePessoaItemResponse item = new Pasta1ClientePessoaItemResponse();
            item.setLinhaExcel(linhaExcel);
            item.setClienteColunaA(colA.trim());
            Long pid = parsePessoaIdOpcional(colB);
            item.setPessoaId(pid);
            if (pid == null && StringUtils.hasText(colB)) {
                item.setAviso("Coluna B não é um número de pessoa válido: " + colB.trim());
            } else if (pid == null) {
                item.setAviso("Coluna B vazia");
            }
            resp.getItens().add(item);
            lidas++;
        }
        resp.setTotalLinhasLidas(lidas);
        return resp;
    }

    private static boolean pareceCabecalho(String colA) {
        String t = colA.trim().toLowerCase();
        return t.contains("cliente")
                || t.contains("pessoa")
                || t.contains("código")
                || t.equals("a")
                || t.equals("id");
    }

    private static Long parsePessoaIdOpcional(String colB) {
        if (!StringUtils.hasText(colB)) {
            return null;
        }
        String s = colB.trim().replaceFirst("^0+(?!$)", "");
        try {
            long n = Long.parseLong(s);
            return n > 0 ? n : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
