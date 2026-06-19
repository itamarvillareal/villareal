package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.InboxSemelhantesPaginaResponse;
import br.com.vilareal.financeiro.api.dto.SemelhanteEscritorioGrupoResponse;
import br.com.vilareal.financeiro.api.dto.SemelhanteEscritorioItemResponse;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher.HistoricoSlot;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher.MatchResult;
import br.com.vilareal.financeiro.domain.SemelhanteEscritorioMatcher.PendenteItem;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
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
import java.util.LinkedHashMap;
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

    public FinanceiroSemelhantesEscritorioService(
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ProcessoApplicationService processoApplicationService) {
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.processoApplicationService = processoApplicationService;
    }

    @Transactional(readOnly = true)
    public InboxSemelhantesPaginaResponse listarInbox(Integer numeroBanco, Integer ano, Integer mes, Pageable pageable) {
        ContaContabilEntity contaA = contaContabilRepository
                .findFirstByCodigoIgnoreCase(CONTA_ESCRITORIO)
                .orElse(null);
        Long contaAId = contaA != null ? contaA.getId() : null;
        String contaACodigo = contaA != null ? contaA.getCodigo() : CONTA_ESCRITORIO;

        List<PendenteItem> pendentes = lancamentoRepository
                .findPendentesSemelhantesEscritorio(numeroBanco, ano, mes)
                .stream()
                .map(this::toPendenteItem)
                .toList();

        List<HistoricoSlot> historico = lancamentoRepository
                .findHistoricoVinculadoContaA(numeroBanco)
                .stream()
                .map(this::toHistoricoSlot)
                .toList();

        List<MatchResult> matches = SemelhanteEscritorioMatcher.parear(pendentes, historico);
        List<SemelhanteEscritorioGrupoResponse> grupos = agruparMatches(matches, contaAId, contaACodigo);
        enriquecerPartesProcesso(grupos);

        grupos.sort(Comparator.comparingInt(SemelhanteEscritorioGrupoResponse::getQtdPendentes)
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
        return listarInbox(numeroBanco, ano, mes, Pageable.ofSize(1)).getTotalItensAcionaveis();
    }

    private List<SemelhanteEscritorioGrupoResponse> agruparMatches(
            List<MatchResult> matches, Long contaAId, String contaACodigo) {
        Map<String, SemelhanteEscritorioGrupoResponse> map = new LinkedHashMap<>();
        for (MatchResult m : matches) {
            PendenteItem p = m.pendente();
            String chave = SemelhanteEscritorioMatcher.chave(p.descricaoNorm(), p.valor(), p.numeroBanco());
            SemelhanteEscritorioGrupoResponse grupo =
                    map.computeIfAbsent(chave, k -> novoGrupo(p, m.totalHistoricoChave()));
            grupo.getItens().add(toItemResponse(m, contaAId, contaACodigo));
            grupo.setQtdPendentes(grupo.getItens().size());
        }
        return new ArrayList<>(map.values());
    }

    private static SemelhanteEscritorioGrupoResponse novoGrupo(PendenteItem p, int qtdHistorico) {
        SemelhanteEscritorioGrupoResponse g = new SemelhanteEscritorioGrupoResponse();
        g.setDescricaoNorm(p.descricaoNorm());
        g.setDescricaoExemplo(Utf8MojibakeUtil.corrigir(p.descricao()));
        g.setNumeroBanco(p.numeroBanco());
        g.setBancoNome(Utf8MojibakeUtil.corrigir(p.bancoNome()));
        g.setValor(p.valor() != null ? p.valor().setScale(2, RoundingMode.HALF_UP) : BigDecimal.ZERO);
        g.setQtdHistorico(qtdHistorico);
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
        if (StringUtils.hasText(p.getNumeroCnj())) {
            return Utf8MojibakeUtil.corrigir(p.getNumeroCnj());
        }
        if (p.getNumeroInterno() != null) {
            return String.valueOf(p.getNumeroInterno());
        }
        return p.getId() != null ? String.valueOf(p.getId()) : "";
    }
}
