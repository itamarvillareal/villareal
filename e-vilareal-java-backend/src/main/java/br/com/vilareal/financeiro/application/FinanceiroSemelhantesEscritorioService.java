package br.com.vilareal.financeiro.application;

import br.com.vilareal.calculo.infrastructure.persistence.entity.CalculoRodadaEntity;
import br.com.vilareal.calculo.infrastructure.persistence.repository.CalculoRodadaRepository;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.DescartarSemelhanteEscritorioItemRequest;
import br.com.vilareal.financeiro.api.dto.DescartarSemelhanteEscritorioRequest;
import br.com.vilareal.financeiro.api.dto.DescartarSemelhanteEscritorioResponse;
import br.com.vilareal.financeiro.api.dto.InboxSemelhantesPaginaResponse;
import br.com.vilareal.financeiro.api.dto.SemelhanteEscritorioGrupoResponse;
import br.com.vilareal.financeiro.api.dto.SemelhanteEscritorioItemResponse;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.FinanceiroDescricaoNomeUtil;
import br.com.vilareal.financeiro.domain.ProcessoVinculoSugestaoPrioridadeUtil;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioCalculoMatcher;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher.HistoricoSlot;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher.MatchResult;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher.PendenteItem;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioNomeMatcher;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioNomeMatcher.PessoaProcessoRef;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.SemelhanteEscritorioDescarteEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.SemelhanteEscritorioDescarteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.api.dto.ProcessoPartesVinculoTexto;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class FinanceiroSemelhantesEscritorioService {

    private static final String CONTA_ESCRITORIO = "A";

    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final CalculoRodadaRepository calculoRodadaRepository;
    private final PessoaRepository pessoaRepository;
    private final SemelhanteEscritorioDescarteRepository descarteRepository;

    public FinanceiroSemelhantesEscritorioService(
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService,
            CalculoRodadaRepository calculoRodadaRepository,
            PessoaRepository pessoaRepository,
            SemelhanteEscritorioDescarteRepository descarteRepository) {
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
        this.calculoRodadaRepository = calculoRodadaRepository;
        this.pessoaRepository = pessoaRepository;
        this.descarteRepository = descarteRepository;
    }

    @Transactional(readOnly = true)
    public InboxSemelhantesPaginaResponse listarInbox(
            Integer numeroBanco, Integer ano, Integer mes, String confianca, Pageable pageable) {
        ContaContabilEntity contaA = contaContabilRepository
                .findFirstByCodigoIgnoreCase(CONTA_ESCRITORIO)
                .orElse(null);
        Long contaAId = contaA != null ? contaA.getId() : null;
        String contaACodigo = contaA != null ? contaA.getCodigo() : CONTA_ESCRITORIO;

        List<PendenteItem> pendentes = lancamentoRepository
                .findPendentesSemelhantesEscritorio(numeroBanco, ano, mes)
                .stream()
                .filter(FinanceiroSemelhantesEscritorioService::pendenteContaEscritorio)
                .map(this::toPendenteItem)
                .toList();

        List<HistoricoSlot> historico = lancamentoRepository
                .findHistoricoVinculadoContaA(numeroBanco)
                .stream()
                .map(this::toHistoricoSlot)
                .toList();

        List<MatchResult> matches = filtrarRejeitados(parearEmCamadas(pendentes, historico), pendentes);
        List<SemelhanteEscritorioGrupoResponse> grupos = agruparMatches(matches, contaAId, contaACodigo);
        enriquecerPartesProcesso(grupos);

        if (StringUtils.hasText(confianca)) {
            String alvo = confianca.trim().toUpperCase();
            grupos = grupos.stream()
                    .filter(g -> alvo.equalsIgnoreCase(String.valueOf(g.getConfianca())))
                    .toList();
        }

        grupos.sort(Comparator.comparingInt((SemelhanteEscritorioGrupoResponse g) -> ordemConfianca(g.getConfianca()))
                .thenComparingInt(SemelhanteEscritorioGrupoResponse::getQtdPendentes)
                .reversed()
                .thenComparing(g -> g.getDescricaoExemplo() != null ? g.getDescricaoExemplo() : ""));

        long totalItens = grupos.stream().mapToLong(SemelhanteEscritorioGrupoResponse::getQtdPendentes).sum();
        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), grupos.size());
        List<SemelhanteEscritorioGrupoResponse> pagina =
                start >= grupos.size() ? List.of() : grupos.subList(start, end);

        InboxSemelhantesPaginaResponse resp = new InboxSemelhantesPaginaResponse();
        resp.setContent(pagina);
        resp.setTotalElements(grupos.size());
        resp.setTotalPages(pageable.getPageSize() > 0
                ? (int) Math.ceil((double) grupos.size() / pageable.getPageSize())
                : 1);
        resp.setPage(pageable.getPageNumber());
        resp.setSize(pageable.getPageSize());
        resp.setTotalItensAcionaveis(totalItens);
        return resp;
    }

    @Transactional(readOnly = true)
    public long contarItensAcionaveis(Integer numeroBanco, Integer ano, Integer mes) {
        return listarInbox(numeroBanco, ano, mes, null, Pageable.ofSize(1)).getTotalItensAcionaveis();
    }

    @Transactional
    public DescartarSemelhanteEscritorioResponse descartarSugestoes(DescartarSemelhanteEscritorioRequest request) {
        DescartarSemelhanteEscritorioResponse response = new DescartarSemelhanteEscritorioResponse();
        if (request == null || request.getItens() == null) {
            return response;
        }
        for (DescartarSemelhanteEscritorioItemRequest item : request.getItens()) {
            if (item.getLancamentoId() == null || item.getClienteId() == null || item.getProcessoId() == null) {
                continue;
            }
            if (descarteRepository.existsByLancamentoIdAndClienteIdAndProcessoId(
                    item.getLancamentoId(), item.getClienteId(), item.getProcessoId())) {
                response.setJaDescartados(response.getJaDescartados() + 1);
                continue;
            }
            SemelhanteEscritorioDescarteEntity e = new SemelhanteEscritorioDescarteEntity();
            e.setLancamentoId(item.getLancamentoId());
            e.setClienteId(item.getClienteId());
            e.setProcessoId(item.getProcessoId());
            descarteRepository.save(e);
            response.setDescartados(response.getDescartados() + 1);
        }
        return response;
    }

    List<MatchResult> filtrarRejeitados(List<MatchResult> matches, List<PendenteItem> pendentes) {
        if (matches.isEmpty()) {
            return matches;
        }
        Set<Long> ids = pendentes.stream()
                .map(PendenteItem::lancamentoId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (ids.isEmpty()) {
            return matches;
        }
        Set<String> rejeitados = descarteRepository.findByLancamentoIdIn(ids).stream()
                .map(d -> chaveRejeicao(d.getLancamentoId(), d.getClienteId(), d.getProcessoId()))
                .collect(Collectors.toSet());
        if (rejeitados.isEmpty()) {
            return matches;
        }
        return matches.stream().filter(m -> !rejeitada(m, rejeitados)).toList();
    }

    static String chaveRejeicao(Long lancamentoId, Long clienteId, Long processoId) {
        return lancamentoId + "|" + clienteId + "|" + processoId;
    }

    private static boolean rejeitada(MatchResult m, Set<String> rejeitados) {
        if (m.pendente() == null || m.pendente().lancamentoId() == null) {
            return false;
        }
        if (m.sugestaoClienteId() == null || m.sugestaoProcessoId() == null) {
            return false;
        }
        return rejeitados.contains(chaveRejeicao(
                m.pendente().lancamentoId(), m.sugestaoClienteId(), m.sugestaoProcessoId()));
    }

    List<MatchResult> parearEmCamadas(List<PendenteItem> pendentes, List<HistoricoSlot> historico) {
        Set<Long> vinculados = new HashSet<>();
        List<MatchResult> out = new ArrayList<>();

        for (MatchResult m : SemelhanteEscritorioMatcher.parear(pendentes, historico)) {
            out.add(m);
            vinculados.add(m.pendente().lancamentoId());
        }

        List<PendenteItem> restantes = pendentes.stream()
                .filter(p -> p.lancamentoId() != null && !vinculados.contains(p.lancamentoId()))
                .toList();

        for (MatchResult m : parearPorCalculo(restantes)) {
            out.add(m);
            vinculados.add(m.pendente().lancamentoId());
        }

        restantes = pendentes.stream()
                .filter(p -> p.lancamentoId() != null && !vinculados.contains(p.lancamentoId()))
                .toList();

        for (MatchResult m : parearPorNome(restantes)) {
            out.add(m);
            vinculados.add(m.pendente().lancamentoId());
        }

        return out;
    }

    private List<MatchResult> parearPorCalculo(List<PendenteItem> pendentes) {
        if (pendentes.isEmpty()) {
            return List.of();
        }
        List<CalculoRodadaEntity> rodadas = calculoRodadaRepository.findByParcelamentoAceitoTrue();
        if (rodadas.isEmpty()) {
            return List.of();
        }

        Map<String, Long> clienteIdPorCodigo = new HashMap<>();
        for (String cod : SemelhanteEscritorioCalculoMatcher.codigosUnicos(rodadas)) {
            clienteRepository.findByCodigoCliente(cod).ifPresent(c -> clienteIdPorCodigo.put(cod, c.getId()));
        }

        Map<String, Long> processoIdPorClienteProc = new HashMap<>();
        for (CalculoRodadaEntity r : rodadas) {
            if (!r.isParcelamentoAceito()) {
                continue;
            }
            String cod = SemelhanteEscritorioCalculoMatcher.normalizarCod8(r.getCodigoCliente());
            Long clienteId = clienteIdPorCodigo.get(cod);
            if (clienteId == null || r.getNumeroProcesso() == null) {
                continue;
            }
            processoRepository
                    .findByCliente_IdAndNumeroInterno(clienteId, r.getNumeroProcesso())
                    .ifPresent(p -> SemelhanteEscritorioCalculoMatcher.registrarProcesso(
                            processoIdPorClienteProc, clienteId, r.getNumeroProcesso(), p.getId()));
        }

        return SemelhanteEscritorioCalculoMatcher.parear(
                pendentes, rodadas, clienteIdPorCodigo, processoIdPorClienteProc);
    }

    private List<MatchResult> parearPorNome(List<PendenteItem> pendentes) {
        if (pendentes.isEmpty()) {
            return List.of();
        }

        Set<String> descricoesNorm = new LinkedHashSet<>();
        for (PendenteItem p : pendentes) {
            String dn = FinanceiroDescricaoNomeUtil.normalizarTextoDescricao(p.descricao(), null);
            if (StringUtils.hasText(dn)) {
                descricoesNorm.add(dn);
            }
        }
        if (descricoesNorm.isEmpty()) {
            return List.of();
        }

        List<Object[]> todasRows = new ArrayList<>();
        for (String descNorm : descricoesNorm) {
            todasRows.addAll(processoRepository.findPessoaProcessoIdsPorNomeContidoNaDescricao(descNorm));
        }
        if (todasRows.isEmpty()) {
            return List.of();
        }

        Map<Long, String> nomesPorPessoaId = new LinkedHashMap<>();
        for (Object[] row : todasRows) {
            if (row == null || row[0] == null) {
                continue;
            }
            Long pessoaId = ((Number) row[0]).longValue();
            nomesPorPessoaId.computeIfAbsent(
                    pessoaId,
                    id -> pessoaRepository.findById(id).map(PessoaEntity::getNome).orElse(null));
        }

        Map<Long, Long> clienteIdPorProcessoId = new HashMap<>();
        for (Object[] row : todasRows) {
            if (row == null || row.length < 2 || row[1] == null) {
                continue;
            }
            Long processoId = ((Number) row[1]).longValue();
            clienteIdPorProcessoId.computeIfAbsent(
                    processoId,
                    id -> processoRepository
                            .findById(id)
                            .map(ProcessoEntity::getCliente)
                            .map(ClienteEntity::getId)
                            .orElse(null));
        }

        List<PessoaProcessoRef> refs =
                SemelhanteEscritorioNomeMatcher.refsFromQueryRows(todasRows, nomesPorPessoaId, clienteIdPorProcessoId);
        Set<Long> processoIds =
                refs.stream().map(PessoaProcessoRef::processoId).filter(Objects::nonNull).collect(Collectors.toSet());
        Map<Long, ProcessoVinculoSugestaoPrioridadeUtil.AtividadeProcesso> atividade = Map.of();
        if (!processoIds.isEmpty()) {
            atividade = ProcessoVinculoSugestaoPrioridadeUtil.indexarLinhasAtividade(
                    lancamentoRepository.findAtividadeClassificadaPorProcessoIds(processoIds));
        }
        return SemelhanteEscritorioNomeMatcher.parear(pendentes, refs, nomesPorPessoaId, atividade);
    }

    private List<SemelhanteEscritorioGrupoResponse> agruparMatches(
            List<MatchResult> matches, Long contaAId, String contaACodigo) {
        Map<String, SemelhanteEscritorioGrupoResponse> map = new LinkedHashMap<>();
        for (MatchResult m : matches) {
            String chave = SemelhanteEscritorioMatcher.chaveGrupo(m);
            SemelhanteEscritorioGrupoResponse grupo =
                    map.computeIfAbsent(chave, k -> novoGrupo(m));
            grupo.getItens().add(toItemResponse(m, contaAId, contaACodigo));
            grupo.setQtdPendentes(grupo.getItens().size());
        }
        return new ArrayList<>(map.values());
    }

    private static SemelhanteEscritorioGrupoResponse novoGrupo(MatchResult m) {
        PendenteItem p = m.pendente();
        SemelhanteEscritorioGrupoResponse g = new SemelhanteEscritorioGrupoResponse();
        g.setDescricaoNorm(p.descricaoNorm());
        g.setDescricaoExemplo(Utf8MojibakeUtil.corrigir(p.descricao()));
        g.setNumeroBanco(p.numeroBanco());
        g.setBancoNome(Utf8MojibakeUtil.corrigir(p.bancoNome()));
        g.setValor(p.valor() != null ? p.valor().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        g.setQtdHistorico(m.totalHistoricoChave());
        g.setOrigem(m.origem().name());
        g.setConfianca(m.confianca().name());
        return g;
    }

    private SemelhanteEscritorioItemResponse toItemResponse(MatchResult m, Long contaAId, String contaACodigo) {
        PendenteItem p = m.pendente();
        SemelhanteEscritorioItemResponse item = new SemelhanteEscritorioItemResponse();
        item.setLancamentoId(p.lancamentoId());
        item.setDataLancamento(p.dataLancamento());
        item.setDescricao(Utf8MojibakeUtil.corrigir(p.descricao()));
        item.setValor(p.valor() != null ? p.valor().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        item.setBancoNome(Utf8MojibakeUtil.corrigir(p.bancoNome()));
        item.setContaContabilId(contaAId);
        item.setContaCodigo(contaACodigo);
        item.setSugestaoClienteId(m.sugestaoClienteId());
        item.setSugestaoProcessoId(m.sugestaoProcessoId());
        item.setReferenciaHistoricoLancamentoId(m.referenciaHistoricoLancamentoId());
        item.setReferenciaHistoricoData(m.referenciaHistoricoData());
        item.setIndicePar(m.indicePar());
        item.setTotalHistoricoChave(m.totalHistoricoChave());
        item.setTotalPendenteChave(m.totalPendenteChave());
        item.setOrigem(m.origem().name());
        item.setConfianca(m.confianca().name());
        item.setDescricaoRegra(m.descricaoRegra());
        item.setPagadorPessoaId(m.pagadorPessoaId());

        if (m.sugestaoClienteId() != null) {
            clienteRepository.findById(m.sugestaoClienteId()).ifPresent(c -> {
                item.setSugestaoClienteNome(nomeCliente(c));
                item.setSugestaoCodigoCliente(c.getCodigoCliente());
            });
        }
        if (m.sugestaoProcessoId() != null) {
            processoRepository.findById(m.sugestaoProcessoId()).ifPresent(pr -> item.setSugestaoProcessoNumero(numeroProcesso(pr)));
        }
        return item;
    }

    private void enriquecerPartesProcesso(List<SemelhanteEscritorioGrupoResponse> grupos) {
        Set<Long> processoIds = grupos.stream()
                .flatMap(g -> g.getItens().stream())
                .map(SemelhanteEscritorioItemResponse::getSugestaoProcessoId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (processoIds.isEmpty()) {
            return;
        }
        Map<Long, ProcessoPartesVinculoTexto> partes =
                processoApplicationService.resolverTextosPartesVinculoEmLote(processoIds);
        if (partes == null || partes.isEmpty()) {
            return;
        }
        for (SemelhanteEscritorioGrupoResponse g : grupos) {
            for (SemelhanteEscritorioItemResponse item : g.getItens()) {
                if (item.getSugestaoProcessoId() == null) {
                    continue;
                }
                ProcessoPartesVinculoTexto pt = partes.get(item.getSugestaoProcessoId());
                if (pt == null) {
                    continue;
                }
                if (StringUtils.hasText(pt.getParteCliente())) {
                    item.setSugestaoParteCliente(Utf8MojibakeUtil.corrigir(pt.getParteCliente().trim()));
                }
                if (StringUtils.hasText(pt.getParteOposta())) {
                    item.setSugestaoParteOposta(Utf8MojibakeUtil.corrigir(pt.getParteOposta().trim()));
                }
            }
        }
    }

    private static int ordemConfianca(String confianca) {
        if (ConfiancaSugestao.ALTA.name().equalsIgnoreCase(confianca)) {
            return 0;
        }
        if (ConfiancaSugestao.MEDIA.name().equalsIgnoreCase(confianca)) {
            return 1;
        }
        return 2;
    }

    private PendenteItem toPendenteItem(LancamentoFinanceiroEntity l) {
        return new PendenteItem(
                l.getId(),
                l.getDataLancamento(),
                l.getDescricao(),
                l.getDescricaoNorm(),
                l.getValor(),
                l.getNumeroBanco(),
                l.getBancoNome());
    }

    static boolean pendenteContaEscritorio(LancamentoFinanceiroEntity l) {
        if (l.getContaContabil() == null || l.getContaContabil().getCodigo() == null) {
            return false;
        }
        if (!CONTA_ESCRITORIO.equalsIgnoreCase(l.getContaContabil().getCodigo().trim())) {
            return false;
        }
        return l.getClienteEntidade() == null || l.getProcesso() == null;
    }

    private HistoricoSlot toHistoricoSlot(LancamentoFinanceiroEntity l) {
        Long clienteId = l.getClienteEntidade() != null ? l.getClienteEntidade().getId() : null;
        Long processoId = l.getProcesso() != null ? l.getProcesso().getId() : null;
        return new HistoricoSlot(
                l.getId(),
                l.getDataLancamento(),
                l.getDescricaoNorm(),
                l.getValor(),
                l.getNumeroBanco(),
                clienteId,
                processoId);
    }

    private static String nomeCliente(ClienteEntity c) {
        if (StringUtils.hasText(c.getNomeReferencia())) {
            return Utf8MojibakeUtil.corrigir(c.getNomeReferencia());
        }
        if (c.getPessoa() != null && StringUtils.hasText(c.getPessoa().getNome())) {
            return Utf8MojibakeUtil.corrigir(c.getPessoa().getNome());
        }
        return null;
    }

    private static String numeroProcesso(ProcessoEntity p) {
        if (p.getNumeroInterno() != null) {
            return String.valueOf(p.getNumeroInterno());
        }
        if (StringUtils.hasText(p.getNumeroCnj())) {
            return Utf8MojibakeUtil.corrigir(p.getNumeroCnj());
        }
        return p.getId() != null ? String.valueOf(p.getId()) : "";
    }
}
