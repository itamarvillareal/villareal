package br.com.vilareal.importacao.api;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.importacao.ComplementaresProcessosImportService;
import br.com.vilareal.importacao.ImportClientesPlanilhaService;
import br.com.vilareal.importacao.InformacoesProcessosImportService;
import br.com.vilareal.importacao.Pasta1ClientePessoaImportService;
import br.com.vilareal.importacao.Pasta1ClientePessoaReader;
import br.com.vilareal.importacao.ProcessosInativarPlanilhaService;
import br.com.vilareal.importacao.dto.ImportacaoInativarProcessosResponse;
import br.com.vilareal.importacao.dto.ImportacaoInformacoesProcessosResponse;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaListaResponse;
import br.com.vilareal.importacao.dto.Pasta1ClientePessoaPersistResponse;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.util.StringUtils;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;

@RestController
@RequestMapping("/api/import")
@Tag(name = "Importação", description = "Importação de planilhas (administrativo)")
public class ImportacaoController {

    private final InformacoesProcessosImportService informacoesProcessosImportService;
    private final ComplementaresProcessosImportService complementaresProcessosImportService;
    private final Pasta1ClientePessoaReader pasta1ClientePessoaReader;
    private final Pasta1ClientePessoaImportService pasta1ClientePessoaImportService;
    private final ImportClientesPlanilhaService importClientesPlanilhaService;
    private final ProcessosInativarPlanilhaService processosInativarPlanilhaService;

    @Value("${vilareal.import.pasta1-clientes.path:}")
    private String pasta1ConfiguredPath;

    public ImportacaoController(
            InformacoesProcessosImportService informacoesProcessosImportService,
            ComplementaresProcessosImportService complementaresProcessosImportService,
            Pasta1ClientePessoaReader pasta1ClientePessoaReader,
            Pasta1ClientePessoaImportService pasta1ClientePessoaImportService,
            ImportClientesPlanilhaService importClientesPlanilhaService,
            ProcessosInativarPlanilhaService processosInativarPlanilhaService) {
        this.informacoesProcessosImportService = informacoesProcessosImportService;
        this.complementaresProcessosImportService = complementaresProcessosImportService;
        this.pasta1ClientePessoaReader = pasta1ClientePessoaReader;
        this.pasta1ClientePessoaImportService = pasta1ClientePessoaImportService;
        this.importClientesPlanilhaService = importClientesPlanilhaService;
        this.processosInativarPlanilhaService = processosInativarPlanilhaService;
    }

