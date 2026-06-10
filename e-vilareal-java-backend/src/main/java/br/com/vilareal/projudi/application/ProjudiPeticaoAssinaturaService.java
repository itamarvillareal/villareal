package br.com.vilareal.projudi.application;

import br.com.vilareal.projudi.ProjudiAssinaturaP7sUtil;
import br.com.vilareal.projudi.ProjudiAssinaturaP7sUtil.ValidacaoP7s;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoArquivoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiPeticaoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoArquivoRepository;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiPeticaoRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.List;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class ProjudiPeticaoAssinaturaService {

    static final String STATUS_ARQUIVO_PENDENTE = "PENDENTE_ASSINATURA";
    static final String STATUS_ARQUIVO_ASSINADO = "ASSINADO";
    static final String STATUS_PETICAO_ASSINADA = "ASSINADA";

    private final ProjudiPeticaoArquivoRepository arquivoRepository;
    private final ProjudiPeticaoRepository peticaoRepository;
    private final Path storeDir;

    public ProjudiPeticaoAssinaturaService(
            ProjudiPeticaoArquivoRepository arquivoRepository,
            ProjudiPeticaoRepository peticaoRepository,
            @Value("${projudi.peticao.store-dir:/Users/itamar/projudi-peticoes}") String storeDirConfig) {
        this.arquivoRepository = arquivoRepository;
        this.peticaoRepository = peticaoRepository;
        this.storeDir = Path.of(storeDirConfig.trim());
    }

    public enum ResultadoPareamento {
        PAREADO,
        NAO_PAREADO,
        AMBIGUO,
        JA_ASSINADO,
        INVALIDO,
        SEM_CONTEUDO
    }

    public record ArquivoAssinadoRecebido(String nome, byte[] p7sBytes) {}

    public record ItemAssinado(
            String nomeEnviado,
            ResultadoPareamento resultado,
            Long peticaoId,
            Integer ordem,
            String motivo) {}

    @Transactional
    public List<ItemAssinado> receberAssinados(List<ArquivoAssinadoRecebido> arquivos) {
        if (arquivos == null || arquivos.isEmpty()) {
            throw new IllegalArgumentException("arquivos é obrigatório (ao menos um .p7s).");
        }

        List<ItemAssinado> resultados = new ArrayList<>(arquivos.size());
        for (ArquivoAssinadoRecebido item : arquivos) {
            resultados.add(processarArquivoAssinado(item));
        }
        return resultados;
    }

    @Transactional(readOnly = true)
    public byte[] gerarZipLoteParaAssinar() {
        List<ProjudiPeticaoArquivoEntity> pendentes =
                arquivoRepository.findByStatus(STATUS_ARQUIVO_PENDENTE);

        try (ByteArrayOutputStream baos = new ByteArrayOutputStream();
                ZipOutputStream zip = new ZipOutputStream(baos)) {
            for (ProjudiPeticaoArquivoEntity arquivo : pendentes) {
                Path pdfPath = storeDir.resolve(arquivo.getPdfRef());
                if (!Files.isRegularFile(pdfPath)) {
                    throw new IllegalStateException("PDF não encontrado no store-dir: " + pdfPath);
                }
                byte[] pdfBytes = Files.readAllBytes(pdfPath);
                String entryName = Path.of(arquivo.getPdfRef()).getFileName().toString();
                zip.putNextEntry(new ZipEntry(entryName));
                zip.write(pdfBytes);
                zip.closeEntry();
            }
            zip.finish();
            return baos.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao gerar ZIP de lote para assinar", e);
        }
    }

    private ItemAssinado processarArquivoAssinado(ArquivoAssinadoRecebido item) {
        String nome = item.nome() != null ? item.nome() : "";
        byte[] p7sBytes = item.p7sBytes();
        if (p7sBytes == null || p7sBytes.length == 0) {
            return new ItemAssinado(nome, ResultadoPareamento.INVALIDO, null, null, "bytes vazios");
        }

        ValidacaoP7s validacao = ProjudiAssinaturaP7sUtil.validar(p7sBytes);
        if (!validacao.cmsValido()) {
            return new ItemAssinado(
                    nome, ResultadoPareamento.INVALIDO, null, null, validacao.motivo());
        }
        if (!validacao.temConteudoEmbutido()) {
            return new ItemAssinado(
                    nome, ResultadoPareamento.SEM_CONTEUDO, null, null, validacao.motivo());
        }
        if (!validacao.assinaturaConsistente()) {
            return new ItemAssinado(
                    nome, ResultadoPareamento.INVALIDO, null, null, validacao.motivo());
        }

        String sha = validacao.sha256ConteudoEmbutido();
        List<ProjudiPeticaoArquivoEntity> pendentes =
                arquivoRepository.findByPdfSha256AndStatus(sha, STATUS_ARQUIVO_PENDENTE);
        List<ProjudiPeticaoArquivoEntity> jaAssinados =
                arquivoRepository.findByPdfSha256AndStatus(sha, STATUS_ARQUIVO_ASSINADO);

        if (pendentes.isEmpty()) {
            if (!jaAssinados.isEmpty()) {
                ProjudiPeticaoArquivoEntity ref = jaAssinados.getFirst();
                return new ItemAssinado(
                        nome,
                        ResultadoPareamento.JA_ASSINADO,
                        ref.getPeticao().getId(),
                        ref.getOrdem(),
                        "hash já vinculado a arquivo assinado");
            }
            return new ItemAssinado(
                    nome,
                    ResultadoPareamento.NAO_PAREADO,
                    null,
                    null,
                    "hash não corresponde a arquivo pendente");
        }
        if (pendentes.size() > 1) {
            return new ItemAssinado(
                    nome,
                    ResultadoPareamento.AMBIGUO,
                    null,
                    null,
                    "mais de um arquivo pendente com o mesmo hash");
        }

        ProjudiPeticaoArquivoEntity arquivo = pendentes.getFirst();
        ProjudiPeticaoEntity peticao = arquivo.getPeticao();
        Long peticaoId = peticao.getId();
        int ordem = arquivo.getOrdem();

        String p7sRef = peticaoId + "_" + ordem + "_assinado.p7s";
        Path destinoP7s = storeDir.resolve(p7sRef);
        try {
            Files.createDirectories(storeDir);
            Files.write(destinoP7s, p7sBytes);
        } catch (IOException e) {
            throw new IllegalStateException("Falha ao gravar .p7s: " + destinoP7s, e);
        }

        arquivo.setP7sRef(p7sRef);
        arquivo.setP7sSha256(ProjudiAssinaturaP7sUtil.sha256(p7sBytes));
        arquivo.setConteudoAssinadoSha256(sha);
        arquivo.setStatus(STATUS_ARQUIVO_ASSINADO);
        arquivoRepository.save(arquivo);

        atualizarStatusPeticaoSeCompleta(peticao);

        return new ItemAssinado(nome, ResultadoPareamento.PAREADO, peticaoId, ordem, null);
    }

    private void atualizarStatusPeticaoSeCompleta(ProjudiPeticaoEntity peticao) {
        boolean todosAssinados = peticao.getArquivos().stream()
                .allMatch(a -> STATUS_ARQUIVO_ASSINADO.equals(a.getStatus()));
        if (todosAssinados && StringUtils.hasText(peticao.getStatus())) {
            peticao.setStatus(STATUS_PETICAO_ASSINADA);
            peticaoRepository.save(peticao);
        }
    }
}
