package br.com.vilareal.projudi;

import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiAssuntoCadastroEntity;
import br.com.vilareal.projudi.infrastructure.persistence.entity.ProjudiAssuntoOcultoEntity;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiAssuntoCadastroRepository;
import br.com.vilareal.projudi.infrastructure.persistence.repository.ProjudiAssuntoOcultoRepository;

import java.text.Normalizer;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Catálogo fixo de assuntos/classes PROJUDI e regras de sugestão (modalidade) por natureza da ação.
 */
@Service
public class ProjudiAssuntoCatalogoService {

    public record AssuntoItem(int idAssunto, String rotuloCompleto, boolean cadastroUsuario) {

        public AssuntoItem(int idAssunto, String rotuloCompleto) {
            this(idAssunto, rotuloCompleto, false);
        }
    }

    public record ClasseItem(
            String id,
            String rotulo,
            int idProcessoTipo,
            int processoTipoCodigo,
            String processoTipoLabel,
            /** Valor enviado ao PROJUDI no campo «Área Distribuição» (Passo 1). */
            String areaDistribuicao,
            /** Rótulo amigável: Juizado Especial Cível vs Justiça Comum (Vara Cível). */
            String destinoJustica) {}

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
                    "DIREITO CIVIL > Coisas > Propriedade > Condomínio em Edifício > Despesas Condominiais"),
            new AssuntoItem(
                    8574,
                    "DIREITO CIVIL > Obrigações > Espécies de Contratos > Locação de Imóvel > Despejo por Inadimplemento"));

    private static final List<ClasseItem> CLASSES = List.of(
            toClasseItem(ProjudiClasseProcessoInicial.JEC),
            toClasseItem(ProjudiClasseProcessoInicial.EXECUCAO_TITULO_EXTRAJUDICIAL),
            toClasseItem(ProjudiClasseProcessoInicial.DESPEJO_VARA_CIVEL));

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
                    451),
            new ModalidadeItem(
                    "DESPEJO_VARA_CIVEL",
                    "Despejo por Inadimplemento (Vara Cível)",
                    ProjudiClasseProcessoInicial.DESPEJO_VARA_CIVEL.id(),
                    8574));

    /** natureza normalizada (contém) → modalidade. Ordem importa (primeira regra que casar). */
    private static final List<Map.Entry<String, String>> REGRAS_MODALIDADE = List.of(
            Map.entry("EXECUCAO DE TAXA CONDOMINIAL", "EXECUCAO_TAXA_CONDOMINIAL"),
            Map.entry("DESPEJO", "DESPEJO_VARA_CIVEL"),
            Map.entry("COBRANCA", "COBRANCA_JEC"));

    private final ProjudiAssuntoCadastroRepository assuntoCadastroRepository;
    private final ProjudiAssuntoOcultoRepository assuntoOcultoRepository;

    public ProjudiAssuntoCatalogoService(
            ProjudiAssuntoCadastroRepository assuntoCadastroRepository,
            ProjudiAssuntoOcultoRepository assuntoOcultoRepository) {
        this.assuntoCadastroRepository = assuntoCadastroRepository;
        this.assuntoOcultoRepository = assuntoOcultoRepository;
    }

    public List<AssuntoItem> listarCatalogo() {
        Set<Integer> ocultos = idsAssuntosOcultos();
        Map<Integer, AssuntoItem> porId = new LinkedHashMap<>();
        for (AssuntoItem item : CATALOGO) {
            if (!ocultos.contains(item.idAssunto())) {
                porId.put(item.idAssunto(), item);
            }
        }
        for (ProjudiAssuntoCadastroEntity cadastro : assuntoCadastroRepository.findAllByOrderByIdAssuntoAsc()) {
            porId.put(
                    cadastro.getIdAssunto(),
                    new AssuntoItem(cadastro.getIdAssunto(), cadastro.getDescricao().trim(), true));
        }
        return porId.values().stream()
                .sorted(Comparator.comparingInt(AssuntoItem::idAssunto))
                .toList();
    }

    public AssuntoItem cadastrarAssunto(int idAssunto, String descricao) {
        if (idAssunto < 1) {
            throw new IllegalArgumentException("idAssunto deve ser positivo.");
        }
        String rotulo = StringUtils.hasText(descricao) ? descricao.trim() : "";
        if (!StringUtils.hasText(rotulo)) {
            throw new IllegalArgumentException("descricao é obrigatória.");
        }
        if (rotulo.length() > 500) {
            rotulo = rotulo.substring(0, 500);
        }
        Set<Integer> fixos = CATALOGO.stream().map(AssuntoItem::idAssunto).collect(Collectors.toSet());
        if (fixos.contains(idAssunto) && !idsAssuntosOcultos().contains(idAssunto)) {
            throw new IllegalArgumentException(
                    "Id " + idAssunto + " já faz parte do catálogo fixo do sistema.");
        }
        if (assuntoOcultoRepository.existsById(idAssunto)) {
            assuntoOcultoRepository.deleteById(idAssunto);
        }
        ProjudiAssuntoCadastroEntity entity = assuntoCadastroRepository
                .findById(idAssunto)
                .orElseGet(ProjudiAssuntoCadastroEntity::new);
        entity.setIdAssunto(idAssunto);
        entity.setDescricao(rotulo);
        assuntoCadastroRepository.save(entity);
        return new AssuntoItem(idAssunto, rotulo, true);
    }

    public void removerAssuntoCadastro(int idAssunto) {
        if (idAssunto < 1) {
            throw new IllegalArgumentException("idAssunto inválido.");
        }
        if (assuntoCadastroRepository.existsById(idAssunto)) {
            assuntoCadastroRepository.deleteById(idAssunto);
            return;
        }
        boolean fixo = CATALOGO.stream().anyMatch(a -> a.idAssunto() == idAssunto);
        if (fixo) {
            if (!assuntoOcultoRepository.existsById(idAssunto)) {
                ProjudiAssuntoOcultoEntity oculto = new ProjudiAssuntoOcultoEntity();
                oculto.setIdAssunto(idAssunto);
                assuntoOcultoRepository.save(oculto);
            }
            return;
        }
        throw new IllegalArgumentException("Assunto não encontrado: " + idAssunto);
    }

    private Set<Integer> idsAssuntosOcultos() {
        return assuntoOcultoRepository.findAll().stream()
                .map(ProjudiAssuntoOcultoEntity::getIdAssunto)
                .collect(Collectors.toSet());
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
            return ProjudiClasseProcessoInicial.porCodigos(idProcessoTipo, processoTipoCodigo);
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
                classe.processoTipoLabel(),
                classe.areaDistribuicao(),
                destinoJusticaDe(classe));
    }

    static String destinoJusticaDe(ProjudiClasseProcessoInicial classe) {
        if (classe == null || !StringUtils.hasText(classe.areaDistribuicao())) {
            return "—";
        }
        String area = classe.areaDistribuicao();
        if (area.contains("Juizado")) {
            return "Juizado Especial Cível";
        }
        if (area.contains("Cível")) {
            return "Justiça Comum (Vara Cível)";
        }
        return area;
    }

    private static ProjudiClasseProcessoInicial toClasseProcesso(ClasseItem item) {
        return ProjudiClasseProcessoInicial.porId(item.id());
    }

    static String normalizarNaturezaAcao(String naturezaAcao) {
        if (!StringUtils.hasText(naturezaAcao)) {
            return "";
        }
        String upper = naturezaAcao.trim().toUpperCase(Locale.ROOT);
        return Normalizer.normalize(upper, Normalizer.Form.NFD).replaceAll("\\p{M}+", "");
    }
}
