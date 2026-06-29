package br.com.vilareal.projudi;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;

/**
 * Catálogo fixo de assuntos/classes PROJUDI e regras de sugestão (modalidade) por natureza da ação.
 */
@Service
public class ProjudiAssuntoCatalogoService {

    public record AssuntoItem(int idAssunto, String rotuloCompleto) {}

    public record ClasseItem(
            String id,
            String rotulo,
            int idProcessoTipo,
            int processoTipoCodigo,
            String processoTipoLabel) {}

    public record ModalidadeItem(String id, String rotulo, String classeId, int idAssuntoSugerido) {}

    /** Resposta estendida; {@code idAssuntoSugerido} mantém compatibilidade com clientes antigos. */
    public record ModalidadeSugeridaResponse(
            Integer idAssuntoSugerido,
            Integer idProcessoTipo,
            Integer processoTipoCodigo,
            String modalidadeId,
            String modalidadeRotulo,
            String classeId,
            String classeRotulo) {}

    /** @deprecated use {@link #sugerirModalidade(String)} — mantido como alias de compatibilidade. */
    public record AssuntoSugeridoResponse(Integer idAssuntoSugerido) {}

    private static final List<AssuntoItem> CATALOGO = List.of(
            new AssuntoItem(
                    451,
                    "DIREITO CIVIL > Obrigações > Espécies de Títulos de Crédito > Nota Promissória"),
            new AssuntoItem(
                    985,
                    "DIREITO DO CONSUMIDOR > Responsabilidade do Fornecedor > Indenização por Dano Material"),
            new AssuntoItem(
                    1991,
                    "DIREITO CIVIL > Coisas > Propriedade > Condomínio em Edifício > Despesas Condominiais"));

    private static final List<ClasseItem> CLASSES = List.of(
            toClasseItem(ProjudiClasseProcessoInicial.JEC),
            toClasseItem(ProjudiClasseProcessoInicial.EXECUCAO_TITULO_EXTRAJUDICIAL));

    /**
     * Modalidades conhecidas — ordem das regras de natureza abaixo segue a mesma prioridade.
     */
    private static final List<ModalidadeItem> MODALIDADES = List.of(
            new ModalidadeItem(
                    "EXECUCAO_TAXA_CONDOMINIAL",
                    "Execução de Taxa Condominial",
                    ProjudiClasseProcessoInicial.EXECUCAO_TITULO_EXTRAJUDICIAL.id(),
                    1991),
            new ModalidadeItem(
                    "COBRANCA_JEC",
                    "Cobrança (Juizado Especial Cível)",
                    ProjudiClasseProcessoInicial.JEC.id(),
                    451));

    /** natureza normalizada (contém) → modalidade. Ordem importa (primeira regra que casar). */
    private static final List<Map.Entry<String, String>> REGRAS_MODALIDADE = List.of(
            Map.entry("EXECUCAO DE TAXA CONDOMINIAL", "EXECUCAO_TAXA_CONDOMINIAL"),
            Map.entry("COBRANCA", "COBRANCA_JEC"));

    public List<AssuntoItem> listarCatalogo() {
        return CATALOGO;
    }

    public List<ClasseItem> listarClasses() {
        return CLASSES;
    }

    public List<ModalidadeItem> listarModalidades() {
        return MODALIDADES;
    }

    public AssuntoSugeridoResponse sugerir(String naturezaAcao) {
        ModalidadeSugeridaResponse modalidade = sugerirModalidade(naturezaAcao);
        return new AssuntoSugeridoResponse(modalidade.idAssuntoSugerido());
    }

    public ModalidadeSugeridaResponse sugerirModalidade(String naturezaAcao) {
        ModalidadeItem modalidade = resolverModalidade(naturezaAcao);
        if (modalidade == null) {
            return new ModalidadeSugeridaResponse(null, null, null, null, null, null, null);
        }
        ClasseItem classe = buscarClassePorId(modalidade.classeId());
        return new ModalidadeSugeridaResponse(
                modalidade.idAssuntoSugerido(),
                classe.idProcessoTipo(),
                classe.processoTipoCodigo(),
                modalidade.id(),
                modalidade.rotulo(),
                classe.id(),
                classe.rotulo());
    }

    public Integer sugerirIdAssunto(String naturezaAcao) {
        ModalidadeItem modalidade = resolverModalidade(naturezaAcao);
        return modalidade != null ? modalidade.idAssuntoSugerido() : null;
    }

    public ProjudiClasseProcessoInicial resolverClasse(Integer idProcessoTipo, Integer processoTipoCodigo) {
        if (idProcessoTipo != null && processoTipoCodigo != null) {
            for (ClasseItem item : CLASSES) {
                if (item.idProcessoTipo() == idProcessoTipo && item.processoTipoCodigo() == processoTipoCodigo) {
                    return toClasseProcesso(item);
                }
            }
            throw new IllegalArgumentException(
                    "Classe PROJUDI desconhecida: Id_ProcessoTipo="
                            + idProcessoTipo
                            + " ProcessoTipoCodigo="
                            + processoTipoCodigo);
        }
        return ProjudiClasseProcessoInicial.JEC;
    }

    public ProjudiClasseProcessoInicial resolverClassePorId(String classeId) {
        ClasseItem item = buscarClassePorId(classeId);
        return toClasseProcesso(item);
    }

    private ModalidadeItem resolverModalidade(String naturezaAcao) {
        String norm = normalizarNaturezaAcao(naturezaAcao);
        if (!StringUtils.hasText(norm)) {
            return null;
        }
        for (Map.Entry<String, String> regra : REGRAS_MODALIDADE) {
            if (norm.contains(regra.getKey())) {
                return buscarModalidade(regra.getValue());
            }
        }
        return null;
    }

    private static ModalidadeItem buscarModalidade(String modalidadeId) {
        for (ModalidadeItem item : MODALIDADES) {
            if (item.id().equals(modalidadeId)) {
                return item;
            }
        }
        return null;
    }

    private static ClasseItem buscarClassePorId(String classeId) {
        for (ClasseItem item : CLASSES) {
            if (item.id().equals(classeId)) {
                return item;
            }
        }
        return toClasseItem(ProjudiClasseProcessoInicial.JEC);
    }

    private static ClasseItem toClasseItem(ProjudiClasseProcessoInicial classe) {
        return new ClasseItem(
                classe.id(),
                classe.rotulo(),
                classe.idProcessoTipo(),
                classe.processoTipoCodigo(),
                classe.processoTipoLabel());
    }

    private static ProjudiClasseProcessoInicial toClasseProcesso(ClasseItem item) {
        return new ProjudiClasseProcessoInicial(
                item.id(),
                item.rotulo(),
                item.idProcessoTipo(),
                item.processoTipoCodigo(),
                item.processoTipoLabel());
    }

    static String normalizarNaturezaAcao(String naturezaAcao) {
        if (!StringUtils.hasText(naturezaAcao)) {
            return "";
        }
        String upper = naturezaAcao.trim().toUpperCase(Locale.ROOT);
        return Normalizer.normalize(upper, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    }
}
