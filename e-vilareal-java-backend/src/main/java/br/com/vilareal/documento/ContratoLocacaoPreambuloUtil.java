package br.com.vilareal.documento;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/** Complemento do preâmbulo do contrato de locação com fiadores. */
final class ContratoLocacaoPreambuloUtil {

    private static final Pattern ANTES_TEM_POR_JUSTO = Pattern.compile(
            ",\\s*t[eê]m por justo e contratado", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

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
}
