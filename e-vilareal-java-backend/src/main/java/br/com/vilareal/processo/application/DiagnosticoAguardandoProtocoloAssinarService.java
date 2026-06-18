package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.documento.DocumentoDrivePastaService;
import br.com.vilareal.documento.DriveArquivoDto;
import br.com.vilareal.documento.DrivePastaProcessoDto;
import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.processo.api.dto.DiagnosticoAguardandoProtocoloItemRequest;
import br.com.vilareal.processo.api.dto.DiagnosticoUploadAssinadosResponse;
import br.com.vilareal.processo.api.dto.PrepararAssinarResultado;
import br.com.vilareal.processo.api.dto.PrepararAssinarResultado.ResumoProcessoPrepararAssinar;
import br.com.vilareal.processo.api.dto.ProcessoResponse;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.projudi.ProjudiAssinaturaP7sUtil;
import br.com.vilareal.projudi.ProjudiNumeroReduzidoUtil;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService.ArquivoAssinadoRecebido;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService.ItemAssinado;
import br.com.vilareal.projudi.application.ProjudiPeticaoRegistroService;
import br.com.vilareal.projudi.application.ProjudiPeticaoRegistroService.ArquivoParaAssinar;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoArquivoRepository;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.ByteArrayOutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.text.Normalizer;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class DiagnosticoAguardandoProtocoloAssinarService {

    private static final Logger log = LoggerFactory.getLogger(DiagnosticoAguardandoProtocoloAssinarService.class);
    private static final String PASTA_ASSINAR = "Assinar";
    private static final String STATUS_ARQUIVO_PENDENTE = "PENDENTE_ASSINATURA";
    private static final String STATUS_PETICAO_ASSINADA = "ASSINADA";
    private static final String STATUS_PETICAO_PROTOCOLADA = "PROTOCOLADA";
    private static final String STATUS_PETICAO_PROTOCOLANDO = "PROTOCOLANDO";

    private final DocumentoDrivePastaService documentoDrivePastaService;
    private final GoogleDriveService googleDriveService;
    private final ProcessoApplicationService processoApplicationService;
    private final ProcessoRepository processoRepository;
    private final ProjudiPeticaoRegistroService peticaoRegistroService;
    private final ProjudiPeticaoAssinaturaService peticaoAssinaturaService;
    private final ProjudiPeticaoArquivoRepository arquivoRepository;
    private final ProjudiPeticaoRepository peticaoRepository;
    private final ObjectMapper objectMapper;
    private final Path storeDir;

    public DiagnosticoAguardandoProtocoloAssinarService(
            DocumentoDrivePastaService documentoDrivePastaService,
            GoogleDriveService googleDriveService,
            ProcessoApplicationService processoApplicationService,
            ProcessoRepository processoRepository,
            ProjudiPeticaoRegistroService peticaoRegistroService,
            ProjudiPeticaoAssinaturaService peticaoAssinaturaService,
            ProjudiPeticaoArquivoRepository arquivoRepository,
            ProjudiPeticaoRepository peticaoRepository,
            ObjectMapper objectMapper,
            @Value("${projudi.peticao.store-dir:/Users/itamar/projudi-peticoes}") String storeDirConfig) {
        this.documentoDrivePastaService = documentoDrivePastaService;
        this.googleDriveService = googleDriveService;
        this.processoApplicationService = processoApplicationService;
        this.processoRepository = processoRepository;
        this.peticaoRegistroService = peticaoRegistroService;
        this.peticaoAssinaturaService = peticaoAssinaturaService;
        this.arquivoRepository = arquivoRepository;
        this.peticaoRepository = peticaoRepository;
        this.objectMapper = objectMapper;
        this.storeDir = Path.of(storeDirConfig.trim());
    }

    @Transactional
    public PrepararAssinarResultado prepararAssinatura(
            Long credencialId, List<DiagnosticoAguardandoProtocoloItemRequest> processos) {
        if (credencialId == null) {
            throw new BusinessRuleException("credencialId é obrigatório.");
        }
        if (processos == null || processos.isEmpty()) {
            throw new BusinessRuleException("Nenhum processo informado.");
        }
        if (!googleDriveService.isConfigurado()) {
            throw new BusinessRuleException("Google Drive não está configurado.");
        }

        Set<Long> peticaoIds = new LinkedHashSet<>();
        List<ResumoProcessoPrepararAssinar> resumos = new ArrayList<>();
        int totalArquivos = 0;

        for (DiagnosticoAguardandoProtocoloItemRequest item : processos) {
            String cod = normalizarCodigo(item.getCodigoCliente());
            Integer proc = item.getNumeroInterno();
            String cnj = resolverCnj(item, cod, proc);
            if (!StringUtils.hasText(cod) || proc == null || !StringUtils.hasText(cnj)) {
                resumos.add(new ResumoProcessoPrepararAssinar(
                        cnj != null ? cnj : "", cod != null ? cod : "", 0, 0, 0, true));
                continue;
            }

            int registradas = 0;
            int reutilizadas = 0;
            int ignoradasJaAssinadas = 0;
            boolean semArquivos = false;

            List<PdfDriveItem> pdfs;
            try {
                DrivePastaProcessoDto pastaDto =
                        documentoDrivePastaService.resolverPastaRaizProcesso(googleDriveService, cod, proc);
                if (pastaDto == null || !StringUtils.hasText(pastaDto.pastaId())) {
                    log.info("Preparar Assinar: pasta do processo não resolvida ({}/{})", cod, proc);
                    semArquivos = true;
                    resumos.add(new ResumoProcessoPrepararAssinar(cnj, cod, 0, 0, 0, true));
                    continue;
                }

                String pastaAssinarId =
                        googleDriveService.encontrarPastaExistente(PASTA_ASSINAR, pastaDto.pastaId());
                if (!StringUtils.hasText(pastaAssinarId)) {
                    log.info("Preparar Assinar: subpasta Assinar ausente ({}/{})", cod, proc);
                    semArquivos = true;
                    resumos.add(new ResumoProcessoPrepararAssinar(cnj, cod, 0, 0, 0, true));
                    continue;
                }

                List<DriveArquivoDto> filhos = googleDriveService.listarConteudo(pastaAssinarId);
                pdfs = new ArrayList<>();
                for (DriveArquivoDto arq : filhos) {
                    if (arq == null || "pasta".equals(arq.tipo()) || !StringUtils.hasText(arq.id())) {
                        continue;
                    }
                    String nome = arq.nome() != null ? arq.nome().trim() : "documento";
                    if (!nome.toLowerCase().endsWith(".pdf")) {
                        continue;
                    }
                    try {
                        byte[] bytes = googleDriveService.baixarBytesArquivo(arq.id());
                        pdfs.add(new PdfDriveItem(nome, bytes));
                    } catch (Exception e) {
                        log.warn(
                                "Preparar Assinar: falha ao baixar {} ({}/{}): {}",
                                nome,
                                cod,
                                proc,
                                e.getMessage());
                    }
                }
            } catch (Exception e) {
                log.warn("Preparar Assinar: falha no Drive ({}/{}): {}", cod, proc, e.getMessage());
                semArquivos = true;
                resumos.add(new ResumoProcessoPrepararAssinar(cnj, cod, 0, 0, 0, true));
                continue;
            }

            if (pdfs.isEmpty()) {
                semArquivos = true;
                resumos.add(new ResumoProcessoPrepararAssinar(cnj, cod, 0, 0, 0, true));
                continue;
            }

            String cnjDigitos = ProjudiNumeroReduzidoUtil.somenteDigitos(cnj);
            List<ArquivoParaAssinar> paraRegistrar = new ArrayList<>();

            for (PdfDriveItem pdf : pdfs) {
                String sha256 = ProjudiAssinaturaP7sUtil.sha256(pdf.bytes());
                DedupResultado dedup = classificarDedup(sha256, cnjDigitos);
                if (dedup.shouldIgnore()) {
                    ignoradasJaAssinadas++;
                    continue;
                }
                paraRegistrar.add(new ArquivoParaAssinar(
                        pdf.bytes(), inferirIdArquivoTipo(pdf.nomeOriginal()), pdf.nomeOriginal()));
            }

            if (!paraRegistrar.isEmpty()) {
                ProjudiPeticaoEntity peticao =
                        peticaoRegistroService.registrarPeticao(credencialId, cnj, null, paraRegistrar);
                peticaoIds.add(peticao.getId());
                registradas += paraRegistrar.size();
                totalArquivos += paraRegistrar.size();
            }

            resumos.add(new ResumoProcessoPrepararAssinar(
                    cnj, cod, registradas, reutilizadas, ignoradasJaAssinadas, semArquivos));
        }

        if (peticaoIds.isEmpty() || totalArquivos == 0) {
            long semArquivosDrive =
                    resumos.stream().filter(ResumoProcessoPrepararAssinar::semArquivos).count();
            if (semArquivosDrive == resumos.size()) {
                throw new BusinessRuleException(
                        "Nenhum PDF na pasta «Assinar» do Google Drive nos "
                                + resumos.size()
                                + " processo(s) listados. Coloque os PDFs na subpasta «Assinar» de cada processo "
                                + "(não use Petição, Movimentações ou outras pastas) e tente novamente.");
            }
            long ignoradas = resumos.stream().mapToLong(ResumoProcessoPrepararAssinar::ignoradasJaAssinadas).sum();
            if (ignoradas > 0) {
                throw new BusinessRuleException(
                        "Nenhum PDF disponível para nova assinatura. "
                                + ignoradas
                                + " arquivo(s) já constam como protocolados no PROJUDI e não podem ser refeitos. "
                                + "Substitua os PDFs na pasta «Assinar» por versões novas (conteúdo diferente) ou "
                                + "retire os já protocolados do lote.");
            }
            throw new BusinessRuleException(
                    "Nenhum PDF pendente para assinar. Verifique a pasta «Assinar» no Drive e tente novamente.");
        }

        return new PrepararAssinarResultado(new ArrayList<>(peticaoIds), resumos, totalArquivos);
    }

    @Transactional(readOnly = true)
    public byte[] gerarZipDoLote(List<Long> peticaoIds) {
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            throw new BusinessRuleException("peticaoIds é obrigatório.");
        }

        List<ProjudiPeticaoArquivoEntity> pendentes =
                arquivoRepository.findByStatusAndPeticaoIdIn(STATUS_ARQUIVO_PENDENTE, peticaoIds);
        if (pendentes.isEmpty()) {
            throw new BusinessRuleException(
                    "Nenhum PDF pendente na fila PROJUDI para este lote. "
                            + "Os arquivos podem já ter sido assinados ou protocolados — use «Preparar e baixar ZIP» "
                            + "de novo após colocar novos PDFs na pasta «Assinar».");
        }

        List<Map<String, Object>> manifestArquivos = new ArrayList<>();

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ZipOutputStream zip = new ZipOutputStream(baos)) {

            for (ProjudiPeticaoArquivoEntity arquivo : pendentes) {
                Path pdfPath = storeDir.resolve(arquivo.getPdfRef());
                if (!Files.isRegularFile(pdfPath)) {
                    Long peticaoId =
                            arquivo.getPeticao() != null ? arquivo.getPeticao().getId() : null;
                    throw new BusinessRuleException(
                            "PDF da petição"
                                    + (peticaoId != null ? " #" + peticaoId : "")
                                    + " não está no servidor. Clique em «Preparar e baixar ZIP» de novo "
                                    + "para buscar os PDFs no Drive; se o erro repetir, contacte o suporte.");
                }
                byte[] pdfBytes = Files.readAllBytes(pdfPath);
                String entryName = Path.of(arquivo.getPdfRef()).getFileName().toString();
                zip.putNextEntry(new ZipEntry(entryName));
                zip.write(pdfBytes);
                zip.closeEntry();

                ProjudiPeticaoEntity peticao = arquivo.getPeticao();
                Map<String, Object> linha = new LinkedHashMap<>();
                linha.put("peticaoId", peticao.getId());
                linha.put("ordem", arquivo.getOrdem());
                linha.put("cnj", peticao.getNumeroProcesso());
                linha.put("codigoCliente", resolverCodigoClientePorCnj(peticao.getNumeroProcesso()));
                linha.put("nomeOriginalDrive", arquivo.getNomeOriginal());
                linha.put("sha256", arquivo.getPdfSha256());
                manifestArquivos.add(linha);
            }

            Map<String, Object> manifest = new LinkedHashMap<>();
            manifest.put(
                    "observacao", "informativo; o pareamento é por hash, nao por nome");
            manifest.put("arquivos", manifestArquivos);

            byte[] manifestBytes = objectMapper.writerWithDefaultPrettyPrinter().writeValueAsBytes(manifest);
            zip.putNextEntry(new ZipEntry("manifest.json"));
            zip.write(manifestBytes);
            zip.closeEntry();
            zip.finish();
            return baos.toByteArray();
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            log.warn("Falha ao gerar ZIP do lote (diagnóstico): {}", e.getMessage());
            throw new BusinessRuleException("Falha ao gerar ZIP: " + e.getMessage());
        }
    }

    @Transactional
    public DiagnosticoUploadAssinadosResponse registrarAssinados(List<MultipartFile> arquivosP7s) {
        if (arquivosP7s == null || arquivosP7s.isEmpty()) {
            throw new BusinessRuleException("Envie ao menos um arquivo .p7s assinado.");
        }

        List<ArquivoAssinadoRecebido> itens = new ArrayList<>();
        for (MultipartFile mf : arquivosP7s) {
            if (mf == null || mf.isEmpty()) {
                continue;
            }
            String nome = mf.getOriginalFilename() != null ? mf.getOriginalFilename() : mf.getName();
            if (!nome.toLowerCase().endsWith(".p7s")) {
                throw new BusinessRuleException("Apenas arquivos .p7s são aceitos: " + nome);
            }
            try {
                itens.add(new ArquivoAssinadoRecebido(nome, mf.getBytes()));
            } catch (Exception e) {
                throw new BusinessRuleException("Falha ao ler arquivo «" + nome + "»: " + e.getMessage());
            }
        }
        if (itens.isEmpty()) {
            throw new BusinessRuleException("Nenhum .p7s válido para registrar.");
        }

        List<ItemAssinado> resultados = peticaoAssinaturaService.receberAssinados(itens);

        int pareadas = 0;
        int jaAssinadas = 0;
        List<String> naoPareadas = new ArrayList<>();
        List<String> ambiguas = new ArrayList<>();
        List<String> invalidas = new ArrayList<>();
        List<String> semConteudo = new ArrayList<>();
        Set<Long> peticoesPareadas = new LinkedHashSet<>();

        for (ItemAssinado item : resultados) {
            String nome = item.nomeEnviado() != null ? item.nomeEnviado() : "";
            switch (item.resultado()) {
                case PAREADO -> {
                    pareadas++;
                    if (item.peticaoId() != null) {
                        peticoesPareadas.add(item.peticaoId());
                    }
                }
                case JA_ASSINADO -> jaAssinadas++;
                case NAO_PAREADO -> naoPareadas.add(nome);
                case AMBIGUO -> ambiguas.add(nome);
                case INVALIDO -> invalidas.add(nome);
                case SEM_CONTEUDO -> semConteudo.add(nome);
            }
        }

        int peticoesQueViraramAssinadas = 0;
        for (Long peticaoId : peticoesPareadas) {
            boolean assinada = peticaoRepository
                    .findById(peticaoId)
                    .map(ProjudiPeticaoEntity::getStatus)
                    .filter(STATUS_PETICAO_ASSINADA::equals)
                    .isPresent();
            if (assinada) {
                peticoesQueViraramAssinadas++;
            }
        }

        return new DiagnosticoUploadAssinadosResponse(
                pareadas,
                jaAssinadas,
                naoPareadas,
                ambiguas,
                invalidas,
                semConteudo,
                peticoesQueViraramAssinadas);
    }

    /**
     * Diagnóstico «Preparar Assinar»: descarta registros anteriores (pendentes ou assinados na fila)
     * do mesmo PDF+processo para sempre re-baixar do Drive e gerar nomes canônicos novos.
     * Só mantém bloqueio quando já protocolado no PROJUDI.
     */
    private void descartarRegistrosAnterioresMesmoPdf(String sha256, String cnjDigitos) {
        List<ProjudiPeticaoArquivoEntity> existentes =
                arquivoRepository.findAllByPdfSha256WithPeticao(sha256);
        Set<Long> peticoesDescartadas = new HashSet<>();
        for (ProjudiPeticaoArquivoEntity arq : existentes) {
            ProjudiPeticaoEntity peticao = arq.getPeticao();
            if (peticao == null || peticao.getId() == null || !cnjCoincide(peticao.getNumeroProcesso(), cnjDigitos)) {
                continue;
            }
            String petStatus = peticao.getStatus();
            if (STATUS_PETICAO_PROTOCOLANDO.equals(petStatus) || STATUS_PETICAO_PROTOCOLADA.equals(petStatus)) {
                continue;
            }
            if (!peticoesDescartadas.add(peticao.getId())) {
                continue;
            }
            try {
                peticaoRegistroService.excluirPeticao(peticao.getId());
                log.info(
                        "Preparar Assinar: descartado registro anterior petição #{} (CNJ {}, hash {}…)",
                        peticao.getId(),
                        cnjDigitos,
                        sha256.substring(0, 8));
            } catch (Exception e) {
                log.warn(
                        "Preparar Assinar: falha ao descartar petição #{}: {}",
                        peticao.getId(),
                        e.getMessage());
            }
        }
    }

    private DedupResultado classificarDedup(String sha256, String cnjDigitos) {
        descartarRegistrosAnterioresMesmoPdf(sha256, cnjDigitos);
        List<ProjudiPeticaoArquivoEntity> existentes =
                arquivoRepository.findAllByPdfSha256WithPeticao(sha256);
        for (ProjudiPeticaoArquivoEntity arq : existentes) {
            ProjudiPeticaoEntity peticao = arq.getPeticao();
            if (peticao == null || !cnjCoincide(peticao.getNumeroProcesso(), cnjDigitos)) {
                continue;
            }
            String petStatus = peticao.getStatus();
            if (STATUS_PETICAO_PROTOCOLANDO.equals(petStatus)
                    || STATUS_PETICAO_PROTOCOLADA.equals(petStatus)) {
                return DedupResultado.ignorar();
            }
        }
        return DedupResultado.novo();
    }

    private static boolean cnjCoincide(String numeroProcesso, String cnjDigitos) {
        if (!StringUtils.hasText(numeroProcesso) || !StringUtils.hasText(cnjDigitos)) {
            return false;
        }
        return ProjudiNumeroReduzidoUtil.somenteDigitos(numeroProcesso).equals(cnjDigitos);
    }

    private String resolverCodigoClientePorCnj(String cnj) {
        if (!StringUtils.hasText(cnj)) {
            return "";
        }
        return processoRepository.findByNumeroCnj(cnj.trim())
                .map(documentoDrivePastaService::resolverCodigoClienteDoProcesso)
                .filter(StringUtils::hasText)
                .orElse("");
    }

    private String resolverCnj(DiagnosticoAguardandoProtocoloItemRequest item, String codigo, Integer proc) {
        if (StringUtils.hasText(item.getNumeroProcessoNovo())) {
            return item.getNumeroProcessoNovo().trim();
        }
        if (!StringUtils.hasText(codigo) || proc == null) {
            return null;
        }
        return processoApplicationService
                .buscarPorCodigoClienteENumeroInterno(codigo, proc)
                .map(ProcessoResponse::getNumeroCnj)
                .filter(StringUtils::hasText)
                .map(String::trim)
                .orElse(null);
    }

    private static String normalizarCodigo(String raw) {
        if (!StringUtils.hasText(raw)) {
            return null;
        }
        String d = raw.replaceAll("\\D", "");
        if (d.isEmpty()) {
            return null;
        }
        long n = Long.parseLong(d);
        return String.format("%08d", n);
    }

    private static int inferirIdArquivoTipo(String nomeOriginal) {
        String n = Normalizer.normalize(String.valueOf(nomeOriginal), Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "")
                .toLowerCase();
        if (n.contains("calculo")) {
            return 1;
        }
        return 16;
    }

    private record PdfDriveItem(String nomeOriginal, byte[] bytes) {}

    private record DedupResultado(boolean shouldIgnore) {
        static DedupResultado ignorar() {
            return new DedupResultado(true);
        }

        static DedupResultado novo() {
            return new DedupResultado(false);
        }
    }
}
