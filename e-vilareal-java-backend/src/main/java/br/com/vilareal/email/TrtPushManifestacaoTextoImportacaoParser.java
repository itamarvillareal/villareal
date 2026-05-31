package br.com.vilareal.email;

import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Parser dos emails de acompanhamento PUSH dos TRTs (PJe), ex.: {@code nao-responda@trt18.jus.br}
 * com assunto «[TRT18] [PUSH] Atualizações de Informações Processuais do Processo 0000000-00.0000.5.18.0000».
 *
 * <p>O email é estruturado por rótulos (Número do Processo, Classe Judicial, Órgão Julgador,
 * Data de Autuação, Autor, Réu, Movimentação) e descreve UM processo por mensagem.
 */
final class TrtPushManifestacaoTextoImportacaoParser {

    private static final Logger log = LoggerFactory.getLogger(TrtPushManifestacaoTextoImportacaoParser.class);

    private static final Pattern CNJ = Pattern.compile(
            "\\b(\\d{7})\\s*[-–]\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\s*\\.\\s*(\\d)\\s*\\.\\s*(\\d{2})\\s*\\.\\s*(\\d{4})\\b");

    private static final Pattern CNJ_20_DIGITOS = Pattern.compile("\\b(\\d{20})\\b");

    private static final Pattern RE_NUMERO_PROCESSO = Pattern.compile(
            "(?i)N[uú]mero[ \\t]+do[ \\t]+[Pp]rocesso[ \\t]*[:.]?[ \\t]*([^\\n]+)");
    private static final Pattern RE_CLASSE = Pattern.compile(
            "(?i)Classe[ \\t]+Judicial[ \\t]*[:.]?[ \\t]*([^\\n]+)");
    private static final Pattern RE_ORGAO = Pattern.compile(
            "(?i)[ÓO]rg[ãa]o[ \\t]+Julgador[ \\t]*[:.]?[ \\t]*([^\\n]+)");
    private static final Pattern RE_AUTUACAO = Pattern.compile(
            "(?i)Data[ \\t]+de[ \\t]+Autua[çc][ãa]o[ \\t]*[:.]?[ \\t]*(\\d{1,2}/\\d{1,2}/\\d{2,4}(?:[ \\t]+\\d{1,2}:\\d{2}(?::\\d{2})?)?)");
    private static final Pattern RE_AUTOR = Pattern.compile(
            "(?im)^[ \\t]*(?:Autor(?:\\(a\\)|a|es)?|Requerente|Reclamante|Polo[ \\t]+[Aa]tivo)[ \\t]*[:.]?[ \\t]*(\\S.*)$");
    private static final Pattern RE_REU = Pattern.compile(
            "(?im)^[ \\t]*(?:R[eé]u(?:\\(s\\)|s)?|Requerid[oa]|Reclamad[oa]|Polo[ \\t]+[Pp]assivo)[ \\t]*[:.]?[ \\t]*(\\S.*)$");
    private static final Pattern RE_MOVIMENTO = Pattern.compile(
            "(?i)(?:[ÚU]ltima[ \\t]+[Mm]ovimenta[çc][ãa]o|[Mm]ovimenta[çc][ãa]o|Tipo[ \\t]+de[ \\t]+[Mm]ovimento|Movimento|Evento)"
                    + "[ \\t]*[:.][ \\t]*([^\\n]{3,240})");
    private static final Pattern RE_DATA_MOV = Pattern.compile(
            "(?i)(?:Data[ \\t]+da[ \\t]+[Mm]ovimenta[çc][ãa]o|Data/Hora|Data[ \\t]+do[ \\t]+[Mm]ovimento)[ \\t]*[:.]?[ \\t]*"
                    + "(\\d{1,2}/\\d{1,2}/\\d{2,4}(?:[ \\t]+\\d{1,2}:\\d{2}(?::\\d{2})?)?)");

    private TrtPushManifestacaoTextoImportacaoParser() {}

