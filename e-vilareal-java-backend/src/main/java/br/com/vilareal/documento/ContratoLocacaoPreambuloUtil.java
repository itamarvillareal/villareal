package br.com.vilareal.documento;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Complemento do preâmbulo do contrato de locação com fiadores. */
final class ContratoLocacaoPreambuloUtil {

    private static final Pattern ANTES_TEM_POR_JUSTO = Pattern.compile(
            ",\\s*t[eê]m por justo e contratado", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);
    private static final Pattern INICIO_LOCADOR = Pattern.compile(
            "(?i),\\s*como\\s+(?:LOCADOR|LOCADORA),\\s*");
    private static final Pattern INICIO_LOCATARIO = Pattern.compile(
            "(?i),\\s*e,\\s*como\\s+(?:LOCATÁRIO|LOCATÁRIOS|LOCATARIA|LOCATARIAS),\\s*");
    private static final Pattern INICIO_LOCATARIO_FLEX = Pattern.compile(
            "(?i),\\s*e,?\\s*como\\s+(?:LOCATÁRIO|LOCATÁRIOS|LOCATARIA|LOCATARIAS)\\s*,\\s*");
    private static final Pattern SEPARADOR_E = Pattern.compile("(?i),\\s*e\\s*,?");
    private static final Pattern CPF_CNPJ = Pattern.compile(
            "(\\d{3}\\.\\d{3}\\.\\d{3}-\\d{2}|\\d{2}\\.\\d{3}\\.\\d{3}/\\d{4}-\\d{2})");

    private ContratoLocacaoPreambuloUtil() {}

    static String injetarFiadoresNoPreambuloHtml(
            String preambuloHtml, List<PessoaEntity> fiadores, QualificacaoPessoaUtil qualificacaoPessoaUtil) {
        if (!StringUtils.hasText(preambuloHtml) || fiadores == null || fiadores.isEmpty()) {
            return preambuloHtml != null ? preambuloHtml : "";
        }
        if (preambuloJaMencionaFiador(preambuloHtml)) {
            return preambuloHtml;
        }
        String trechoPlain = montarTrechoFiadores(fiadores, qualificacaoPessoaUtil);
        if (!StringUtils.hasText(trechoPlain)) {
            return preambuloHtml;
        }
        String trechoHtml = ContratoLocacaoDocumentoService.textoProcessadoParaHtml(trechoPlain);
        Matcher m = ANTES_TEM_POR_JUSTO.matcher(preambuloHtml);
        if (m.find()) {
            return preambuloHtml.substring(0, m.start()) + trechoHtml + preambuloHtml.substring(m.start());
        }
        return preambuloHtml + trechoHtml;
    }

    static boolean preambuloJaMencionaFiador(String preambuloHtml) {
        if (!StringUtils.hasText(preambuloHtml)) {
            return false;
        }
        String t = preambuloHtml.toLowerCase(Locale.ROOT);
        return t.contains("fiador") || t.contains("fiadora");
    }

    private static String montarTrechoFiadores(List<PessoaEntity> fiadores, QualificacaoPessoaUtil util) {
        StringBuilder sb = new StringBuilder();
        for (PessoaEntity f : fiadores) {
            if (f == null || f.getId() == null) {
                continue;
            }
            String nome = Utf8MojibakeUtil.corrigir(f.getNome());
            boolean feminino = QualificacaoPessoaUtil.determinarFeminino(nome, null);
            String rotulo = feminino ? "FIADORA" : "FIADOR";
            String qual = util.gerarQualificacaoContratoLocacaoPorPessoaId(f.getId());
            if (!StringUtils.hasText(qual)) {
                continue;
            }
            sb.append(", e, como ").append(rotulo).append(", ").append(qual.trim());
        }
        return sb.toString();
    }

    /** Ajusta rótulo do preâmbulo quando há mais de um locatário. */
    static String ajustarRotuloLocatarioPluralHtml(String preambuloHtml, int quantidadeLocatarios) {
        if (!StringUtils.hasText(preambuloHtml) || quantidadeLocatarios <= 1) {
            return preambuloHtml != null ? preambuloHtml : "";
        }
        return preambuloHtml.replaceAll("(?i), e, como LOCATÁRIO,", ", e, como LOCATÁRIOS,");
    }

