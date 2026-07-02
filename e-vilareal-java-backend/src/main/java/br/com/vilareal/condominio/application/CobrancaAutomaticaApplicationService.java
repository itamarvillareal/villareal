package br.com.vilareal.condominio.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.condominio.api.dto.CobrancaExtracaoResponse;
import br.com.vilareal.condominio.api.dto.CobrancaProcessarErroDto;
import br.com.vilareal.condominio.api.dto.CobrancaProcessarRequest;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoRequest;
import br.com.vilareal.condominio.api.dto.CobrancaProprietarioDiagnosticoResponse;
import br.com.vilareal.condominio.api.dto.CobrancaTotaisDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaUnidadeDto;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.condominio.api.dto.RelatorioRegraInicioDto;
import br.com.vilareal.calculo.application.CalculoApplicationService;
import br.com.vilareal.calculo.application.RegraInicioCobrancaDiasValidator;
import br.com.vilareal.condominio.pdf.InadimplenciaPdfParser;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class CobrancaAutomaticaApplicationService {

    private final CobrancaRelatorioXlsParser xlsParser;
    private final ClienteRepository clienteRepository;
    private final CobrancaAutomaticaUnidadeTransactionalService unidadeTransactionalService;
    private final CobrancaRelatorioMontador relatorioMontador;
    private final CobrancaExecucaoPersistenciaService persistenciaService;
    private final CobrancaRelatorioPdfService pdfService;
    private final CalculoApplicationService calculoApplicationService;
    private final CobrancaRegraInicioCobrancaService regraInicioCobrancaService;
    private final CobrancaProprietarioUnidadeLookupService proprietarioLookupService;
    private final CobrancaProprietarioDiagnosticoService proprietarioDiagnosticoService;

    public CobrancaAutomaticaApplicationService(
            CobrancaRelatorioXlsParser xlsParser,
            ClienteRepository clienteRepository,
            CobrancaAutomaticaUnidadeTransactionalService unidadeTransactionalService,
            CobrancaRelatorioMontador relatorioMontador,
            CobrancaExecucaoPersistenciaService persistenciaService,
            CobrancaRelatorioPdfService pdfService,
            CalculoApplicationService calculoApplicationService,
            CobrancaRegraInicioCobrancaService regraInicioCobrancaService,
            CobrancaProprietarioUnidadeLookupService proprietarioLookupService,
            CobrancaProprietarioDiagnosticoService proprietarioDiagnosticoService) {
        this.xlsParser = xlsParser;
        this.clienteRepository = clienteRepository;
        this.unidadeTransactionalService = unidadeTransactionalService;
        this.relatorioMontador = relatorioMontador;
        this.persistenciaService = persistenciaService;
        this.pdfService = pdfService;
        this.calculoApplicationService = calculoApplicationService;
        this.regraInicioCobrancaService = regraInicioCobrancaService;
        this.proprietarioLookupService = proprietarioLookupService;
        this.proprietarioDiagnosticoService = proprietarioDiagnosticoService;
    }

    public CobrancaExtracaoResponse extrairPdf(String clienteCodigoRaw, MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new BusinessRuleException("Arquivo PDF é obrigatório.");
        }
        String nome = arquivo.getOriginalFilename() != null ? arquivo.getOriginalFilename().toLowerCase(Locale.ROOT) : "";
        String ct = arquivo.getContentType();
        if (!nome.endsWith(".pdf") && (ct == null || !ct.contains("pdf"))) {
            throw new BusinessRuleException("Envie um arquivo PDF de inadimplência (Condo Id).");
        }

        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clienteCodigoRaw);
        ClienteEntity cliente = clienteRepository
                .findByCodigoClienteFetchPessoa(cod8)
                .orElseThrow(() -> new BusinessRuleException("Cliente não encontrado para o código: " + cod8));
        long clienteId = cliente.getId();

        InadimplenciaPdfParser.InadimplenciaPdfParseResult parsed;
        try {
            parsed = InadimplenciaPdfParser.parse(arquivo.getBytes());
        } catch (IOException e) {
            throw new BusinessRuleException(
                    "Não foi possível ler o PDF. Confirme que o arquivo é válido: " + e.getMessage());
        }

        List<CobrancaUnidadeParsed> unidades = new ArrayList<>();
        List<String> semProprietario = new ArrayList<>();
        for (InadimplenciaUnidadeDto u : parsed.unidades()) {
            String cod = u.codigoUnidade() != null ? u.codigoUnidade().trim().toUpperCase(Locale.ROOT) : "";
            if (!StringUtils.hasText(cod)) {
                continue;
            }
            var propOpt = proprietarioLookupService.buscarPorUnidade(clienteId, cod);
            List<InadimplenciaCobrancaDto> cobrancas = u.cobrancas() != null ? u.cobrancas() : List.of();
            if (propOpt.isEmpty()) {
                semProprietario.add(cod);
                unidades.add(new CobrancaUnidadeParsed(cod, "", "", cobrancas, null, null));
            } else {
                var prop = propOpt.get();
                semProprietario.add(cod);
                unidades.add(new CobrancaUnidadeParsed(
                        cod, "", "", cobrancas, prop.nome(), prop.docDigitos()));
            }
        }

        if (unidades.isEmpty()) {
            throw new BusinessRuleException("Nenhuma unidade com débito foi encontrada no PDF.");
        }

        return new CobrancaExtracaoResponse(
                unidades,
                calcularTotais(unidades),
                Utf8MojibakeUtil.corrigir(parsed.condominioNome()),
                parsed.dataReferenciaPdf(),
                List.copyOf(semProprietario));
    }

    public CobrancaExtracaoResponse extrair(MultipartFile arquivo) {
        if (arquivo == null || arquivo.isEmpty()) {
            throw new BusinessRuleException("Arquivo .xls é obrigatório.");
        }
        String nome = arquivo.getOriginalFilename() != null ? arquivo.getOriginalFilename().toLowerCase(Locale.ROOT) : "";
        if (!nome.endsWith(".xls") && !nome.endsWith(".xlsx")) {
            String ct = arquivo.getContentType();
            if (ct == null || (!ct.contains("excel") && !ct.contains("spreadsheet"))) {
                throw new BusinessRuleException("Envie um arquivo Excel (.xls ou .xlsx).");
            }
        }

        CobrancaRelatorioParseResult parse;
        try {
            parse = xlsParser.parseRelatorio(arquivo.getInputStream());
        } catch (IOException e) {
            throw new BusinessRuleException("Não foi possível ler o arquivo: " + e.getMessage());
        }

        List<CobrancaUnidadeParsed> unidades = parse.unidades();
        return new CobrancaExtracaoResponse(
                unidades,
                calcularTotais(unidades),
                Utf8MojibakeUtil.corrigir(parse.condominioNome()),
                parse.dataReferencia());
    }

    public RelatorioExecucaoCobranca processar(CobrancaProcessarRequest request) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(request.clienteCodigo());
        ClienteEntity cliente = clienteRepository
                .findByCodigoClienteFetchPessoa(cod8)
                .orElseThrow(() -> new BusinessRuleException("Cliente não encontrado para o código: " + cod8));

        long clienteId = cliente.getId();
        long clientePessoaId = cliente.getPessoa().getId();
        String importacaoId = UUID.randomUUID().toString();
        Instant criadoEm = Instant.now();
        LocalDate dataImportacao = LocalDate.now();
        int regraDias = lerRegraInicioCobrancaDias(cod8);
        CobrancaRegraInicioCobrancaService.FiltragemRegraInicio filtragem = regraInicioCobrancaService.filtrarUnidadesAcionadas(
                request.unidades(), dataImportacao, regraDias, clienteId, cod8);
        RelatorioRegraInicioDto regraInicio = new RelatorioRegraInicioDto(
                RegraInicioCobrancaDiasValidator.label(regraDias),
                dataImportacao.toString(),
                filtragem.devedoresDescartados(),
                filtragem.titulosDescartados());

        List<UnidadeProcessamentoResult> sucessos = new ArrayList<>();
        List<CobrancaProcessarErroDto> erros = new ArrayList<>();

        for (var unidade : filtragem.acionadas()) {
            String cod = unidade.codigoUnidadeNormalizada() != null
                    ? unidade.codigoUnidadeNormalizada().trim()
                    : "?";
            try {
                UnidadeProcessamentoResult r = unidadeTransactionalService.processarUnidade(
                        clienteId, clientePessoaId, cod8, unidade, importacaoId);
                sucessos.add(r);
            } catch (Exception e) {
                erros.add(new CobrancaProcessarErroDto(cod, e.getMessage() != null ? e.getMessage() : e.toString()));
            }
        }

        RelatorioExecucaoCobranca relatorio = relatorioMontador.montar(
                importacaoId,
                criadoEm,
                cod8,
                Utf8MojibakeUtil.corrigir(cliente.getPessoa().getNome()),
                request.arquivoNome(),
                usuarioAtual(),
                filtragem.acionadas(),
                regraInicio,
                sucessos,
                erros);

        persistenciaService.salvar(relatorio);
        return relatorio;
    }

    public CobrancaProprietarioDiagnosticoResponse diagnosticarProprietarios(
            CobrancaProprietarioDiagnosticoRequest request) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(request.clienteCodigo());
        ClienteEntity cliente = clienteRepository
                .findByCodigoClienteFetchPessoa(cod8)
                .orElseThrow(() -> new BusinessRuleException("Cliente não encontrado para o código: " + cod8));
        return proprietarioDiagnosticoService.diagnosticar(cliente.getId(), cod8, request);
    }

    public RelatorioExecucaoCobranca buscarRelatorio(String importacaoId) {
        return persistenciaService.carregar(importacaoId);
    }

    public byte[] gerarRelatorioPdf(String importacaoId) {
        return pdfService.gerarPdf(persistenciaService.carregar(importacaoId));
    }

    static String usuarioAtual() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || "anonymousUser".equals(a.getPrincipal())) {
            return null;
        }
        return a.getName();
    }

    private int lerRegraInicioCobrancaDias(String codigoCliente8) {
        var cfg = calculoApplicationService.obterConfigCliente(codigoCliente8);
        return RegraInicioCobrancaDiasValidator.parse(cfg.config().get("regraInicioCobrancaDias"));
    }

    static CobrancaTotaisDto calcularTotais(List<CobrancaUnidadeParsed> unidades) {
        int pf = 0;
        int pj = 0;
        int debitos = 0;
        long valorTotal = 0L;
        for (CobrancaUnidadeParsed u : unidades) {
            String doc = CobrancaRelatorioXlsParser.somenteDigitos(u.proprietarioDocDigitos());
            if (doc.length() == 11) {
                pf++;
            } else if (doc.length() == 14) {
                pj++;
            }
            List<InadimplenciaCobrancaDto> cob = u.cobrancas();
            if (cob != null) {
                debitos += cob.size();
                for (InadimplenciaCobrancaDto c : cob) {
                    if (c != null) {
                        valorTotal += c.valorCentavos();
                    }
                }
            }
        }
        return new CobrancaTotaisDto(unidades.size(), debitos, pf, pj, valorTotal);
    }
}
