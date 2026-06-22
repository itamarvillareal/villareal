package br.com.vilareal.imovel.application;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse.GrupoDespesaCondominio;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse.ImovelCandidato;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse.SerieExtratoItem;
import br.com.vilareal.imovel.domain.ResponsavelPagamentoCondominio;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.LocacaoRepasseLancamentoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.LocacaoRepasseLancamentoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.text.Normalizer;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Detector de débitos recorrentes de condomínio no extrato (contas A/I),
 * agrupados por condomínio/imóvel (não por descrição isolada).
 */
@Service
public class DespesaCondominioCandidatoService {

    private static final int MIN_NOME_CONDOMINIO = 10;
    private static final Set<String> NOMES_CONDOMINIO_GENERICOS = Set.of(
            "CONDOMINIO",
            "RESIDENCIAL",
            "EDIFICIO",
            "EDIF",
            "CONDOMINIO RESIDENCIAL",
            "RESIDENCIAL CONDOMINIO");

    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ImovelRepository imovelRepository;
    private final LocacaoRepasseLancamentoRepository vinculoRepository;

    public DespesaCondominioCandidatoService(
            LancamentoFinanceiroRepository lancamentoRepository,
            ImovelRepository imovelRepository,
            LocacaoRepasseLancamentoRepository vinculoRepository) {
        this.lancamentoRepository = lancamentoRepository;
        this.imovelRepository = imovelRepository;
        this.vinculoRepository = vinculoRepository;
    }

    @Transactional(readOnly = true)
    public DespesaCondominioCandidatosResponse candidatosDespesaCondominio() {
        List<GrupoDespesaCondominio> todos = listarGruposDetectados();
        Set<Long> confirmados = imoveisComCondominioEscritorio();
        List<GrupoDespesaCondominio> pendentes = todos.stream()
                .map(g -> filtrarConfirmados(g, confirmados))
                .filter(Objects::nonNull)
                .toList();

        int unicos = 0;
        int compartilhados = 0;
        int semMatch = 0;
        for (GrupoDespesaCondominio g : pendentes) {
            switch (g.confianca()) {
                case ALTA -> unicos++;
                case MEDIA -> compartilhados++;
                case BAIXA -> semMatch++;
            }
        }
        return new DespesaCondominioCandidatosResponse(pendentes.size(), unicos, compartilhados, semMatch, pendentes);
    }

    @Transactional(readOnly = true)
    public Optional<GrupoDespesaCondominio> buscarGrupoPorObrigacaoChave(String obrigacaoChave) {
        if (!StringUtils.hasText(obrigacaoChave)) {
            return Optional.empty();
        }
        String chave = obrigacaoChave.trim();
        return listarGruposDetectados().stream()
                .filter(g -> chave.equals(g.obrigacaoChave()))
                .findFirst();
    }

    /** @deprecated use {@link #buscarGrupoPorObrigacaoChave} */
    @Transactional(readOnly = true)
    public Optional<GrupoDespesaCondominio> buscarGrupoPorDescricaoNorm(String descricaoNorm) {
        return buscarGrupoPorObrigacaoChave(descricaoNorm);
    }

    private List<GrupoDespesaCondominio> listarGruposDetectados() {
        List<LancamentoFinanceiroEntity> debitos = lancamentoRepository.findDebitosCondominioContasAdministracao();
        List<ImovelEntity> imoveisAtivos = imovelRepository.findAllByOrderByIdAsc().stream()
                .filter(i -> Boolean.TRUE.equals(i.getAtivo()))
                .toList();
        Map<String, List<ImovelEntity>> imoveisPorCondominio = indexarImoveisPorCondominio(imoveisAtivos);
        Set<Long> imoveisComHistorico = carregarImoveisComHistoricoDespesa();

        List<DespesaCondominioAgrupador.FluxoDebitos> fluxos = DespesaCondominioAgrupador.agrupar(
                debitos,
                imoveisAtivos,
                imoveisPorCondominio,
                this::chaveCondominio,
                this::normalizarComparacao);

        List<GrupoDespesaCondominio> grupos = fluxos.stream()
                .map(f -> montarGrupoFluxo(f, imoveisComHistorico))
                .sorted(Comparator.comparingInt((GrupoDespesaCondominio g) -> -g.ocorrencias())
                        .thenComparing(g -> g.condominioNome() != null ? g.condominioNome() : g.obrigacaoChave()))
                .toList();
        return grupos;
    }

    private GrupoDespesaCondominio montarGrupoFluxo(
            DespesaCondominioAgrupador.FluxoDebitos fluxo, Set<Long> imoveisComHistorico) {
        ConfiancaSugestao confianca =
                fluxo.imovelUnico() ? ConfiancaSugestao.ALTA : ConfiancaSugestao.MEDIA;

        Long imovelId = fluxo.imovelId();
        ImovelEntity imovel = fluxo.imovelUnico() && imovelId != null
                ? imovelRepository.findById(imovelId).orElse(null)
                : null;

        Integer numPlanilha = imovel != null ? imovel.getNumeroPlanilha() : null;
        String rotulo = imovel != null ? rotuloImovel(imovel) : null;
        boolean historico = imovelId != null && imoveisComHistorico.contains(imovelId);

        List<ImovelCandidato> candidatos = fluxo.imoveisCandidatos().stream()
                .sorted(Comparator.comparing(
                        ImovelEntity::getNumeroPlanilha, Comparator.nullsLast(Integer::compareTo)))
                .map(DespesaCondominioCandidatoService::toCandidato)
                .toList();

        List<SerieExtratoItem> serie = fluxo.serie().stream()
                .map(s -> new SerieExtratoItem(s.mes(), s.valor(), s.grafia()))
                .toList();

        List<String> meses = serie.stream().map(SerieExtratoItem::mes).toList();
        String descricaoExemplo = fluxo.grafias().isEmpty()
                ? fluxo.condominioRotulo()
                : fluxo.grafias().get(fluxo.grafias().size() - 1);

        return new GrupoDespesaCondominio(
                fluxo.obrigacaoChave(),
                fluxo.condominioRotulo(),
                fluxo.grafias(),
                descricaoExemplo,
                fluxo.valorEstimado(),
                fluxo.diaTipico(),
                fluxo.debitos().size(),
                meses,
                serie,
                fluxo.grafias().size() > 1,
                confianca,
                imovelId,
                numPlanilha,
                rotulo,
                candidatos,
                historico);
    }

