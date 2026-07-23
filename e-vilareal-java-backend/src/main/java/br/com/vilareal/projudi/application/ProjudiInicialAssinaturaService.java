package br.com.vilareal.projudi.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.processo.api.dto.AssinarAutomaticoResponse;
import br.com.vilareal.processo.api.dto.DiagnosticoAguardandoProtocoloItemRequest;
import br.com.vilareal.processo.application.DiagnosticoAguardandoProtocoloAssinarService;
import br.com.vilareal.processo.application.DiagnosticoAssinaturaAutomaticaService;
import br.com.vilareal.projudi.api.dto.InicialArquivoAssinadoResponse;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoArquivoRepository;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Assinatura automática de PDFs da pasta «Assinar» para protocolo de inicial (sem CNJ).
 * Usa chave sintética {@code INICIAL-{cod}-{proc}} para não misturar com petições interlocutórias.
 */
@Service
public class ProjudiInicialAssinaturaService {

    private static final Logger log = LoggerFactory.getLogger(ProjudiInicialAssinaturaService.class);

    static final String PREFIXO_CHAVE_INICIAL = "INICIAL-";
    static final String STATUS_PETICAO_ASSINADA = "ASSINADA";
    static final String STATUS_ARQUIVO_ASSINADO = "ASSINADO";

    private final DiagnosticoAssinaturaAutomaticaService assinaturaAutomaticaService;
    private final ProjudiPeticaoRepository peticaoRepository;
    private final ProjudiPeticaoArquivoRepository arquivoRepository;
    private final ProjudiPeticaoRegistroService peticaoRegistroService;
    private final Path storeDir;

    public ProjudiInicialAssinaturaService(
            DiagnosticoAssinaturaAutomaticaService assinaturaAutomaticaService,
            ProjudiPeticaoRepository peticaoRepository,
            ProjudiPeticaoArquivoRepository arquivoRepository,
            ProjudiPeticaoRegistroService peticaoRegistroService,
            @Value("${projudi.peticao.store-dir:/Users/itamar/projudi-peticoes}") String storeDirConfig) {
        this.assinaturaAutomaticaService = assinaturaAutomaticaService;
        this.peticaoRepository = peticaoRepository;
        this.arquivoRepository = arquivoRepository;
        this.peticaoRegistroService = peticaoRegistroService;
        this.storeDir = Path.of(storeDirConfig.trim());
    }

    @Transactional
    public AssinarAutomaticoResponse assinarAutomatico(
            Long credencialId, String codigoCliente, Integer numeroInterno) {
        validarProcesso(codigoCliente, numeroInterno);
        DiagnosticoAguardandoProtocoloItemRequest item = new DiagnosticoAguardandoProtocoloItemRequest();
        item.setCodigoCliente(normalizarCodigo(codigoCliente));
        item.setNumeroInterno(numeroInterno);
        item.setNumeroProcessoNovo(chaveNumeroProcessoInicial(codigoCliente, numeroInterno));
        return assinaturaAutomaticaService.assinarAutomatico(credencialId, List.of(item));
    }

    @Transactional
    public AssinarAutomaticoResponse assinarAutomaticoComPdfsLocais(
            Long credencialId,
            String codigoCliente,
            Integer numeroInterno,
            List<MultipartFile> pdfs) {
        validarProcesso(codigoCliente, numeroInterno);
        var pdfsLocais = DiagnosticoAguardandoProtocoloAssinarService.lerPdfsUpload(pdfs);
        DiagnosticoAguardandoProtocoloItemRequest item = new DiagnosticoAguardandoProtocoloItemRequest();
        item.setCodigoCliente(normalizarCodigo(codigoCliente));
        item.setNumeroInterno(numeroInterno);
        item.setNumeroProcessoNovo(chaveNumeroProcessoInicial(codigoCliente, numeroInterno));
        return assinaturaAutomaticaService.assinarAutomaticoComPdfsLocais(credencialId, item, pdfsLocais);
    }

    @Transactional(readOnly = true)
    public List<InicialArquivoAssinadoResponse> listarArquivosAssinados(
            String codigoCliente, Integer numeroInterno) {
        return listarArquivosAssinados(codigoCliente, numeroInterno, null);
    }