    static List<PublicacaoWriteRequest> parse(
            String conteudoEmail, String assunto, String arquivoOrigemNome, String snippetGmail) {
        String corpo = extrairCorpoLegivel(conteudoEmail);
        StringBuilder corpus = new StringBuilder();
        if (assunto != null && !assunto.isBlank()) {
            corpus.append(assunto.trim()).append('\n');
        }
        if (snippetGmail != null && !snippetGmail.isBlank()) {
            corpus.append(snippetGmail.trim()).append('\n');
        }
        if (corpo != null && !corpo.isBlank()) {
            corpus.append(corpo);
        }
        String texto = normalizarTexto(corpus.toString());

        String numero = extrairNumeroProcesso(assunto, texto);
        if (numero == null || numero.isBlank()) {
            log.warn("Parser TRT: sem número de processo (assunto={}, origem={})", assunto, arquivoOrigemNome);
            return List.of();
        }

        String classe = primeiroGrupo(RE_CLASSE, texto);
        String orgao = primeiroGrupo(RE_ORGAO, texto);
        String autor = primeiroGrupo(RE_AUTOR, texto);
        String reu = primeiroGrupo(RE_REU, texto);
        String movimento = primeiroGrupo(RE_MOVIMENTO, texto);

        String tipoPublicacao = movimento.isBlank() ? classificarTipo(assunto, texto) : limparRotulo(movimento);

        LocalDate data = extrairData(texto);
        if (data == null) {
            data = LocalDate.now();
        }

        String teor = deduplicarLinhas(corpo != null && !corpo.isBlank() ? corpo : texto);
        String hash = hashDedup(numero, tipoPublicacao, teor);

        PublicacaoWriteRequest req = new PublicacaoWriteRequest();
        req.setNumeroProcessoEncontrado(numero);
        req.setDataPublicacao(data);
        req.setDataDisponibilizacao(data);
        req.setFonte(montarFonte(numero, assunto));
        req.setDiario(montarDiario(numero, assunto));
        req.setTitulo(trim(assunto, 300));
        req.setTipoPublicacao(tipoPublicacao);
        req.setResumo(gerarResumo(tipoPublicacao, teor));
        req.setTeor(teor);
        req.setHashTeor(hash);
        req.setHashConteudo(hash);
        req.setOrigemImportacao("TRT");
        req.setArquivoOrigemNome(arquivoOrigemNome);
        req.setStatusTratamento("PENDENTE");
        req.setLida(false);
        req.setObservacao("Importado automaticamente via Gmail (PUSH PJe/TRT).");
        req.setJsonReferencia(jsonTrt(tipoPublicacao, autor, reu, classe, orgao, assunto));

        List<PublicacaoWriteRequest> out = new ArrayList<>();
        out.add(req);
        log.info("Parser TRT origem={}: processo={}, tipo={}", arquivoOrigemNome, numero, tipoPublicacao);
        return out;
    }

    private static String extrairNumeroProcesso(String assunto, String texto) {
        String doRotulo = primeiroGrupo(RE_NUMERO_PROCESSO, texto);
        String cnj = primeiroCnj(doRotulo);
        if (cnj != null) {
            return cnj;
        }
        cnj = primeiroCnj(assunto);
        if (cnj != null) {
            return cnj;
        }
        return primeiroCnj(texto);
    }

    private static String primeiroCnj(String texto) {
        if (texto == null || texto.isBlank()) {
            return null;
        }
        Matcher m = CNJ.matcher(texto);
        if (m.find()) {
            String cnj = formatarCnj(m);
            if (cnjEhPlausivel(cnj)) {
                return cnj;
            }
        }
        Matcher v = CNJ_20_DIGITOS.matcher(texto.replaceAll("[.\\-]", "").replaceAll("\\s+", " "));
        if (v.find()) {
            String cnj = cnjDe20Digitos(v.group(1));
            if (cnj != null && cnjEhPlausivel(cnj)) {
                return cnj;
            }
        }
        return null;
    }

    private static boolean cnjEhPlausivel(String cnj) {
        Matcher m = CNJ.matcher(String.valueOf(cnj));
        if (!m.matches()) {
            return false;
        }
        try {
            int ano = Integer.parseInt(m.group(3));
            if (ano < 1996 || ano > 2035) {
                return false;
            }
            int seg = Integer.parseInt(m.group(4));
            return seg >= 1 && seg <= 9;
        } catch (Exception e) {
            return false;
        }
    }