    private Set<Long> imoveisComCondominioEscritorio() {
        return imovelRepository.findAllByOrderByIdAsc().stream()
                .filter(i -> ResponsavelPagamentoCondominio.ESCRITORIO.equals(i.getResponsavelPagamentoCondominio()))
                .map(ImovelEntity::getId)
                .collect(Collectors.toSet());
    }

    private Set<Long> carregarImoveisComHistoricoDespesa() {
        Set<Long> out = new java.util.LinkedHashSet<>();
        for (LocacaoRepasseLancamentoEntity v : vinculoRepository.findHistoricoDespesa()) {
            if (v.getContratoLocacao() != null && v.getContratoLocacao().getImovel() != null) {
                out.add(v.getContratoLocacao().getImovel().getId());
            }
        }
        return out;
    }

    private static GrupoDespesaCondominio filtrarConfirmados(GrupoDespesaCondominio g, Set<Long> confirmados) {
        if (g.confianca() == ConfiancaSugestao.ALTA
                && g.imovelSugeridoId() != null
                && confirmados.contains(g.imovelSugeridoId())) {
            return null;
        }
        if (g.confianca() == ConfiancaSugestao.MEDIA) {
            List<ImovelCandidato> restantes = g.unidadesCandidatas().stream()
                    .filter(u -> !confirmados.contains(u.imovelId()))
                    .toList();
            if (restantes.isEmpty()) {
                return null;
            }
            if (restantes.size() == g.unidadesCandidatas().size()) {
                return g;
            }
            return new GrupoDespesaCondominio(
                    g.obrigacaoChave(),
                    g.condominioNome(),
                    g.grafias(),
                    g.descricaoExemplo(),
                    g.valorEstimado(),
                    g.diaTipico(),
                    g.ocorrencias(),
                    g.mesesCobertos(),
                    g.serieExtrato(),
                    g.grafiasMesmaObrigacao(),
                    g.confianca(),
                    null,
                    null,
                    null,
                    restantes,
                    g.historicoDespesaConfirmado());
        }
        return g;
    }

    private static Map<String, List<ImovelEntity>> indexarImoveisPorCondominio(List<ImovelEntity> imoveis) {
        Map<String, List<ImovelEntity>> mapa = new LinkedHashMap<>();
        for (ImovelEntity i : imoveis) {
            String chave = chaveCondominioStatic(i.getCondominio());
            if (chave == null) {
                continue;
            }
            mapa.computeIfAbsent(chave, k -> new ArrayList<>()).add(i);
        }
        return mapa;
    }

    private String chaveCondominio(String condominio) {
        return chaveCondominioStatic(condominio);
    }

    private static String chaveCondominioStatic(String condominio) {
        String n = normalizarComparacaoStatic(condominio);
        if (!StringUtils.hasText(n) || n.length() < MIN_NOME_CONDOMINIO || NOMES_CONDOMINIO_GENERICOS.contains(n)) {
            return null;
        }
        return n;
    }

    private String normalizarComparacao(String texto) {
        return normalizarComparacaoStatic(texto);
    }

    private static String normalizarComparacaoStatic(String texto) {
        if (!StringUtils.hasText(texto)) {
            return null;
        }
        String semAcento = Normalizer.normalize(texto.trim(), Normalizer.Form.NFD).replaceAll("\\p{M}", "");
        return semAcento.toUpperCase(Locale.ROOT).replaceAll("\\s+", " ");
    }

    private static ImovelCandidato toCandidato(ImovelEntity i) {
        return new ImovelCandidato(
                i.getId(),
                i.getNumeroPlanilha(),
                i.getUnidade(),
                i.getCondominio(),
                resumirEndereco(i.getEnderecoCompleto()));
    }

    private static String rotuloImovel(ImovelEntity i) {
        StringBuilder sb = new StringBuilder();
        if (i.getNumeroPlanilha() != null) {
            sb.append('#').append(i.getNumeroPlanilha());
        }
        if (StringUtils.hasText(i.getUnidade())) {
            if (!sb.isEmpty()) {
                sb.append(" · ");
            }
            sb.append(i.getUnidade().trim());
        }
        if (StringUtils.hasText(i.getCondominio())) {
            if (!sb.isEmpty()) {
                sb.append(" · ");
            }
            sb.append(i.getCondominio().trim());
        }
        return !sb.isEmpty() ? sb.toString() : "Imóvel " + i.getId();
    }

    private static String resumirEndereco(String endereco) {
        if (!StringUtils.hasText(endereco)) {
            return null;
        }
        String s = endereco.trim();
        return s.length() > 80 ? s.substring(0, 77) + "…" : s;
    }
}