    @Transactional(readOnly = true)
    public List<InicialArquivoAssinadoResponse> listarArquivosAssinados(
            String codigoCliente, Integer numeroInterno, Long peticaoId) {
        validarProcesso(codigoCliente, numeroInterno);
        String chave = chaveNumeroProcessoInicial(codigoCliente, numeroInterno);
        List<ProjudiPeticaoEntity> peticoes;
        if (peticaoId != null) {
            peticoes = peticaoRepository
                    .findById(peticaoId)
                    .filter(p -> chave.equals(p.getNumeroProcesso()))
                    .map(List::of)
                    .orElse(List.of());
        } else {
            // Todas as petições ASSINADA da inicial — a lista de protocolo precisa dos .p7s
            // mesmo quando houve mais de uma assinatura parcial.
            peticoes = peticaoRepository.findByNumeroProcessoWithArquivos(chave).stream()
                    .filter(p -> STATUS_PETICAO_ASSINADA.equals(p.getStatus()))
                    .sorted(Comparator.comparing(ProjudiPeticaoEntity::getCriadoEm).reversed())
                    .toList();
        }
        if (peticoes.isEmpty()) {
            return List.of();
        }
        // Preferência: arquivo mais recente com o mesmo nome original (evita duplicata).
        Map<String, InicialArquivoAssinadoResponse> porNome = new LinkedHashMap<>();
        for (ProjudiPeticaoEntity peticaoBase : peticoes) {
            ProjudiPeticaoEntity peticao = peticaoRepository
                    .findByIdWithArquivos(peticaoBase.getId())
                    .orElse(peticaoBase);
            for (ProjudiPeticaoArquivoEntity arquivo : peticao.getArquivos()) {
                if (arquivo == null || !STATUS_ARQUIVO_ASSINADO.equals(arquivo.getStatus())) {
                    continue;
                }
                if (!StringUtils.hasText(arquivo.getP7sRef())
                        || !Files.isRegularFile(storeDir.resolve(arquivo.getP7sRef()))) {
                    continue;
                }
                String nomeOriginal = StringUtils.hasText(arquivo.getNomeOriginal())
                        ? arquivo.getNomeOriginal().trim()
                        : ("arquivo-" + arquivo.getId());
                String chaveNome = nomeOriginal.toLowerCase(Locale.ROOT);
                if (porNome.containsKey(chaveNome)) {
                    continue;
                }
                String nomeP7s = Path.of(arquivo.getP7sRef()).getFileName().toString();
                porNome.put(
                        chaveNome,
                        new InicialArquivoAssinadoResponse(
                                arquivo.getId(),
                                peticao.getId(),
                                arquivo.getOrdem(),
                                arquivo.getIdArquivoTipo() > 0 ? arquivo.getIdArquivoTipo() : 1,
                                nomeOriginal,
                                nomeP7s));
            }
        }
        List<InicialArquivoAssinadoResponse> out = new ArrayList<>(porNome.values());
        out.sort(Comparator.comparing(
                        (InicialArquivoAssinadoResponse a) -> String.valueOf(a.nomeOriginal()),
                        String.CASE_INSENSITIVE_ORDER)
                .thenComparingInt(InicialArquivoAssinadoResponse::ordem));
        return List.copyOf(out);
    }

    @Transactional(readOnly = true)
    public byte[] baixarP7s(Long arquivoId, String codigoCliente, Integer numeroInterno) {
        validarProcesso(codigoCliente, numeroInterno);
        if (arquivoId == null) {
            throw new BusinessRuleException("arquivoId é obrigatório.");
        }
        String chave = chaveNumeroProcessoInicial(codigoCliente, numeroInterno);
        ProjudiPeticaoArquivoEntity arquivo = arquivoRepository
                .findById(arquivoId)
                .orElseThrow(() -> new ResourceNotFoundException("Arquivo não encontrado: " + arquivoId));
        ProjudiPeticaoEntity peticao = arquivo.getPeticao();
        if (peticao == null || !chave.equals(peticao.getNumeroProcesso())) {
            throw new BusinessRuleException("Arquivo não pertence à inicial deste processo.");
        }
        if (!STATUS_ARQUIVO_ASSINADO.equals(arquivo.getStatus()) || !StringUtils.hasText(arquivo.getP7sRef())) {
            throw new BusinessRuleException("Arquivo ainda não está assinado.");
        }
        try {
            Path path = storeDir.resolve(arquivo.getP7sRef());
            if (!Files.isRegularFile(path)) {
                throw new BusinessRuleException(".p7s não encontrado no servidor.");
            }
            return Files.readAllBytes(path);
        } catch (BusinessRuleException e) {
            throw e;
        } catch (Exception e) {
            throw new BusinessRuleException("Falha ao ler .p7s: " + e.getMessage());
        }
    }

