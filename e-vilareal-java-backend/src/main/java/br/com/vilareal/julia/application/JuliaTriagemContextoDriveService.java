package br.com.vilareal.julia.application;

import br.com.vilareal.documento.GoogleDriveService;
import br.com.vilareal.documento.PdfTextoExtracaoUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiDriveMovimentacoesPdfSupport;
import br.com.vilareal.publicacao.infrastructure.persistence.entity.PublicacaoEntity;
import com.google.api.services.drive.model.File;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Cruza o teor do e-mail/publicação com PDFs da pasta Movimentações no Drive — base para triagem
 * jurídica (não só o aviso genérico do PROJUDI).
 */
@Service
public class JuliaTriagemContextoDriveService {

    private static final Logger log = LoggerFactory.getLogger(JuliaTriagemContextoDriveService.class);

    private static final Pattern PADRAO_NUMERO_MOV =
            Pattern.compile("^(\\d{1,4})\\s+Movimenta", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private static final int MINIMO_ULTIMAS_MOVIMENTACOES = 3;

    private final ProjudiDriveMovimentacoesPdfSupport movimentacoesPdfSupport;
    private final GoogleDriveService googleDriveService;
    private final int maxArquivos;
    private final int maxCharsPorArquivo;
    private final int maxCharsTotal;

    public JuliaTriagemContextoDriveService(
            ProjudiDriveMovimentacoesPdfSupport movimentacoesPdfSupport,
            GoogleDriveService googleDriveService,
            @Value("${julia.triagem.drive.max-arquivos:12}") int maxArquivos,
            @Value("${julia.triagem.drive.max-chars-por-arquivo:14000}") int maxCharsPorArquivo,
            @Value("${julia.triagem.drive.max-chars-total:52000}") int maxCharsTotal) {
        this.movimentacoesPdfSupport = movimentacoesPdfSupport;
        this.googleDriveService = googleDriveService;
        this.maxArquivos = Math.max(1, maxArquivos);
        this.maxCharsPorArquivo = Math.max(2000, maxCharsPorArquivo);
        this.maxCharsTotal = Math.max(8000, maxCharsTotal);
    }

    public record DocumentoMovimentacao(int seqMov, int seqArquivo, String nome, String fileId, String texto) {}

    public record ContextoDriveDocumentos(
            boolean driveConfigurado,
            boolean pastaEncontrada,
            int totalPdfsNaPasta,
            List<DocumentoMovimentacao> documentosSelecionados,
            String blocoContexto) {}

    public ContextoDriveDocumentos montarContexto(ProcessoEntity processo, PublicacaoEntity publicacao, String teorEmail) {
        if (!googleDriveService.isConfigurado()) {
            return vazio("Google Drive não configurado — triagem limitada ao teor do e-mail.");
        }
        if (processo == null) {
            return vazio("Processo não informado — sem leitura de documentos no Drive.");
        }
        try {
            String pastaId = movimentacoesPdfSupport.resolverPastaMovimentacoesId(processo);
            if (!StringUtils.hasText(pastaId)) {
                return new ContextoDriveDocumentos(true, false, 0, List.of(), instrucaoSemPasta());
            }
            List<ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive> catalogo =
                    movimentacoesPdfSupport.listarPdfsOrdenados(pastaId);
            if (catalogo.isEmpty()) {
                return new ContextoDriveDocumentos(true, true, 0, List.of(), instrucaoSemPdfs());
            }
            List<ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive> selecionados =
                    selecionarDocumentosParaTriagem(catalogo, publicacao, teorEmail);
            List<DocumentoMovimentacao> comTexto = extrairTextos(selecionados);
            String bloco = montarBlocoContexto(comTexto, catalogo.size(), publicacao, teorEmail);
            return new ContextoDriveDocumentos(true, true, catalogo.size(), comTexto, bloco);
        } catch (Exception e) {
            log.warn(
                    "Julia contexto Drive falhou (processoId={}): {}",
                    processo.getId(),
                    e.getMessage());
            return vazio("Falha ao ler documentos no Drive: " + resumirErro(e));
        }
    }

    private static ContextoDriveDocumentos vazio(String motivo) {
        String bloco =
                """
                === DOCUMENTOS MOVIMENTAÇÕES (Google Drive) ===
                (%s)
                Cruze com o teor do e-mail; se não houver documento, reduza a confiança e indique a leitura pendente.
                """
                        .formatted(motivo);
        return new ContextoDriveDocumentos(false, false, 0, List.of(), bloco);
    }

    private static String instrucaoSemPasta() {
        return """
                === DOCUMENTOS MOVIMENTAÇÕES (Google Drive) ===
                (Pasta Movimentações não localizada para este processo.)
                Baseie-se no e-mail e no histórico; não invente conteúdo de certidão/despacho.
                """;
    }

    private static String instrucaoSemPdfs() {
        return """
                === DOCUMENTOS MOVIMENTAÇÕES (Google Drive) ===
                (Pasta Movimentações existe, mas ainda não há PDFs — o robô pode não ter arquivado.)
                Se o e-mail anuncia documento, use confiança moderada/baixa até o PDF existir.
                """;
    }

    List<ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive> selecionarDocumentosParaTriagem(
            List<ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive> catalogo,
            PublicacaoEntity publicacao,
            String teorEmail) {
        Set<String> ids = new LinkedHashSet<>();
        List<ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive> out = new ArrayList<>();

        int maxSeq = catalogo.stream().mapToInt(ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive::seqMov).max().orElse(0);

        for (int i = catalogo.size() - 1; i >= 0 && out.size() < MINIMO_ULTIMAS_MOVIMENTACOES; i--) {
            var pdf = catalogo.get(i);
            if (ids.add(pdf.fileId())) {
                out.add(pdf);
            }
        }

        List<String> termos = termosRelevancia(publicacao, teorEmail);
        for (var pdf : catalogo) {
            if (out.size() >= maxArquivos) {
                break;
            }
            String nomeLower = pdf.nome().toLowerCase(Locale.ROOT);
            boolean match = false;
            for (String t : termos) {
                if (nomeLower.contains(t)) {
                    match = true;
                    break;
                }
            }
            if (!match && pdf.seqMov() == maxSeq) {
                match = true;
            }
            if (match && ids.add(pdf.fileId())) {
                out.add(pdf);
            }
        }

        if (out.size() < maxArquivos) {
            for (int i = catalogo.size() - 1; i >= 0 && out.size() < maxArquivos; i--) {
                var pdf = catalogo.get(i);
                if (ids.add(pdf.fileId())) {
                    out.add(pdf);
                }
            }
        }

        out.sort(Comparator
                .comparingInt(ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive::seqMov)
                .thenComparingInt(ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive::seqArquivo));
        return out;
    }

    static List<String> termosRelevancia(PublicacaoEntity publicacao, String teorEmail) {
        Set<String> termos = new LinkedHashSet<>();
        String blob = "";
        if (publicacao != null) {
            blob += " " + nullToEmpty(publicacao.getTipoPublicacao());
            blob += " " + nullToEmpty(publicacao.getTitulo());
            blob += " " + nullToEmpty(publicacao.getResumo());
        }
        blob += " " + nullToEmpty(teorEmail);
        String lower = blob.toLowerCase(Locale.ROOT);
        if (lower.contains("audi")) termos.add("audi");
        if (lower.contains("certid")) termos.add("certid");
        if (lower.contains("despacho")) termos.add("despacho");
        if (lower.contains("decis")) termos.add("decis");
        if (lower.contains("senten")) termos.add("senten");
        if (lower.contains("intima")) termos.add("intima");
        if (lower.contains("cita")) termos.add("cita");
        if (lower.contains("design")) termos.add("design");
        if (lower.contains("instru")) termos.add("instru");
        if (lower.contains("julg")) termos.add("julg");
        if (lower.contains("homolog")) termos.add("homolog");
        if (lower.contains("acordo")) termos.add("acordo");
        Matcher m = Pattern.compile("movimenta[çc][ãa]o\\s*(?:n[ºo°.]?\\s*)?(\\d{1,4})", Pattern.CASE_INSENSITIVE)
                .matcher(blob);
        if (m.find()) {
            termos.add(String.format(Locale.ROOT, "%04d", Integer.parseInt(m.group(1))));
        }
        return new ArrayList<>(termos);
    }

    private List<DocumentoMovimentacao> extrairTextos(List<ProjudiDriveMovimentacoesPdfSupport.PdfMovimentacaoDrive> selecionados) {
        List<DocumentoMovimentacao> out = new ArrayList<>();
        int charsTotal = 0;
        for (var pdf : selecionados) {
            if (charsTotal >= maxCharsTotal) {
                break;
            }
            String texto = "";
            try {
                byte[] bytes = googleDriveService.baixarBytesArquivo(pdf.fileId());
                if (PdfTextoExtracaoUtil.parecePdf(bytes)) {
                    texto = PdfTextoExtracaoUtil.extrairTexto(bytes);
                }
            } catch (Exception e) {
                log.warn("Julia: falha ao extrair PDF {}: {}", pdf.nome(), e.getMessage());
                texto = "(Falha ao baixar/ler o arquivo: " + resumirErro(e) + ")";
            }
            int limite = Math.min(maxCharsPorArquivo, maxCharsTotal - charsTotal);
            if (texto.length() > limite) {
                texto = texto.substring(0, limite) + "\n… [texto truncado]";
            }
            charsTotal += texto.length();
            out.add(new DocumentoMovimentacao(pdf.seqMov(), pdf.seqArquivo(), pdf.nome(), pdf.fileId(), texto));
        }
        return out;
    }

    private String montarBlocoContexto(
            List<DocumentoMovimentacao> docs,
            int totalNaPasta,
            PublicacaoEntity publicacao,
            String teorEmail) {
        StringBuilder sb = new StringBuilder();
        sb.append("=== DOCUMENTOS MOVIMENTAÇÕES (Google Drive) ===\n");
        sb.append("Total de PDFs na pasta: ").append(totalNaPasta).append('\n');
        sb.append("PDFs selecionados para análise (cruzamento com o e-mail): ").append(docs.size()).append('\n');
        sb.append(
                """
                INSTRUÇÃO: o e-mail PROJUDI costuma ser um AVISO. O conteúdo jurídico relevante está nos PDFs abaixo.
                Relacione explicitamente o que o e-mail diz com o que cada documento contém.
                Não classifique como mera "intimação/citação" se o PDF descreve despacho, certidão, audiência designada, sentença, etc.
                Extraia datas, horas, prazos e providências dos documentos — não invente.
                """
                        .trim())
                .append("\n\n");

        if (publicacao != null && StringUtils.hasText(publicacao.getTipoPublicacao())) {
            sb.append("Tipo publicação (e-mail): ").append(publicacao.getTipoPublicacao().trim()).append('\n');
        }
        List<String> termos = termosRelevancia(publicacao, teorEmail);
        if (!termos.isEmpty()) {
            sb.append("Termos de correlação usados na seleção: ").append(String.join(", ", termos)).append('\n');
        }
        sb.append('\n');

        for (DocumentoMovimentacao doc : docs) {
            sb.append("--- Documento: ").append(doc.nome()).append(" ---\n");
            sb.append("Movimentação nº ").append(formatarSeq(doc.seqMov()));
            if (doc.seqArquivo() < Integer.MAX_VALUE) {
                sb.append(", arquivo ").append(String.format(Locale.ROOT, "%02d", doc.seqArquivo()));
            }
            sb.append('\n');
            if (!StringUtils.hasText(doc.texto())) {
                sb.append("(Sem texto extraível — possível scan; considere OCR ou leitura manual.)\n\n");
            } else {
                sb.append(doc.texto().trim()).append("\n\n");
            }
        }
        return sb.toString();
    }

    private static String formatarSeq(int seq) {
        if (seq >= Integer.MAX_VALUE - 1) {
            return "?";
        }
        return String.format(Locale.ROOT, "%04d", seq);
    }

    private static String nullToEmpty(String s) {
        return s == null ? "" : s;
    }

    private static String resumirErro(Exception e) {
        String msg = e.getMessage();
        if (!StringUtils.hasText(msg)) {
            return e.getClass().getSimpleName();
        }
        return msg.length() > 180 ? msg.substring(0, 180) + "…" : msg;
    }

    static int extrairSeqMovDoNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return Integer.MAX_VALUE;
        }
        Matcher m = PADRAO_NUMERO_MOV.matcher(nome.trim());
        if (m.find()) {
            return Integer.parseInt(m.group(1));
        }
        return Integer.MAX_VALUE;
    }
}
