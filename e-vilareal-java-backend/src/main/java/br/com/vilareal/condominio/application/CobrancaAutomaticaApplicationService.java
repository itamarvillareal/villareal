package br.com.vilareal.condominio.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.condominio.api.dto.CobrancaExtracaoResponse;
import br.com.vilareal.condominio.api.dto.CobrancaProcessarErroDto;
import br.com.vilareal.condominio.api.dto.CobrancaProcessarRequest;
import br.com.vilareal.condominio.api.dto.CobrancaTotaisDto;
import br.com.vilareal.condominio.api.dto.InadimplenciaCobrancaDto;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.Instant;
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

    public CobrancaAutomaticaApplicationService(
            CobrancaRelatorioXlsParser xlsParser,
            ClienteRepository clienteRepository,
            CobrancaAutomaticaUnidadeTransactionalService unidadeTransactionalService,
            CobrancaRelatorioMontador relatorioMontador,
            CobrancaExecucaoPersistenciaService persistenciaService,
            CobrancaRelatorioPdfService pdfService) {
        this.xlsParser = xlsParser;
        this.clienteRepository = clienteRepository;
        this.unidadeTransactionalService = unidadeTransactionalService;
        this.relatorioMontador = relatorioMontador;
        this.persistenciaService = persistenciaService;
        this.pdfService = pdfService;
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

        List<UnidadeProcessamentoResult> sucessos = new ArrayList<>();
        List<CobrancaProcessarErroDto> erros = new ArrayList<>();

        for (var unidade : request.unidades()) {
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
                request.unidades(),
                sucessos,
                erros);

        persistenciaService.salvar(relatorio);
        return relatorio;
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
