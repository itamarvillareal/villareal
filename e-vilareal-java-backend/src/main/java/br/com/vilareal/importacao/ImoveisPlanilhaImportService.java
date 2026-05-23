package br.com.vilareal.importacao;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.importacao.dto.ImportacaoInformacoesProcessosResponse;
import br.com.vilareal.importacao.dto.ImportacaoLinhaDetalhe;
import br.com.vilareal.importacao.dto.ImportacaoLinhaStatus;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.application.ImovelProcessoLinkService;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ContratoLocacaoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.application.ProcessoCanonicalLookup;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.apache.poi.ss.usermodel.Row;
import org.apache.poi.ss.usermodel.Sheet;
import org.apache.poi.ss.usermodel.Workbook;
import org.apache.poi.ss.usermodel.WorkbookFactory;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.IOException;
import java.io.InputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.Paths;
import java.time.LocalDate;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * Importação da planilha {@code imoveis.xlsx}: 1ª aba, cabeçalho linha 1, dados a partir da linha 2, colunas A–AZ.
 *
 * <p>Colunas B (cód. cliente) e C (proc.) são opcionais: imóvel pode existir sem cliente/processos na base; se B+C
 * existirem mas o processo não for encontrado, o imóvel é gravado com {@code processo_id} nulo e cód./proc. nos extras.
 * Em reimportação pelo mesmo {@code numero_planilha}, B ou C vazios na planilha <strong>não</strong> apagam
 * {@code pessoa_id}/{@code processo_id} nem as chaves {@code codigo}/{@code proc} nos extras já gravados.
 */
@Service
public class ImoveisPlanilhaImportService {

    private static final Logger log = LoggerFactory.getLogger(ImoveisPlanilhaImportService.class);
    private static final int ULTIMA_COL_INCLUSIVE = 51;
    private static final LocalDate DATA_INICIO_PADRAO = LocalDate.of(2000, 1, 1);
    /** Export «Villa Real - Administração de Imóveis - Itamar.xls»: dados a partir da linha Excel 9. */
    private static final int ADMIN_FIRST_ROW_0 = 8;

    private static final int ADMIN_LAST_ROW_0 = 71;
    private static final Path PATH_PLANILHA_ADMIN_ITAMAR_PADRAO = Paths.get(
            System.getProperty("user.home"),
            "Dropbox",
            "sistema",
            "Villa Real - Administração de Imóveis - Itamar.xls");

    private final ImovelRepository imovelRepository;
    private final ContratoLocacaoRepository contratoLocacaoRepository;
    private final ClienteRepository clienteRepository;
    private final PessoaRepository pessoaRepository;
    private final ProcessoRepository processoRepository;
    private final ImovelProcessoLinkService imovelProcessoLinkService;
    private final ObjectMapper objectMapper;

    @Value("${vilareal.import.imoveis-planilha.path:}")
    private String configuredPath;

    public ImoveisPlanilhaImportService(
            ImovelRepository imovelRepository,
            ContratoLocacaoRepository contratoLocacaoRepository,
            ClienteRepository clienteRepository,
            PessoaRepository pessoaRepository,
            ProcessoRepository processoRepository,
            ImovelProcessoLinkService imovelProcessoLinkService,
            ObjectMapper objectMapper) {
        this.imovelRepository = imovelRepository;
        this.contratoLocacaoRepository = contratoLocacaoRepository;
        this.clienteRepository = clienteRepository;
        this.pessoaRepository = pessoaRepository;
        this.processoRepository = processoRepository;
        this.imovelProcessoLinkService = imovelProcessoLinkService;
        this.objectMapper = objectMapper;
    }

    public Path resolverPathPadrao() {
        if (StringUtils.hasText(configuredPath)) {
            return Paths.get(configuredPath.trim());
        }
        return PATH_PLANILHA_ADMIN_ITAMAR_PADRAO;
    }