    private static String cnjDe20Digitos(String digitos) {
        if (digitos == null || digitos.length() != 20) {
            return null;
        }
        String fmt = String.format(
                "%s-%s.%s.%s.%s.%s",
                digitos.substring(0, 7),
                digitos.substring(7, 9),
                digitos.substring(9, 13),
                digitos.substring(13, 14),
                digitos.substring(14, 16),
                digitos.substring(16, 20));
        Matcher m = CNJ.matcher(fmt);
        return m.find() ? formatarCnj(m) : null;
    }

    private static String formatarCnj(Matcher m) {
        return String.format(
                        "%s-%s.%s.%s.%s.%s",
                        m.group(1), m.group(2), m.group(3), m.group(4), m.group(5), m.group(6))
                .toUpperCase();
    }

    /** Região do TRT pelo segmento TR do CNJ (J=5) ou pelo «[TRTxx]» do assunto. */
    private static String regiaoTrt(String numeroCnj, String assunto) {
        Matcher m = CNJ.matcher(String.valueOf(numeroCnj));
        if (m.find() && "5".equals(m.group(4))) {
            return String.valueOf(Integer.parseInt(m.group(5)));
        }
        Matcher s = Pattern.compile("(?i)TRT\\s*-?\\s*(\\d{1,2})").matcher(String.valueOf(assunto));
        if (s.find()) {
            return s.group(1);
        }
        return "";
    }

    private static String montarFonte(String numeroCnj, String assunto) {
        String reg = regiaoTrt(numeroCnj, assunto);
        return reg.isBlank() ? "TRT (PJe PUSH)" : "TRT " + reg + "ª Região (PJe PUSH)";
    }

    private static String montarDiario(String numeroCnj, String assunto) {
        String reg = regiaoTrt(numeroCnj, assunto);
        return reg.isBlank() ? "TRT" : "TRT" + reg;
    }

    private static String classificarTipo(String assunto, String texto) {
        String t = (String.valueOf(assunto) + "\n" + String.valueOf(texto)).toLowerCase();
        if (t.contains("intima") && t.contains("cita")) return "Intimação/citação";
        if (t.contains("intima")) return "Intimação";
        if (t.contains("cita")) return "Citação";
        if (t.contains("senten")) return "Sentença";
        if (t.contains("acórd") || t.contains("acord")) return "Acórdão";
        if (t.contains("despacho")) return "Despacho";
        if (t.contains("decis")) return "Decisão";
        if (t.contains("audi")) return "Audiência";
        if (t.contains("arquiv")) return "Arquivamento";
        if (t.contains("peti")) return "Peticionamento";
        return "Atualização processual (PUSH)";
    }

    private static LocalDate extrairData(String texto) {
        Matcher md = RE_DATA_MOV.matcher(texto);
        if (md.find()) {
            LocalDate d = parseData(md.group(1));
            if (d != null) {
                return d;
            }
        }
        Matcher ma = RE_AUTUACAO.matcher(texto);
        if (ma.find()) {
            LocalDate d = parseData(ma.group(1));
            if (d != null) {
                return d;
            }
        }
        Matcher m = Pattern.compile("\\b(\\d{1,2})/(\\d{1,2})/(\\d{2,4})\\b").matcher(texto);
        if (m.find()) {
            return parseDataBr(m.group(1), m.group(2), m.group(3));
        }
        return null;
    }

    private static LocalDate parseData(String s) {
        Matcher m = Pattern.compile("(\\d{1,2})/(\\d{1,2})/(\\d{2,4})").matcher(String.valueOf(s));
        return m.find() ? parseDataBr(m.group(1), m.group(2), m.group(3)) : null;
    }

    private static LocalDate parseDataBr(String dd, String mm, String yy) {
        try {
            int dia = Integer.parseInt(dd);
            int mes = Integer.parseInt(mm);
            int ano = Integer.parseInt(yy);
            if (yy.length() == 2) {
                ano = ano <= 69 ? 2000 + ano : 1900 + ano;
            }
            return LocalDate.of(ano, mes, dia);
        } catch (Exception e) {
            return null;
        }
    }

