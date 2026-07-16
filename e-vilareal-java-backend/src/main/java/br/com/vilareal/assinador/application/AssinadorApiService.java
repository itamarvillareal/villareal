package br.com.vilareal.assinador.application;

import br.com.vilareal.assinador.api.dto.AssinadorArquivoResponse;
import br.com.vilareal.assinador.api.dto.AssinadorConcluirResponse;
import br.com.vilareal.assinador.api.dto.AssinadorLotePendenteResponse;
import br.com.vilareal.assinador.domain.AssinaturaLoteStatus;
import br.com.vilareal.assinador.infrastructure.persistence.entity.AssinaturaLoteEntity;
import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService.ArquivoAssinadoRecebido;
import br.com.vilareal.projudi.application.ProjudiPeticaoAssinaturaService.ItemAssinado;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoArquivoRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.node.ArrayNode;
import com.fasterxml.jackson.databind.node.ObjectNode;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

@Service
public class AssinadorApiService {

    private static final String STATUS_ARQUIVO_PENDENTE = "PENDENTE_ASSINATURA";

    private final AssinaturaLoteService assinaturaLoteService;
    private final ProjudiPeticaoAssinaturaService peticaoAssinaturaService;
    private final ProjudiPeticaoArquivoRepository arquivoRepository;
    private final ObjectMapper objectMapper;
    private final Path storeDir;

    public AssinadorApiService(
            AssinaturaLoteService assinaturaLoteService,
            ProjudiPeticaoAssinaturaService peticaoAssinaturaService,
            ProjudiPeticaoArquivoRepository arquivoRepository,
            ObjectMapper objectMapper,
            @Value("${projudi.peticao.store-dir:/Users/itamar/projudi-peticoes}") String storeDirConfig) {
        this.assinaturaLoteService = assinaturaLoteService;
        this.peticaoAssinaturaService = peticaoAssinaturaService;
        this.arquivoRepository = arquivoRepository;
        this.objectMapper = objectMapper;
        this.storeDir = Path.of(storeDirConfig.trim());
    }

    @Transactional
    public Optional<AssinadorLotePendenteResponse> tentarClaimProximoLote(String assinadorId) {
        return assinaturaLoteService
                .pegarProximoLotePendente(assinadorId)
                .map(this::montarRespostaLote);
    }

    @Transactional(readOnly = true)
    public byte[] obterPdfDoLote(Long loteId, Long arquivoId, String assinadorId) {
        AssinaturaLoteEntity lote = assinaturaLoteService.exigirLoteEmAssinaturaDoAssinador(loteId, assinadorId);
        ProjudiPeticaoArquivoEntity arquivo = carregarArquivoDoLote(arquivoId, lote);
        Path pdfPath = storeDir.resolve(arquivo.getPdfRef());
        if (!Files.isRegularFile(pdfPath)) {
            throw new BusinessRuleException(
                    "PDF não encontrado no servidor para arquivo #" + arquivoId + ". Re-prepare o lote na API.");
        }
        try {
            return Files.readAllBytes(pdfPath);
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao ler PDF: " + pdfPath, e);
        }
    }

    @Transactional(readOnly = true)
    public String nomePdfParaDownload(Long loteId, Long arquivoId, String assinadorId) {
        AssinaturaLoteEntity lote = assinaturaLoteService.exigirLoteEmAssinaturaDoAssinador(loteId, assinadorId);
        ProjudiPeticaoArquivoEntity arquivo = carregarArquivoDoLote(arquivoId, lote);
        return AssinadorNomeCanonicoUtil.nomePdf(arquivo);
    }

    @Transactional
    public AssinadorConcluirResponse concluirLote(
            Long loteId, String assinadorId, List<MultipartFile> arquivosP7s) {
        AssinaturaLoteEntity lote = assinaturaLoteService.exigirLoteEmAssinaturaDoAssinador(loteId, assinadorId);
        List<ProjudiPeticaoArquivoEntity> pendentes = listarArquivosPendentesDoLote(lote);
        if (pendentes.isEmpty()) {
            throw new BusinessRuleException("Nenhum arquivo pendente de assinatura neste lote.");
        }

        List<ArquivoAssinadoRecebido> recebidos = converterP7s(arquivosP7s, pendentes.size());
        List<ItemAssinado> itens = peticaoAssinaturaService.receberAssinados(recebidos, false, lote.getPeticaoIds());

        ObjectNode resultado = objectMapper.createObjectNode();
        ArrayNode detalhes = resultado.putArray("itens");
        int pareadas = 0;
        for (ItemAssinado item : itens) {
            ObjectNode linha = detalhes.addObject();
            linha.put("nomeEnviado", item.nomeEnviado());
            linha.put("resultado", item.resultado().name());
            if (item.peticaoId() != null) {
                linha.put("peticaoId", item.peticaoId());
            }
            if (item.ordem() != null) {
                linha.put("ordem", item.ordem());
            }
            if (item.motivo() != null) {
                linha.put("motivo", item.motivo());
            }
            if (item.resultado() == ProjudiPeticaoAssinaturaService.ResultadoPareamento.PAREADO) {
                pareadas++;
            }
        }
        resultado.put("pareadas", pareadas);
        resultado.put("totalEnviados", recebidos.size());

        long naoPareadas = itens.stream()
                .filter(i -> i.resultado() != ProjudiPeticaoAssinaturaService.ResultadoPareamento.PAREADO)
                .count();
        if (naoPareadas > 0) {
            throw new BusinessRuleException(
                    "Alguns .p7s não foram pareados (" + naoPareadas + " de " + recebidos.size() + "). "
                            + "Verifique os arquivos e tente novamente.");
        }

        assinaturaLoteService.concluirLote(loteId, resultado);
        return new AssinadorConcluirResponse(
                loteId, AssinaturaLoteStatus.CONCLUIDO.name(), pareadas, recebidos.size(), resultado);
    }