    @Transactional
    public ImportacaoInformacoesProcessosResponse importarDeArquivo(Path pathOverride) {
        Path path = pathOverride != null ? pathOverride : resolverPathPadrao();
        if (!Files.isRegularFile(path)) {
            throw new BusinessRuleException("Arquivo não encontrado: " + path.toAbsolutePath());
        }
        try {
            return importarWorkbookDeArquivo(path, path);
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            if (ehErroXlsLegadoPoi(path, e)) {
                log.warn(
                        "[import-imoveis-planilha] POI não leu {} ({}); convertendo com Python.",
                        path.getFileName(),
                        e.getMessage());
                Path convertido = null;
                try {
                    convertido = converterAdministracaoXlsParaXlsx(path);
                    ImportacaoInformacoesProcessosResponse resp = importarWorkbookDeArquivo(path, convertido);
                    resp.setArquivo(path.toAbsolutePath() + " (convertido automaticamente)");
                    return resp;
                } catch (BusinessRuleException be) {
                    throw be;
                } catch (Exception e2) {
                    throw new BusinessRuleException("Falha ao converter/importar .xls legado: " + e2.getMessage());
                } finally {
                    if (convertido != null) {
                        try {
                            Files.deleteIfExists(convertido);
                        } catch (IOException ignored) {
                            /* temp */
                        }
                    }
                }
            }
            log.error("[import-imoveis-planilha] falha ao ler planilha", e);
            throw new BusinessRuleException("Falha ao ler planilha: " + e.getMessage());
        }
    }

    private ImportacaoInformacoesProcessosResponse importarWorkbookDeArquivo(Path pathOrigem, Path pathLeitura)
            throws Exception {
        ImportacaoInformacoesProcessosResponse resp = new ImportacaoInformacoesProcessosResponse();
        resp.setArquivo(pathOrigem.toAbsolutePath().toString());

        try (InputStream in = Files.newInputStream(pathLeitura);
                Workbook workbook = WorkbookFactory.create(in)) {
            Sheet sheet = workbook.getNumberOfSheets() > 0 ? workbook.getSheetAt(0) : null;
            if (sheet == null) {
                throw new BusinessRuleException("Planilha sem abas.");
            }
            int lastRowIdx = sheet.getLastRowNum();
            resp.setTotalLinhasCorpo(Math.max(0, lastRowIdx));

            boolean layoutAdministracao =
                    pathLeitura.equals(pathOrigem) && isLayoutAdministracaoItamar(pathOrigem, sheet);
            if (layoutAdministracao) {
                return importarLayoutAdministracao(sheet, pathOrigem, resp);
            }

            int ok = 0;
            int erros = 0;
            int ignoradas = 0;

            for (int rowNum = 1; rowNum <= lastRowIdx; rowNum++) {
                Row row = sheet.getRow(rowNum);
                if (PlanilhaExcelUtil.linhaTotalmenteVaziaAteColuna(row, ULTIMA_COL_INCLUSIVE)) {
                    ignoradas++;
                    continue;
                }
                int linhaExcel = rowNum + 1;
                String colA = PlanilhaExcelUtil.cellString(row, 0);
                if (!StringUtils.hasText(colA)) {
                    ignoradas++;
                    continue;
                }
                try {
                    aplicarLinha(row, linhaExcel);
                    ok++;
                    ImportacaoLinhaDetalhe d = new ImportacaoLinhaDetalhe();
                    d.setLinhaExcel(linhaExcel);
                    d.setStatus(ImportacaoLinhaStatus.SUCESSO);
                    d.setMensagem("Imóvel importado (nº planilha=" + ImoveisPlanilhaImportSupport.parseInteiro(colA) + ")");
                    resp.getDetalhes().add(d);
                } catch (Exception e) {
                    erros++;
                    log.warn("[import-imoveis-planilha] linha={} ERRO: {}", linhaExcel, e.getMessage());
                    ImportacaoLinhaDetalhe d = new ImportacaoLinhaDetalhe();
                    d.setLinhaExcel(linhaExcel);
                    d.setStatus(ImportacaoLinhaStatus.ERRO);
                    d.setMensagem(e.getMessage());
                    resp.getDetalhes().add(d);
                }
            }
            resp.setLinhasIgnoradas(ignoradas);
            resp.setLinhasProcessadasComSucesso(ok);
            resp.setLinhasComErro(erros);
            log.info(
                    "[import-imoveis-planilha] ficheiro={} ok={} erros={} ignoradas={}",
                    pathOrigem,
                    ok,
                    erros,
                    ignoradas);
            return resp;
        }
    }

