package br.com.vilareal.projudi;

import org.springframework.util.StringUtils;

import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.util.List;

/** Montagem de corpos {@code application/x-www-form-urlencoded} do fluxo inicial {@code /ProcessoCivel}. */
final class ProjudiProcessoCivelInicialCorpoUtil {

    private static final String DEPENDENCIA_PROCESSO = "2";

    private ProjudiProcessoCivelInicialCorpoUtil() {}

    static String montarCorpoWizardInicial(String paginaAnterior) {
        return "PaginaAtual=-1&PaginaAnterior="
                + encIso(paginaAnterior)
                + "&PassoEditar=-1&ParteTipo=0&TituloPagina=null&dependente=false&custaTipo=&Passo1=Passo+1&Passo2=&Passo3="
                + "&grauProcesso=1&numeroCompletoGuiaInicial=&ProcessoNumero=";
    }

    static String montarCorpoTipoAssistencia() {
        return "PaginaAtual=-1&PaginaAnterior=-1&PassoEditar=-1&ParteTipo=0&TituloPagina=null&dependente=false"
                + "&custaTipo=&Passo1=Passo+1&Passo2=&Passo3=&grauProcesso=1&tipoProcesso=1&assistenciaProcesso=3"
                + "&numeroCompletoGuiaInicial=&ProcessoNumero=";
    }

    /** POST custas + sem dependência de outro processo ({@code custaTipo=3}, {@code dependenciaProcesso=2}). */
    static String montarCorpoCustasSemDependencia() {
        return montarCorpoEstado("", "-1", "-1", "-1", "0", false, ProjudiClasseProcessoInicial.JEC);
    }

    static String montarCorpoPasso1Area(
            String valorCausa, String paginaAtual, String paginaAnterior, ProjudiClasseProcessoInicial classe) {
        return montarCorpoEstado(valorCausa, paginaAtual, paginaAnterior, "-1", "0", true, classeOuPadrao(classe))
                + "&imaLocalizarAssunto=&posicaoLista=";
    }

    static String montarCorpoAvancarAnexos(String valorCausa, ProjudiClasseProcessoInicial classe) {
        return montarCorpoEstado(valorCausa, "-1", "-1", "5", "0", true, classeOuPadrao(classe))
                + "&imgInserir=Avan%E7ar";
    }

    static String montarCorpoAbrirBuscaParte(
            String valorCausa, int parteTipo, String botaoLocalizar, ProjudiClasseProcessoInicial classe) {
        return montarCorpoEstado(valorCausa, "-1", "-1", "7", String.valueOf(parteTipo), true, classeOuPadrao(classe))
                + botaoLocalizar;
    }

    /**
     * POST Concluir anexos (PassoEditar=6) — alinhado ao fluxo real: {@code ArquivoTipo=Outros},
     * {@code Id_ArquivoTipo=1}, um {@code files[]} por anexo enviado ao PROJUDI.
     */
    static String montarCorpoConcluirAnexos(List<String> nomesArquivosUpload) {
        StringBuilder sb = new StringBuilder();
        sb.append("PaginaAtual=-1&PaginaAnterior=-1&PassoEditar=6");
        sb.append("&Passo1=Passo+1+OK&Passo2=Passo+2&Passo3=");
        sb.append("&assinado=true&gerarAssinatura=false");
        sb.append("&ArquivoTipo=Outros&Id_ArquivoTipo=1");
        if (nomesArquivosUpload != null) {
            for (String nome : nomesArquivosUpload) {
                if (StringUtils.hasText(nome)) {
                    sb.append("&files%5B%5D=").append(encIso(nome.trim()));
                }
            }
        }
        sb.append("&Id_Modelo=null&Modelo=&nomeArquivo=&TextoEditor=&arquivo=&imgConcluir=Concluir");
        return sb.toString();
    }

    /**
     * Estado acumulado do wizard (custaTipo, tipo/grau/assistência, dependenciaProcesso=2, comarca quando aplicável).
     */
    static String montarCorpoEstado(
            String valorCausa,
            String paginaAtual,
            String paginaAnterior,
            String passoEditar,
            String parteTipo,
            boolean comarcaPreenchida,
            ProjudiClasseProcessoInicial classe) {
        ProjudiClasseProcessoInicial classeEfetiva = classeOuPadrao(classe);
        StringBuilder sb = new StringBuilder();
        sb.append("PaginaAtual=").append(encIso(paginaAtual));
        sb.append("&PaginaAnterior=").append(encIso(paginaAnterior));
        sb.append("&PassoEditar=").append(encIso(passoEditar));
        sb.append("&ParteTipo=").append(encIso(parteTipo));
        sb.append("&TituloPagina=null&dependente=false&custaTipo=3&Passo1=Passo+1&Passo2=&Passo3=");
        sb.append("&grauProcesso=1&tipoProcesso=1&assistenciaProcesso=3");
        sb.append("&dependenciaProcesso=").append(DEPENDENCIA_PROCESSO);
        sb.append("&numeroCompletoGuiaInicial=&ProcessoNumero=&ProcessoDependente=&ProcessoNumeroDependente=");
        if (comarcaPreenchida) {
            sb.append("&Comarca=").append(encIso("ANÁPOLIS"));
            sb.append("&Id_Comarca=2");
            sb.append("&AreaDistribuicao=").append(encIso("Anápolis - Juizados Especiais Cíveis"));
            sb.append("&ForumCodigo=7&Id_AreaDistribuicao=19");
            sb.append("&ProcessoTipo=").append(encIso(classeEfetiva.processoTipoLabel()));
            sb.append("&Id_ProcessoTipo=")
                    .append(classeEfetiva.idProcessoTipo())
                    .append("&ProcessoTipoCodigo=")
                    .append(classeEfetiva.processoTipoCodigo())
                    .append("&posicaoLista=");
            sb.append("&ProcessoPrioridade=Normal&Id_ProcessoPrioridade=1");
            sb.append("&Valor=").append(encIso(valorCausa));
            sb.append("&TcoNumero=&Rai=&posicaoLista=");
        } else {
            sb.append("&Comarca=&Id_Comarca=&AreaDistribuicao=&ForumCodigo=&Id_AreaDistribuicao=");
            sb.append("&ProcessoTipo=&Id_ProcessoTipo=&ProcessoTipoCodigo=&posicaoLista=");
            sb.append("&ProcessoPrioridade=Normal&Id_ProcessoPrioridade=1");
            sb.append("&Valor=&TcoNumero=&Rai=&posicaoLista=");
        }
        return sb.toString();
    }

    private static ProjudiClasseProcessoInicial classeOuPadrao(ProjudiClasseProcessoInicial classe) {
        return classe != null ? classe : ProjudiClasseProcessoInicial.JEC;
    }

    static String encIso(String valor) {
        if (valor == null) {
            return "";
        }
        return URLEncoder.encode(valor, StandardCharsets.ISO_8859_1);
    }
}