    private static String primeiroGrupo(Pattern p, String texto) {
        Matcher m = p.matcher(String.valueOf(texto));
        return m.find() ? limparRotulo(m.group(1)) : "";
    }

    private static String limparRotulo(String s) {
        String t = String.valueOf(s == null ? "" : s).replaceAll("\\s+", " ").trim();
        if (t.length() > 240) {
            t = t.substring(0, 237) + "...";
        }
        return t;
    }

    private static String gerarResumo(String tipo, String teor) {
        String base = tipo + " — " + String.valueOf(teor).replaceAll("\\s+", " ").trim();
        return base.length() <= 240 ? base : base.substring(0, 237) + "...";
    }

    private static String jsonTrt(
            String tipoMovimento, String autor, String reu, String classe, String orgao, String assunto) {
        return "{\"trt\":{"
                + "\"tipoMovimento\":\"" + escapeJson(tipoMovimento)
                + "\",\"parteAutor\":\"" + escapeJson(autor)
                + "\",\"parteReu\":\"" + escapeJson(reu)
                + "\",\"classeJudicial\":\"" + escapeJson(classe)
                + "\",\"orgaoJulgador\":\"" + escapeJson(orgao)
                + "\",\"assuntoEmail\":\"" + escapeJson(trim(assunto, 300))
                + "\"}}";
    }

    private static String escapeJson(String s) {
        return String.valueOf(s == null ? "" : s).replace("\\", "\\\\").replace("\"", "\\\"");
    }

    private static String trim(String s, int max) {
        String t = s == null ? "" : s.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static String extrairCorpoLegivel(String conteudoEmail) {
        if (conteudoEmail == null || conteudoEmail.isBlank()) {
            return "";
        }
        String texto = conteudoEmail;
        if (texto.contains("<") && texto.contains(">")) {
            texto = PublicacaoTextoImportacaoParser.htmlParaTexto(texto);
        }
        return deduplicarLinhas(normalizarTexto(texto));
    }

    private static String normalizarTexto(String texto) {
        String t = String.valueOf(texto == null ? "" : texto);
        t = t.replace("\r\n", "\n").replace('\r', '\n');
        t = t.replace('\u00AD', ' ').replace("\u200B", "").replace("\uFEFF", "");
        t = t.replace('–', '-').replace('—', '-');
        t = t.replaceAll("[ \\t]+", " ");
        t = t.replaceAll("\n{3,}", "\n\n");
        return t.trim();
    }

    private static String deduplicarLinhas(String texto) {
        if (texto == null || texto.isBlank()) {
            return "";
        }
        String[] linhas = texto.split("\n");
        List<String> unicos = new ArrayList<>();
        Set<String> vistos = new LinkedHashSet<>();
        for (String raw : linhas) {
            String l = raw.trim();
            if (l.isEmpty()) {
                if (!unicos.isEmpty() && !unicos.get(unicos.size() - 1).isEmpty()) {
                    unicos.add("");
                }
                continue;
            }
            String norm = l.toLowerCase().replaceAll("\\s+", " ");
            if (norm.length() >= 12 && vistos.contains(norm)) {
                continue;
            }
            vistos.add(norm);
            unicos.add(l);
        }
        while (!unicos.isEmpty() && unicos.get(unicos.size() - 1).isEmpty()) {
            unicos.remove(unicos.size() - 1);
        }
        return String.join("\n", unicos);
    }

    private static String hashDedup(String numero, String tipo, String teor) {
        String n = String.valueOf(numero == null ? "" : numero.trim());
        String tp = String.valueOf(tipo == null ? "" : tipo.trim());
        String t = String.valueOf(teor == null ? "" : teor).toLowerCase().replaceAll("\\s+", " ").trim();
        return sha256Hex("TRT|" + n + "|" + tp + "|" + t);
    }

    private static String sha256Hex(String input) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] digest = md.digest(String.valueOf(input == null ? "" : input).getBytes(StandardCharsets.UTF_8));
            StringBuilder sb = new StringBuilder(digest.length * 2);
            for (byte b : digest) {
                sb.append(String.format("%02x", b));
            }
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