    static boolean ehErroXlsLegadoPoi(Path path, Throwable e) {
        if (path == null || e == null) {
            return false;
        }
        String nome = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (!nome.endsWith(".xls")) {
            return false;
        }
        String msg = e.getMessage();
        if (!StringUtils.hasText(msg)) {
            return false;
        }
        String m = msg.toLowerCase(Locale.ROOT);
        return m.contains("linktable") || m.contains("extern sheet");
    }

    private Path converterAdministracaoXlsParaXlsx(Path entrada) throws IOException, InterruptedException {
        Path script = resolverScriptMapAdministracao();
        Path temp = Files.createTempFile("vilareal-import-imoveis-", ".xlsx");
        ProcessBuilder pb = new ProcessBuilder(
                "python3",
                script.toAbsolutePath().toString(),
                entrada.toAbsolutePath().toString(),
                temp.toAbsolutePath().toString());
        pb.redirectErrorStream(true);
        Process proc = pb.start();
        String out = new String(proc.getInputStream().readAllBytes(), StandardCharsets.UTF_8).trim();
        int code = proc.waitFor();
        if (code != 0) {
            Files.deleteIfExists(temp);
            throw new BusinessRuleException(
                    "Conversão Python falhou (exit " + code + "). Instale: pip install xlrd openpyxl. Saída: "
                            + out);
        }
        if (!Files.isRegularFile(temp) || Files.size(temp) == 0) {
            Files.deleteIfExists(temp);
            throw new BusinessRuleException("Conversão Python não gerou ficheiro em " + temp);
        }
        log.info("[import-imoveis-planilha] convertido {} -> {} ({})", entrada.getFileName(), temp, out);
        return temp;
    }

    private Path resolverScriptMapAdministracao() {
        String env = System.getenv("VILAREAL_MAP_ADMIN_IMOVEIS_SCRIPT");
        if (StringUtils.hasText(env)) {
            Path p = Paths.get(env.trim());
            if (Files.isRegularFile(p)) {
                return p.toAbsolutePath();
            }
            throw new BusinessRuleException("Script de conversão não encontrado: " + p.toAbsolutePath());
        }
        Path cwd = Paths.get("").toAbsolutePath();
        for (Path base : List.of(cwd, cwd.getParent(), cwd.resolve("e-vilareal-java-backend"))) {
            Path script = base.resolve("scripts/map_administracao_imoveis_to_imoveis_xlsx.py");
            if (Files.isRegularFile(script)) {
                return script.toAbsolutePath();
            }
        }
        throw new BusinessRuleException(
                "Script map_administracao_imoveis_to_imoveis_xlsx.py não encontrado. Defina VILAREAL_MAP_ADMIN_IMOVEIS_SCRIPT ou execute a partir de e-vilareal-java-backend.");
    }

    private boolean isLayoutAdministracaoItamar(Path path, Sheet sheet) {
        String nome = path.getFileName().toString().toLowerCase(Locale.ROOT);
        if (nome.contains("administra") && nome.endsWith(".xls")) {
            return true;
        }
        Row amostra = sheet.getRow(ADMIN_FIRST_ROW_0);
        if (amostra == null) {
            return false;
        }
        Integer np = ImoveisPlanilhaImportSupport.parseInteiro(PlanilhaExcelUtil.cellString(amostra, 1));
        String col0 = PlanilhaExcelUtil.cellString(amostra, 0);
        return np != null && np >= 1 && StringUtils.hasText(col0) && col0.contains("//");
    }