    @PostMapping(value = "/informacoes-processos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importar planilha (multipart)", description = "Campo opcional `file`. Sem ficheiro, usa `path` ou a property ou ~/Documents/Informacoes de processos.xls")
    public ImportacaoInformacoesProcessosResponse importarMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "path", required = false) String pathParam) {
        if (file != null && !file.isEmpty()) {
            try {
                Path temp = Files.createTempFile("vilareal-import-processos-", ".xls");
                try {
                    file.transferTo(temp);
                    return informacoesProcessosImportService.importarDeArquivo(temp);
                } finally {
                    Files.deleteIfExists(temp);
                }
            } catch (IOException e) {
                throw new BusinessRuleException("Falha ao gravar ficheiro temporário: " + e.getMessage());
            }
        }
        if (StringUtils.hasText(pathParam)) {
            return informacoesProcessosImportService.importarDeArquivo(Path.of(pathParam.trim()));
        }
        return informacoesProcessosImportService.importarDeArquivo(null);
    }

    @PostMapping("/informacoes-processos")
    @Operation(summary = "Importar planilha (path opcional)", description = "Query `path` opcional; senão property `vilareal.import.informacoes-processos.path`; senão %USERPROFILE%/Documents/Informacoes de processos.xls")
    public ImportacaoInformacoesProcessosResponse importarPorPathOuPadrao(
            @RequestParam(value = "path", required = false) String pathParam) {
        if (StringUtils.hasText(pathParam)) {
            return informacoesProcessosImportService.importarDeArquivo(Path.of(pathParam.trim()));
        }
        return informacoesProcessosImportService.importarDeArquivo(null);
    }

    @PostMapping(value = "/complementares-processos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Importar dados complementares do processo (multipart)",
            description =
                    "Planilha: linha 1 cabeçalho; A=código cliente, B=proc., C=obs. processo, D=cidade, E=UF, F=competência, G=data protocolo, H=procedimento, I=responsável, J=valor causa, K=obs. fase, L=prazo fatal. "
                            + "Atualiza só o cabeçalho do processo (não apaga partes). Campo `file` opcional; sem ficheiro usa `path` ou `vilareal.import.complementares-processos.path`.")
    public ImportacaoInformacoesProcessosResponse importarComplementaresMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "path", required = false) String pathParam) {
        if (file != null && !file.isEmpty()) {
            try {
                String on = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
                String suf =
                        on.toLowerCase().endsWith(".xlsx")
                                ? ".xlsx"
                                : on.toLowerCase().endsWith(".xls") ? ".xls" : ".bin";
                Path temp = Files.createTempFile("vilareal-import-complementares-", suf);
                try {
                    file.transferTo(temp);
                    return complementaresProcessosImportService.importarDeArquivo(temp);
                } finally {
                    Files.deleteIfExists(temp);
                }
            } catch (IOException e) {
                throw new BusinessRuleException("Falha ao gravar ficheiro temporário: " + e.getMessage());
            }
        }
        if (StringUtils.hasText(pathParam)) {
            return complementaresProcessosImportService.importarDeArquivo(Path.of(pathParam.trim()));
        }
        return complementaresProcessosImportService.importarDeArquivo(null);
    }

    @PostMapping("/complementares-processos")
    @Operation(
            summary = "Importar dados complementares do processo (path)",
            description =
                    "Query `path` opcional; senão `vilareal.import.complementares-processos.path`; senão ~/Dropbox/COMUM/Dados Complentares Processos.xlsx")
    public ImportacaoInformacoesProcessosResponse importarComplementaresPorPath(
            @RequestParam(value = "path", required = false) String pathParam) {
        if (StringUtils.hasText(pathParam)) {
            return complementaresProcessosImportService.importarDeArquivo(Path.of(pathParam.trim()));
        }
        return complementaresProcessosImportService.importarDeArquivo(null);
    }

    @PostMapping(value = "/processos-inativar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Inativar processos (multipart)",
            description =
                    "Planilha: col. A código cliente, col. B n.º interno (proc.). Campo `file` opcional; sem ficheiro usa `path` ou property ou ~/Documents/inativos.xls. "
                            + "Query `primeiraLinhaDados` = índice 0-based da primeira linha de dados (default 1 = dados a partir da linha 2 do Excel, após cabeçalho).")
    public ImportacaoInativarProcessosResponse importarProcessosInativarMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "path", required = false) String pathParam,
            @RequestParam(value = "primeiraLinhaDados", required = false, defaultValue = "1") int primeiraLinhaDados) {
        return executarImportacaoProcessosInativar(file, pathParam, primeiraLinhaDados);
    }

    @PostMapping("/processos-inativar")
    @Operation(
            summary = "Inativar processos (path ou ficheiro padrão)",
            description =
                    "Query `path` opcional; senão `vilareal.import.processos-inativar.path`; senão %USERPROFILE%/Documents/inativos.xls. "
                            + "Query `primeiraLinhaDados` = índice 0-based da primeira linha de dados (default 1).")
    public ImportacaoInativarProcessosResponse importarProcessosInativarPorPath(
            @RequestParam(value = "path", required = false) String pathParam,
            @RequestParam(value = "primeiraLinhaDados", required = false, defaultValue = "1") int primeiraLinhaDados) {
        return executarImportacaoProcessosInativar(null, pathParam, primeiraLinhaDados);
    }

    private ImportacaoInativarProcessosResponse executarImportacaoProcessosInativar(
            MultipartFile file, String pathParam, int primeiraLinhaDados) {
        if (file != null && !file.isEmpty()) {
            try (InputStream in = file.getInputStream()) {
                String nome = file.getOriginalFilename() != null ? file.getOriginalFilename() : "upload";
                return processosInativarPlanilhaService.importarDeInputStream(in, nome, primeiraLinhaDados);
            } catch (IOException e) {
                throw new BusinessRuleException("Falha ao ler upload: " + e.getMessage());
            }
        }
        if (StringUtils.hasText(pathParam)) {
            return processosInativarPlanilhaService.importarDeArquivo(Path.of(pathParam.trim()), primeiraLinhaDados);
        }
        return processosInativarPlanilhaService.importarDeArquivo(null, primeiraLinhaDados);
    }

    @GetMapping("/pasta1-clientes")
    @Operation(
            summary = "Ler Pasta1.xls (col. A cliente, col. B id pessoa)",
            description =
                    "Query `path` opcional; senão `vilareal.import.pasta1-clientes.path`; senão %USERPROFILE%/Documents/Pasta1.xls")
    public Pasta1ClientePessoaListaResponse lerPasta1Clientes(@RequestParam(value = "path", required = false) String pathParam) {
        return pasta1ClientePessoaReader.lerArquivo(resolverPathPasta1(pathParam));
    }

    @PostMapping(value = "/pasta1-clientes", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Ler Pasta1 (upload)", description = "Campo `file` com a planilha (.xls/.xlsx)")
    public Pasta1ClientePessoaListaResponse lerPasta1ClientesMultipart(
            @RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessRuleException("Ficheiro vazio.");
        }
        try {
            String on = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
            String suf =
                    on.toLowerCase().endsWith(".xlsx") ? ".xlsx" : on.toLowerCase().endsWith(".xls") ? ".xls" : ".bin";
            Path temp = Files.createTempFile("vilareal-pasta1-", suf);
            try {
                file.transferTo(temp);
                return pasta1ClientePessoaReader.lerArquivo(temp);
            } finally {
                Files.deleteIfExists(temp);
            }
        } catch (IOException e) {
            throw new BusinessRuleException("Falha ao ler upload: " + e.getMessage());
        }
    }

    @PostMapping(value = "/pasta1-clientes/aplicar", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Gravar Pasta1 na base (upload)",
            description = "Lê col. A/B e faz upsert em `planilha_pasta1_cliente` (chave A -> pessoa_id). Campo `file` obrigatório.")
    public Pasta1ClientePessoaPersistResponse aplicarPasta1Multipart(@RequestParam("file") MultipartFile file) {
        if (file == null || file.isEmpty()) {
            throw new BusinessRuleException("Ficheiro vazio.");
        }
        try {
            String on = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
            String suf =
                    on.toLowerCase().endsWith(".xlsx") ? ".xlsx" : on.toLowerCase().endsWith(".xls") ? ".xls" : ".bin";
            Path temp = Files.createTempFile("vilareal-pasta1-aplicar-", suf);
            try {
                file.transferTo(temp);
                return pasta1ClientePessoaImportService.aplicarArquivo(temp);
            } finally {
                Files.deleteIfExists(temp);
            }
        } catch (IOException e) {
            throw new BusinessRuleException("Falha ao gravar ficheiro temporário: " + e.getMessage());
        }
    }

    @PostMapping("/pasta1-clientes/aplicar")
    @Operation(
            summary = "Gravar Pasta1 na base (path)",
            description =
                    "Query `path` opcional; senão `vilareal.import.pasta1-clientes.path`; senão %USERPROFILE%/Documents/Pasta1.xls")
    public Pasta1ClientePessoaPersistResponse aplicarPasta1PorPath(
            @RequestParam(value = "path", required = false) String pathParam) {
        return pasta1ClientePessoaImportService.aplicarArquivo(resolverPathPasta1(pathParam));
    }

    @PostMapping(value = "/clientes-planilha", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(
            summary = "Importar planilha clientes+processos (multipart)",
            description =
                    "Layout A–R (S ignorada): A código cliente, B id pessoa, C ativo, D–H autores, I,J,M–P réus, K proc., L fase, Q CNJ, R descrição. Campo `file` opcional; sem ficheiro usa `path` ou property ou ~/Documents/import clientes.xlsx")
    public ImportacaoInformacoesProcessosResponse importarClientesPlanilhaMultipart(
            @RequestParam(value = "file", required = false) MultipartFile file,
            @RequestParam(value = "path", required = false) String pathParam) {
        if (file != null && !file.isEmpty()) {
            try {
                String on = file.getOriginalFilename() != null ? file.getOriginalFilename() : "";
                String suf =
                        on.toLowerCase().endsWith(".xlsx")
                                ? ".xlsx"
                                : on.toLowerCase().endsWith(".xls") ? ".xls" : ".bin";
                Path temp = Files.createTempFile("vilareal-import-clientes-", suf);
                try {
                    file.transferTo(temp);
                    return importClientesPlanilhaService.importarDeArquivo(temp);
                } finally {
                    Files.deleteIfExists(temp);
                }
            } catch (IOException e) {
                throw new BusinessRuleException("Falha ao gravar ficheiro temporário: " + e.getMessage());
            }
        }
        if (StringUtils.hasText(pathParam)) {
            return importClientesPlanilhaService.importarDeArquivo(Path.of(pathParam.trim()));
        }
        return importClientesPlanilhaService.importarDeArquivo(null);
    }

    @PostMapping("/clientes-planilha")
    @Operation(
            summary = "Importar planilha clientes+processos (path)",
            description = "Query `path` opcional; senão `vilareal.import.clientes-planilha.path`; senão ~/Documents/import clientes.xlsx")
    public ImportacaoInformacoesProcessosResponse importarClientesPlanilhaPorPath(
            @RequestParam(value = "path", required = false) String pathParam) {
        if (StringUtils.hasText(pathParam)) {
            return importClientesPlanilhaService.importarDeArquivo(Path.of(pathParam.trim()));
        }
        return importClientesPlanilhaService.importarDeArquivo(null);
    }

    private Path resolverPathPasta1(String pathParam) {
        if (StringUtils.hasText(pathParam)) {
            return Path.of(pathParam.trim());
        }
        if (StringUtils.hasText(pasta1ConfiguredPath)) {
            return Paths.get(pasta1ConfiguredPath.trim());
        }
        return Paths.get(System.getProperty("user.home"), "Documents", "Pasta1.xls");
    }
}