    @Transactional
    public void excluirPeticaoFila(Long peticaoId, String codigoCliente, Integer numeroInterno) {
        validarProcesso(codigoCliente, numeroInterno);
        exigirPeticaoPertenceInicial(peticaoId, codigoCliente, numeroInterno);
        peticaoRegistroService.excluirPeticaoInicialDistribuicao(peticaoId);
    }

    /**
     * Remove todas as petições {@code INICIAL-…} do processo (ASSINADA, pendente, erro, etc.)
     * para liberar reassinatura após falha no protocolo/distribuição.
     *
     * @return quantidade de petições excluídas
     */
    @Transactional
    public int limparFilaAssinaturaInicial(String codigoCliente, Integer numeroInterno) {
        validarProcesso(codigoCliente, numeroInterno);
        String chave = chaveNumeroProcessoInicial(codigoCliente, numeroInterno);
        List<ProjudiPeticaoEntity> peticoes = peticaoRepository.findByNumeroProcessoWithArquivos(chave);
        int removidas = 0;
        for (ProjudiPeticaoEntity peticao : peticoes) {
            if (peticao == null || peticao.getId() == null) {
                continue;
            }
            peticaoRegistroService.excluirPeticaoInicialDistribuicao(peticao.getId());
            removidas++;
        }
        if (removidas > 0) {
            log.info(
                    "Fila de assinatura da inicial limpa (chave={}, peticoesRemovidas={})",
                    chave,
                    removidas);
        }
        return removidas;
    }

    @Transactional
    public void excluirArquivoFila(Long peticaoId, Long arquivoId, String codigoCliente, Integer numeroInterno) {
        validarProcesso(codigoCliente, numeroInterno);
        exigirPeticaoPertenceInicial(peticaoId, codigoCliente, numeroInterno);
        peticaoRegistroService.excluirArquivoInicialDistribuicao(peticaoId, arquivoId);
    }

    private void exigirPeticaoPertenceInicial(Long peticaoId, String codigoCliente, Integer numeroInterno) {
        String chave = chaveNumeroProcessoInicial(codigoCliente, numeroInterno);
        ProjudiPeticaoEntity peticao = peticaoRepository
                .findById(peticaoId)
                .orElseThrow(() -> new ResourceNotFoundException("Petição não encontrada: " + peticaoId));
        if (!chave.equals(peticao.getNumeroProcesso())) {
            throw new BusinessRuleException("Petição #" + peticaoId + " não pertence à inicial deste processo.");
        }
        if (!ehChaveInicialDistribuicao(peticao.getNumeroProcesso())) {
            throw new BusinessRuleException("Petição #" + peticaoId + " não é de distribuição de inicial.");
        }
    }

    public static String chaveNumeroProcessoInicial(String codigoCliente, Integer numeroInterno) {
        String cod = normalizarCodigo(codigoCliente);
        if (!StringUtils.hasText(cod) || numeroInterno == null) {
            throw new BusinessRuleException("codigoCliente e numeroInterno são obrigatórios.");
        }
        return PREFIXO_CHAVE_INICIAL + cod + "-" + numeroInterno;
    }

    /** Chave interna {@code INICIAL-…} — não é CNJ; não deve ir para Peticionamento PROJUDI. */
    public static boolean ehChaveInicialDistribuicao(String numeroProcesso) {
        if (!StringUtils.hasText(numeroProcesso)) {
            return false;
        }
        return numeroProcesso.trim().toUpperCase(Locale.ROOT).startsWith(PREFIXO_CHAVE_INICIAL);
    }

    public static void exigirNaoEhInicialDistribuicao(String numeroProcesso, Long peticaoId) {
        if (!ehChaveInicialDistribuicao(numeroProcesso)) {
            return;
        }
        String rotulo = numeroProcesso != null ? numeroProcesso.trim() : "?";
        throw new BusinessRuleException(
                "Petição #"
                        + peticaoId
                        + " é de distribuição de inicial ("
                        + rotulo
                        + "). Use Processos → Distribuir Inicial PROJUDI — não Peticionamento PROJUDI.");
    }

    private static void validarProcesso(String codigoCliente, Integer numeroInterno) {
        if (!StringUtils.hasText(normalizarCodigo(codigoCliente)) || numeroInterno == null) {
            throw new BusinessRuleException("codigoCliente e numeroInterno são obrigatórios.");
        }
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
}