    private ImportacaoInformacoesProcessosResponse importarLayoutAdministracao(
            Sheet sheet, Path path, ImportacaoInformacoesProcessosResponse resp) {
        int last = Math.min(ADMIN_LAST_ROW_0, sheet.getLastRowNum());
        int ok = 0;
        int erros = 0;
        int ignoradas = 0;
        log.info("[import-imoveis-planilha] layout administracao Itamar: ficheiro={}", path.toAbsolutePath());

        for (int rowNum = ADMIN_FIRST_ROW_0; rowNum <= last; rowNum++) {
            Row row = sheet.getRow(rowNum);
            if (PlanilhaExcelUtil.linhaTotalmenteVaziaAteColuna(row, ULTIMA_COL_INCLUSIVE + 4)) {
                ignoradas++;
                continue;
            }
            int linhaExcel = rowNum + 1;
            String[] c = ImoveisPlanilhaImportSupport.mapLinhaAdministracaoParaCanonica(row);
            if (!StringUtils.hasText(c[0])) {
                ignoradas++;
                continue;
            }
            if (!StringUtils.hasText(c[1]) && !StringUtils.hasText(c[2]) && !StringUtils.hasText(c[4])) {
                ignoradas++;
                continue;
            }
            try {
                aplicarLinhaColunas(c, linhaExcel);
                ok++;
                ImportacaoLinhaDetalhe d = new ImportacaoLinhaDetalhe();
                d.setLinhaExcel(linhaExcel);
                d.setStatus(ImportacaoLinhaStatus.SUCESSO);
                d.setMensagem("Imóvel importado (nº planilha=" + ImoveisPlanilhaImportSupport.parseInteiro(c[0]) + ")");
                resp.getDetalhes().add(d);
            } catch (Exception e) {
                erros++;
                log.warn("[import-imoveis-planilha] linha={} ERRO: {}", linhaExcel, e.getMessage());
                ImportacaoLinhaDetalhe d = new ImportacaoLinhaDetalhe();
                d.setLinhaExcel(linhaExcel);
                d.setStatus(ImportacaoLinhaStatus.ERRO);
                d.setMensagem(e.getMessage());
                resp.getDetalhes().add(d);
            }
        }
        resp.setLinhasIgnoradas(ignoradas);
        resp.setLinhasProcessadasComSucesso(ok);
        resp.setLinhasComErro(erros);
        log.info("[import-imoveis-planilha] ficheiro={} ok={} erros={} ignoradas={}", path, ok, erros, ignoradas);
        return resp;
    }

    private void aplicarLinha(Row row, int linhaExcel) throws Exception {
        String[] c = new String[ULTIMA_COL_INCLUSIVE + 1];
        for (int i = 0; i < c.length; i++) {
            c[i] = PlanilhaExcelUtil.cellString(row, i);
        }
        aplicarLinhaColunas(c, linhaExcel);
    }