    @Transactional
    public void registrarFalha(Long loteId, String assinadorId, String codigo, String mensagem) {
        AssinaturaLoteEntity lote = assinaturaLoteService.exigirLoteEmAssinaturaDoAssinador(loteId, assinadorId);
        peticaoAssinaturaService.reverterAssinaturaIncompletaDoLote(lote.getPeticaoIds());
        assinaturaLoteService.falharLote(loteId, codigo, mensagem);
    }

    private AssinadorLotePendenteResponse montarRespostaLote(AssinaturaLoteEntity lote) {
        List<ProjudiPeticaoArquivoEntity> arquivos = listarArquivosPendentesDoLote(lote);
        List<AssinadorArquivoResponse> dtos = new ArrayList<>(arquivos.size());
        for (ProjudiPeticaoArquivoEntity arquivo : arquivos) {
            dtos.add(new AssinadorArquivoResponse(
                    arquivo.getId(),
                    arquivo.getPeticao().getId(),
                    arquivo.getOrdem(),
                    AssinadorNomeCanonicoUtil.nomePdf(arquivo),
                    AssinadorNomeCanonicoUtil.nomeP7sEsperado(arquivo),
                    arquivo.getPdfSha256()));
        }
        return new AssinadorLotePendenteResponse(lote.getId(), lote.getCredencialId(), dtos);
    }

    private List<ProjudiPeticaoArquivoEntity> listarArquivosPendentesDoLote(AssinaturaLoteEntity lote) {
        return arquivoRepository.findByStatusAndPeticaoIdIn(STATUS_ARQUIVO_PENDENTE, lote.getPeticaoIds());
    }

    private ProjudiPeticaoArquivoEntity carregarArquivoDoLote(Long arquivoId, AssinaturaLoteEntity lote) {
        ProjudiPeticaoArquivoEntity arquivo = arquivoRepository
                .findByIdWithPeticao(arquivoId)
                .orElseThrow(() -> new BusinessRuleException("Arquivo #" + arquivoId + " não encontrado."));
        if (arquivo.getPeticao() == null || arquivo.getPeticao().getId() == null) {
            throw new BusinessRuleException("Arquivo #" + arquivoId + " sem petição vinculada.");
        }
        if (!lote.getPeticaoIds().contains(arquivo.getPeticao().getId())) {
            throw new BusinessRuleException("Arquivo #" + arquivoId + " não pertence ao lote #" + lote.getId() + ".");
        }
        if (!STATUS_ARQUIVO_PENDENTE.equals(arquivo.getStatus())) {
            throw new BusinessRuleException("Arquivo #" + arquivoId + " não está pendente de assinatura.");
        }
        return arquivo;
    }

    private static List<ArquivoAssinadoRecebido> converterP7s(List<MultipartFile> arquivosP7s, int quantidadeEsperada) {
        if (arquivosP7s == null || arquivosP7s.isEmpty()) {
            throw new BusinessRuleException("Envie ao menos um arquivo .p7s em arquivosP7s.");
        }
        List<ArquivoAssinadoRecebido> recebidos = new ArrayList<>();
        Set<String> enviados = new HashSet<>();
        for (MultipartFile mf : arquivosP7s) {
            if (mf == null || mf.isEmpty()) {
                continue;
            }
            String nome = mf.getOriginalFilename() != null ? mf.getOriginalFilename() : mf.getName();
            if (!nome.toLowerCase(Locale.ROOT).endsWith(".p7s")) {
                throw new BusinessRuleException("Apenas arquivos .p7s são aceitos: " + nome);
            }
            String nomeNorm = Path.of(nome).getFileName().toString().toLowerCase(Locale.ROOT);
            if (!enviados.add(nomeNorm)) {
                throw new BusinessRuleException("Arquivo duplicado no envio: " + nome);
            }
            try {
                recebidos.add(new ArquivoAssinadoRecebido(nome, mf.getBytes()));
            } catch (IOException e) {
                throw new BusinessRuleException("Falha ao ler arquivo «" + nome + "»: " + e.getMessage());
            }
        }
        if (recebidos.isEmpty()) {
            throw new BusinessRuleException("Nenhum .p7s válido no envio.");
        }
        if (recebidos.size() != quantidadeEsperada) {
            throw new BusinessRuleException(
                    "Quantidade de .p7s incorreta: enviados " + recebidos.size() + ", esperados " + quantidadeEsperada + ".");
        }
        return recebidos;
    }
}