    /**
     * O modelo legado repete {@code Nome("Autor")}/{@code Qualifica_Sem_Nome_("Autor")} antes de
     * «têm por justo», depois de já ter qualificado o locador no início.
     */
    static String removerRequalificacaoLocadorDuplicada(String preambulo) {
        if (!StringUtils.hasText(preambulo)) {
            return preambulo != null ? preambulo : "";
        }
        Matcher temPorJusto = ANTES_TEM_POR_JUSTO.matcher(preambulo);
        if (!temPorJusto.find()) {
            return preambulo;
        }
        int idxTem = temPorJusto.start();

        Matcher mLoc = INICIO_LOCADOR.matcher(preambulo);
        if (!mLoc.find()) {
            return preambulo;
        }
        int startQualLocador = mLoc.end();

        Matcher mLat = INICIO_LOCATARIO.matcher(preambulo);
        if (!mLat.find(startQualLocador)) {
            mLat = INICIO_LOCATARIO_FLEX.matcher(preambulo);
            if (!mLat.find(startQualLocador)) {
                return preambulo;
            }
        }

        String qualLocador = QualificacaoPessoaUtil.semVirgulaFinal(
                preambulo.substring(startQualLocador, mLat.start()).trim());
        if (!StringUtils.hasText(qualLocador)) {
            return preambulo;
        }

        String antesTem = preambulo.substring(0, idxTem);
        String docLocador = extrairCpfCnpj(qualLocador);
        if (StringUtils.hasText(docLocador)) {
            int firstDoc = antesTem.indexOf(docLocador);
            int secondDoc = firstDoc >= 0 ? antesTem.indexOf(docLocador, firstDoc + docLocador.length()) : -1;
            if (secondDoc > mLat.end()) {
                int idxRepeticao = indexSeparadorEAntes(antesTem, secondDoc);
                if (idxRepeticao >= mLat.end()) {
                    return preambulo.substring(0, idxRepeticao) + preambulo.substring(idxTem);
                }
            }
        }

        int idxRepeticao = indexUltimaRepeticaoLocador(antesTem, mLat.end());
        if (idxRepeticao < 0) {
            return preambulo;
        }

        String trechoFinal = antesTem.substring(idxRepeticao).trim();
        if (!trechoRepeteQualificacaoLocador(qualLocador, trechoFinal)) {
            return preambulo;
        }
        return preambulo.substring(0, idxRepeticao) + preambulo.substring(idxTem);
    }

    private static int indexSeparadorEAntes(String texto, int posicao) {
        Matcher m = SEPARADOR_E.matcher(texto.substring(0, Math.max(0, posicao)));
        int last = -1;
        while (m.find()) {
            last = m.start();
        }
        return last;
    }

    private static String extrairCpfCnpj(String qualificacao) {
        if (!StringUtils.hasText(qualificacao)) {
            return "";
        }
        Matcher doc = CPF_CNPJ.matcher(qualificacao);
        return doc.find() ? doc.group(1) : "";
    }

    private static int indexUltimaRepeticaoLocador(String antesTem, int afterLocatarios) {
        if (afterLocatarios >= antesTem.length()) {
            return -1;
        }
        String suffix = antesTem.substring(afterLocatarios);
        Matcher m = SEPARADOR_E.matcher(suffix);
        int last = -1;
        while (m.find()) {
            last = afterLocatarios + m.start();
        }
        return last;
    }

    private static boolean trechoRepeteQualificacaoLocador(String qualLocador, String trechoFinal) {
        String normLocador = normalizarComparacaoQualificacao(qualLocador);
        String normTrecho = normalizarComparacaoQualificacao(trechoFinal);
        if (!StringUtils.hasText(normLocador) || !StringUtils.hasText(normTrecho)) {
            return false;
        }
        if (normTrecho.equals(normLocador)) {
            return true;
        }
        if (normTrecho.length() >= 24
                && (normTrecho.contains(normLocador) || normLocador.contains(normTrecho))) {
            return true;
        }
        Matcher doc = CPF_CNPJ.matcher(qualLocador);
        if (doc.find()) {
            return trechoFinal.contains(doc.group(1));
        }
        return false;
    }

    private static String normalizarComparacaoQualificacao(String texto) {
        if (!StringUtils.hasText(texto)) {
            return "";
        }
        String t = Normalizer.normalize(texto, Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return t.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]", "");
    }
}