    private void aplicarLinhaColunas(String[] c, int linhaExcel) throws Exception {
        Integer numeroPlanilha = ImoveisPlanilhaImportSupport.resolverNumeroPlanilha(c[0], c[1]);
        if (numeroPlanilha == null || numeroPlanilha < 1 || numeroPlanilha > 999) {
            throw new IllegalArgumentException("Nº da planilha (col. A/B) inválido ou vazio (linha " + linhaExcel + ").");
        }

        String colBRaw = c[1] == null ? "" : c[1].trim();
        String codB = StringUtils.hasText(colBRaw) ? CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(colBRaw) : null;
        if (StringUtils.hasText(colBRaw) && (codB == null || codB.isEmpty())) {
            throw new IllegalArgumentException("Coluna B (Cód. Cliente) inválida (linha " + linhaExcel + ").");
        }
        ClienteEntity clienteEntity = null;
        PessoaEntity pessoaCliente = null;
        if (StringUtils.hasText(codB)) {
            clienteEntity = clienteRepository.findByCodigoCliente(codB).orElseThrow(() -> new IllegalArgumentException(
                    "Cliente não encontrado para código " + codB + " (linha " + linhaExcel + ")."));
            pessoaCliente = clienteEntity.getPessoa();
        }

        Integer procInt = ImoveisPlanilhaImportSupport.parseInteiro(c[2]);
        if (StringUtils.hasText(c[2]) && (procInt == null || procInt < 1)) {
            throw new IllegalArgumentException("Coluna C (Proc.) inválida (linha " + linhaExcel + ").");
        }
        ProcessoEntity processo = null;
        if (procInt != null && procInt >= 1 && clienteEntity != null) {
            Long pessoaId = pessoaCliente.getId();
            processo = ProcessoCanonicalLookup.escolher(
                            processoRepository.findAllByCliente_IdAndNumeroInternoOrderByIdDesc(
                                    clienteEntity.getId(), procInt),
                            pessoaId)
                    .or(() -> processoRepository.findByPessoa_IdAndNumeroInterno(pessoaId, procInt))
                    .orElse(null);
            if (processo == null) {
                log.info(
                        "[import-imoveis-planilha] linha={} sem vínculo processo: cliente={} proc={} (imóvel gravado sem vínculo)",
                        linhaExcel,
                        codB,
                        procInt);
            }
        }

        Long idResp = ImoveisPlanilhaImportSupport.parseLongId(c[3]);
        PessoaEntity responsavel = null;
        if (idResp != null) {
            responsavel = pessoaRepository
                    .findById(idResp)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Pessoa coluna D (Propr.) não encontrada: " + idResp + " (linha " + linhaExcel + ")."));
        }

        Long idInq = ImoveisPlanilhaImportSupport.parseLongId(c[25]);
        PessoaEntity inquilino = null;
        if (idInq != null) {
            inquilino = pessoaRepository
                    .findById(idInq)
                    .orElseThrow(() -> new IllegalArgumentException(
                            "Pessoa coluna Z (Inquilino) não encontrada: " + idInq + " (linha " + linhaExcel + ")."));
        }

        ImovelEntity imovel = clienteEntity != null
                ? imovelRepository
                        .findByCliente_IdAndNumeroPlanilha(clienteEntity.getId(), numeroPlanilha)
                        .orElseGet(ImovelEntity::new)
                : imovelRepository.findByNumeroPlanilha(numeroPlanilha).orElseGet(ImovelEntity::new);
        boolean existente = imovel.getId() != null;
        if (!existente || StringUtils.hasText(codB)) {
            imovel.setCliente(clienteEntity);
            imovel.setPessoa(pessoaCliente);
        }
        imovel.setNumeroPlanilha(numeroPlanilha);
        imovel.setResponsavelPessoa(responsavel);

        String unidade = ImoveisPlanilhaImportSupport.trimToEmpty(c[4]);
        String condominio = ImoveisPlanilhaImportSupport.trimToEmpty(c[5]);
        imovel.setUnidade(StringUtils.hasText(unidade) ? unidade : null);
        imovel.setCondominio(StringUtils.hasText(condominio) ? condominio : null);
        imovel.setEnderecoCompleto(StringUtils.hasText(c[24]) ? c[24].trim() : null);
        imovel.setInscricaoImobiliaria(StringUtils.hasText(c[6]) ? c[6].trim() : null);
        imovel.setGaragens(StringUtils.hasText(c[29]) ? c[29].trim() : null);

        String snAz = ImoveisPlanilhaImportSupport.normalizarSimNao(c[51]);
        if ("sim".equals(snAz)) {
            imovel.setSituacao("OCUPADO");
        } else if ("nao".equals(snAz)) {
            imovel.setSituacao("DESOCUPADO");
        } else if (imovel.getId() == null) {
            imovel.setSituacao("DESOCUPADO");
        }

        imovel.setTitulo(StringUtils.hasText(unidade)
                ? unidade
                : (StringUtils.hasText(condominio) ? condominio : null));

        Map<String, Object> extras = lerExtrasMap(imovel.getCamposExtrasJson());
        if (StringUtils.hasText(codB)) {
            extras.put("codigo", codB);
        }
        if (procInt != null && procInt >= 1) {
            extras.put("proc", String.valueOf(procInt));
        }
        extras.put("infoIptuTexto", ImoveisPlanilhaImportSupport.trimToEmpty(c[7]));
        putDataBr(extras, "dataConsIptu", c[8]);
        extras.put("existeDebIptu", ImoveisPlanilhaImportSupport.normalizarSimNao(c[9]));
        extras.put("aguaNumero", ImoveisPlanilhaImportSupport.trimToEmpty(c[10]));
        extras.put("diaVencAgua", ImoveisPlanilhaImportSupport.trimToEmpty(c[11]));
        extras.put("existeDebAgua", ImoveisPlanilhaImportSupport.normalizarSimNao(c[12]));
        putDataBr(extras, "dataConsAgua", c[13]);
        extras.put("energiaNumero", ImoveisPlanilhaImportSupport.trimToEmpty(c[14]));
        extras.put("diaVencEnergia", ImoveisPlanilhaImportSupport.trimToEmpty(c[15]));
        extras.put("existeDebEnergia", ImoveisPlanilhaImportSupport.normalizarSimNao(c[16]));
        putDataBr(extras, "dataConsEnergia", c[17]);
        extras.put("gasNumero", ImoveisPlanilhaImportSupport.trimToEmpty(c[18]));
        extras.put("diaVencGas", ImoveisPlanilhaImportSupport.trimToEmpty(c[19]));
        extras.put("existeDebGas", ImoveisPlanilhaImportSupport.normalizarSimNao(c[20]));
        putDataBr(extras, "dataConsGas", c[21]);
        extras.put("existeDebitoCond", ImoveisPlanilhaImportSupport.normalizarSimNao(c[22]));
        putDataBr(extras, "dataConsDebitoCond", c[23]);
        extras.put("valorGarantia", StringUtils.hasText(c[32]) ? c[32].trim() : "");
        extras.put("contratoIntermediacaoArquivado", ImoveisPlanilhaImportSupport.normalizarSimNao(c[33]));
        extras.put(
                "contratoIntermediacaoAssinadoProprietario",
                ImoveisPlanilhaImportSupport.normalizarSimNao(c[34]));
        extras.put("contratoAssinadoProprietario", ImoveisPlanilhaImportSupport.normalizarSimNao(c[35]));
        extras.put("contratoAssinadoInquilino", ImoveisPlanilhaImportSupport.normalizarSimNao(c[36]));
        extras.put("contratoAssinadoGarantidor", ImoveisPlanilhaImportSupport.normalizarSimNao(c[37]));
        extras.put("contratoAssinadoTestemunhas", ImoveisPlanilhaImportSupport.normalizarSimNao(c[38]));
        extras.put("contratoArquivado", ImoveisPlanilhaImportSupport.normalizarSimNao(c[39]));
        extras.put("linkVistoria", ImoveisPlanilhaImportSupport.trimToEmpty(c[40]));
        putDataBr(extras, "dataPag1TxCond", c[49]);
        extras.put("observacoesInquilino", ImoveisPlanilhaImportSupport.trimToEmpty(c[50]));

        if (responsavel != null) {
            extras.put("proprietario", Optional.ofNullable(responsavel.getNome()).orElse(""));
        }
        if (inquilino != null) {
            extras.put("inquilino", Optional.ofNullable(inquilino.getNome()).orElse(""));
        }

        imovel.setCamposExtrasJson(objectMapper.writeValueAsString(extras));
        imovel.setAtivo(true);
        imovel = imovelRepository.save(imovel);

        if (processo != null) {
            imovelProcessoLinkService.vincularSeProcessoInformado(imovel, processo.getId());
        }

        ContratoLocacaoEntity contrato = resolverContratoPrincipal(imovel.getId());
        boolean novo = contrato.getId() == null;
        contrato.setImovel(imovel);
        contrato.setLocadorPessoa(responsavel);
        contrato.setInquilinoPessoa(inquilino);

        LocalDate di = ImoveisPlanilhaImportSupport.parseDataFlex(c[26]);
        contrato.setDataInicio(di != null ? di : DATA_INICIO_PADRAO);
        LocalDate df = ImoveisPlanilhaImportSupport.parseDataFlex(c[27]);
        contrato.setDataFim(df);

        BigDecimal val = ImoveisPlanilhaImportSupport.parseValorRealBr(c[30]);
        contrato.setValorAluguel(val != null ? val : BigDecimal.ZERO);

        Integer diaPag = ImoveisPlanilhaImportSupport.parseInteiro(c[28]);
        contrato.setDiaVencimentoAluguel(diaPag);
        Integer diaRep = ImoveisPlanilhaImportSupport.parseInteiro(c[41]);
        contrato.setDiaRepasse(diaRep);

        contrato.setGarantiaTipo(StringUtils.hasText(c[31]) ? c[31].trim() : null);
        contrato.setValorGarantia(null);

        Map<String, Object> banco = new LinkedHashMap<>();
        banco.put("numeroBanco", ImoveisPlanilhaImportSupport.trimToEmpty(c[42]));
        banco.put("banco", ImoveisPlanilhaImportSupport.trimToEmpty(c[43]));
        banco.put("agencia", ImoveisPlanilhaImportSupport.trimToEmpty(c[44]));
        banco.put("conta", ImoveisPlanilhaImportSupport.trimToEmpty(c[45]));
        banco.put("cpfBanco", ImoveisPlanilhaImportSupport.trimToEmpty(c[46]));
        banco.put("titular", ImoveisPlanilhaImportSupport.trimToEmpty(c[47]));
        banco.put("chavePix", ImoveisPlanilhaImportSupport.trimToEmpty(c[48]));
        contrato.setDadosBancariosRepasseJson(objectMapper.writeValueAsString(banco));

        if (novo || !StringUtils.hasText(contrato.getStatus())) {
            contrato.setStatus("VIGENTE");
        }
        contrato.setObservacoes(StringUtils.hasText(c[50]) ? c[50].trim() : null);
        contratoLocacaoRepository.save(contrato);
    }

    private ContratoLocacaoEntity resolverContratoPrincipal(Long imovelId) {
        List<ContratoLocacaoEntity> list = contratoLocacaoRepository.findByImovel_IdOrderByDataInicioDescIdDesc(imovelId);
        Optional<ContratoLocacaoEntity> vigente =
                list.stream().filter(x -> "VIGENTE".equalsIgnoreCase(String.valueOf(x.getStatus()))).findFirst();
        if (vigente.isPresent()) {
            return vigente.get();
        }
        if (!list.isEmpty()) {
            return list.get(0);
        }
        return new ContratoLocacaoEntity();
    }

    private void putDataBr(Map<String, Object> extras, String key, String raw) {
        extras.put(key, ImoveisPlanilhaImportSupport.normalizarDataTextoBr(raw));
    }

    private Map<String, Object> lerExtrasMap(String json) {
        if (!StringUtils.hasText(json)) {
            return new LinkedHashMap<>();
        }
        try {
            return objectMapper.readValue(json, new TypeReference<LinkedHashMap<String, Object>>() {});
        } catch (Exception e) {
            return new LinkedHashMap<>();
        }
    }
}
