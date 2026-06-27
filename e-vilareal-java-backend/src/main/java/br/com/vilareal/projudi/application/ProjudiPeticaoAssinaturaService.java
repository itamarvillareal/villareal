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
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

@Service
public class ProjudiPeticaoAssinaturaService {

    static final String STATUS_ARQUIVO_PENDENTE = "PENDENTE_ASSINATURA";
    static final String STATUS_ARQUIVO_ASSINADO = "ASSINADO";
    static final String STATUS_PETICAO_ASSINADA = "ASSINADA";

    /** Nome canônico no ZIP: {@code {peticaoId}_{ordem}_{sha8}.pdf} → {@code …pdf.p7s} após assinar. */
    private static final Pattern REF_CANONICA_NOME =
            Pattern.compile("(\\d+)_(\\d+)_([a-f0-9]{8})", Pattern.CASE_INSENSITIVE);

    private final ProjudiPeticaoArquivoRepository arquivoRepository;
    private final ProjudiPeticaoRepository peticaoRepository;
    private final ProjudiPeticaoRegistroService registroService;
    private final Path storeDir;

    public ProjudiPeticaoAssinaturaService(
            ProjudiPeticaoArquivoRepository arquivoRepository,
            ProjudiPeticaoRepository peticaoRepository,
            ProjudiPeticaoRegistroService registroService,
            @Value("${projudi.peticao.store-dir:/Users/itamar/projudi-peticoes}") String storeDirConfig) {
        this.arquivoRepository = arquivoRepository;
        this.peticaoRepository = peticaoRepository;
        this.registroService = registroService;
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

    record RefCanonicaNome(long peticaoId, int ordem, String sha8) {}

    static Optional<RefCanonicaNome> parseRefCanonicaDoNome(String nomeArquivo) {
        if (!StringUtils.hasText(nomeArquivo)) {
            return Optional.empty();
        }
        String base = Path.of(nomeArquivo.trim()).getFileName().toString();
        Matcher m = REF_CANONICA_NOME.matcher(base);
        if (!m.find()) {
            return Optional.empty();
        }
        return Optional.of(new RefCanonicaNome(
                Long.parseLong(m.group(1)), Integer.parseInt(m.group(2)), m.group(3).toLowerCase(Locale.ROOT)));
    }

    @Transactional
    public List<ItemAssinado> receberAssinados(List<ArquivoAssinadoRecebido> arquivos) {
        return receberAssinados(arquivos, false);
    }

    @Transactional
    public List<ItemAssinado> receberAssinados(List<ArquivoAssinadoRecebido> arquivos, boolean substituirConflitos) {
        if (arquivos == null || arquivos.isEmpty()) {
            throw new IllegalArgumentException("arquivos é obrigatório (ao menos um .p7s).");
        }

        List<ItemAssinado> resultados = new ArrayList<>(arquivos.size());
        for (ArquivoAssinadoRecebido item : arquivos) {
            resultados.add(processarArquivoAssinado(item, substituirConflitos));
        }
        return resultados;
    }

    @Transactional(readOnly = true)
    public byte[] gerarZipLoteParaAssinar() {
        return gerarZipLoteParaAssinar(null);
    }

    @Transactional(readOnly = true)
    public byte[] gerarZipLoteParaAssinar(List<Long> peticaoIds) {
        List<ProjudiPeticaoArquivoEntity> pendentes;
        if (peticaoIds == null || peticaoIds.isEmpty()) {
            pendentes = arquivoRepository.findByStatus(STATUS_ARQUIVO_PENDENTE);
        } else {
            pendentes = arquivoRepository.findByStatusAndPeticaoIdIn(STATUS_ARQUIVO_PENDENTE, peticaoIds);
        }

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

    private ItemAssinado processarArquivoAssinado(ArquivoAssinadoRecebido item, boolean substituirConflitos) {
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
        Optional<RefCanonicaNome> refNome = parseRefCanonicaDoNome(nome);
        List<ProjudiPeticaoArquivoEntity> pendentes =
                arquivoRepository.findByPdfSha256AndStatus(sha, STATUS_ARQUIVO_PENDENTE);
        List<ProjudiPeticaoArquivoEntity> jaAssinados =
                arquivoRepository.findByPdfSha256AndStatus(sha, STATUS_ARQUIVO_ASSINADO);

        Optional<ProjudiPeticaoArquivoEntity> alvoPendente =
                escolherArquivo(pendentes, refNome, substituirConflitos);
        if (alvoPendente.isPresent()) {
            ProjudiPeticaoArquivoEntity arquivo = alvoPendente.get();
            gravarAssinaturaNoArquivo(arquivo, p7sBytes, sha);
            descartarPendentesDuplicadosMesmoHash(sha, arquivo);
            return itemPareado(nome, arquivo);
        }

        if (!pendentes.isEmpty()) {
            return new ItemAssinado(
                    nome,
                    ResultadoPareamento.AMBIGUO,
                    null,
                    null,
                    pendentes.size() + " registros pendentes com o mesmo conteúdo — confirme substituição");
        }

        if (substituirConflitos && !jaAssinados.isEmpty()) {
            Optional<ProjudiPeticaoArquivoEntity> alvoAssinado =
                    escolherArquivo(jaAssinados, refNome, true);
            if (alvoAssinado.isPresent()) {
                ProjudiPeticaoArquivoEntity arquivo = alvoAssinado.get();
                gravarAssinaturaNoArquivo(arquivo, p7sBytes, sha);
                return itemPareado(nome, arquivo);
            }
        }

        if (!jaAssinados.isEmpty()) {
            ProjudiPeticaoArquivoEntity ref = jaAssinados.getFirst();
            return new ItemAssinado(
                    nome,
                    ResultadoPareamento.JA_ASSINADO,
                    ref.getPeticao().getId(),
                    ref.getOrdem(),
                    "hash já vinculado a arquivo assinado — confirme substituição se quiser trocar");
        }

        return new ItemAssinado(
                nome,
                ResultadoPareamento.NAO_PAREADO,
                null,
                null,
                "hash não corresponde a arquivo pendente na fila");
    }

    private static ItemAssinado itemPareado(String nome, ProjudiPeticaoArquivoEntity arquivo) {
        ProjudiPeticaoEntity peticao = arquivo.getPeticao();
        return new ItemAssinado(
                nome, ResultadoPareamento.PAREADO, peticao.getId(), arquivo.getOrdem(), null);
    }

    private Optional<ProjudiPeticaoArquivoEntity> escolherArquivo(
            List<ProjudiPeticaoArquivoEntity> candidatos,
            Optional<RefCanonicaNome> refNome,
            boolean substituirConflitos) {
        if (candidatos == null || candidatos.isEmpty()) {
            return Optional.empty();
        }
        if (refNome.isPresent()) {
            Optional<ProjudiPeticaoArquivoEntity> porNome = candidatos.stream()
                    .filter(a -> correspondeRefCanonica(a, refNome.get()))
                    .findFirst();
            if (porNome.isPresent()) {
                return porNome;
            }
        }
        if (candidatos.size() == 1) {
            return Optional.of(candidatos.getFirst());
        }
        if (substituirConflitos) {
            return candidatos.stream()
                    .max(Comparator.comparing(a -> a.getPeticao().getId()));
        }
        return Optional.empty();
    }

    private static boolean correspondeRefCanonica(ProjudiPeticaoArquivoEntity arquivo, RefCanonicaNome ref) {
        if (arquivo == null || arquivo.getPeticao() == null || arquivo.getPeticao().getId() == null) {
            return false;
        }
        if (ref.peticaoId() != arquivo.getPeticao().getId() || ref.ordem() != arquivo.getOrdem()) {
            return false;
        }
        String pdfSha = arquivo.getPdfSha256();
        if (StringUtils.hasText(pdfSha) && pdfSha.toLowerCase(Locale.ROOT).startsWith(ref.sha8())) {
            return true;
        }
        String pdfRef = arquivo.getPdfRef();
        if (!StringUtils.hasText(pdfRef)) {
            return false;
        }
        String base = Path.of(pdfRef).getFileName().toString().toLowerCase(Locale.ROOT);
        return base.contains(ref.peticaoId() + "_" + ref.ordem() + "_" + ref.sha8());
    }

    private void gravarAssinaturaNoArquivo(ProjudiPeticaoArquivoEntity arquivo, byte[] p7sBytes, String shaConteudo) {
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

        if (StringUtils.hasText(arquivo.getP7sRef()) && !p7sRef.equals(arquivo.getP7sRef())) {
            try {
                Files.deleteIfExists(storeDir.resolve(arquivo.getP7sRef()));
            } catch (IOException e) {
                // best-effort
            }
        }

        arquivo.setP7sRef(p7sRef);
        arquivo.setP7sSha256(ProjudiAssinaturaP7sUtil.sha256(p7sBytes));
        arquivo.setConteudoAssinadoSha256(shaConteudo);
        arquivo.setStatus(STATUS_ARQUIVO_ASSINADO);
        registroService.sincronizarP7sAssinadoNoDrive(peticao.getNumeroProcesso(), arquivo, p7sBytes);
        arquivoRepository.save(arquivo);

        atualizarStatusPeticaoSeCompleta(peticao);
    }

    /** Remove preparações duplicadas (mesmo hash) que sobraram após pareamento. */
    private void descartarPendentesDuplicadosMesmoHash(String sha256, ProjudiPeticaoArquivoEntity mantido) {
        List<ProjudiPeticaoArquivoEntity> existentes = arquivoRepository.findAllByPdfSha256WithPeticao(sha256);
        Set<Long> peticoesDescartadas = new HashSet<>();
        for (ProjudiPeticaoArquivoEntity arq : existentes) {
            if (arq.getId() != null && arq.getId().equals(mantido.getId())) {
                continue;
            }
            if (!STATUS_ARQUIVO_PENDENTE.equals(arq.getStatus())) {
                continue;
            }
            ProjudiPeticaoEntity peticao = arq.getPeticao();
            if (peticao == null || peticao.getId() == null) {
                continue;
            }
            if (!peticoesDescartadas.add(peticao.getId())) {
                continue;
            }
            try {
                registroService.excluirPeticao(peticao.getId());
            } catch (Exception e) {
                // best-effort — não impede pareamento bem-sucedido
            }
        }
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
