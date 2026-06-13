package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaRequest;
import br.com.vilareal.financeiro.api.dto.AplicarRecorrenciaResponse;
import br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteItemRequest;
import br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteRequest;
import br.com.vilareal.financeiro.api.dto.AplicarSugestaoLoteResult;
import br.com.vilareal.financeiro.api.dto.RecorrenciaDetectadaResponse;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.financeiro.domain.TipoMatch;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.ContaContabilEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.RegraClassificacaoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.ContaContabilRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository.PadraoRecorrenciaRow;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.FinanceiroAnaliseRecorrenciaRepository.VinculoDominanteRow;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.RegraClassificacaoRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class FinanceiroAnaliseService {

    private static final int CHUNK_APLICAR = 1000;

    private final FinanceiroAnaliseRecorrenciaRepository recorrenciaRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaContabilRepository contaContabilRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final RegraClassificacaoRepository regraRepository;
    private final FinanceiroSugestaoService sugestaoService;

    public FinanceiroAnaliseService(
            FinanceiroAnaliseRecorrenciaRepository recorrenciaRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaContabilRepository contaContabilRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            RegraClassificacaoRepository regraRepository,
            FinanceiroSugestaoService sugestaoService) {
        this.recorrenciaRepository = recorrenciaRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.contaContabilRepository = contaContabilRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.regraRepository = regraRepository;
        this.sugestaoService = sugestaoService;
    }

    @Transactional(readOnly = true)
    public Page<RecorrenciaDetectadaResponse> listarRecorrencias(
            ConfiancaSugestao confiancaMinima,
            Integer numeroBanco,
            boolean apenasComPendentes,
            Long contaContabilId,
            Pageable pageable) {
        ConfiancaSugestao minimo = confiancaMinima != null ? confiancaMinima : ConfiancaSugestao.MEDIA;
        List<PadraoRecorrenciaRow> padroes =
                recorrenciaRepository.listarPadroesAgregados(numeroBanco, contaContabilId);

        List<RecorrenciaDetectadaResponse> filtrados = new ArrayList<>();
        for (PadraoRecorrenciaRow p : padroes) {
            if (apenasComPendentes && p.qtdPendentes <= 0) {
                continue;
            }
            RecorrenciaDetectadaResponse item = mapearPadrao(p);
            if (!item.getConfianca().atendeMinimo(minimo)) {
                continue;
            }
            filtrados.add(item);
        }

        filtrados.sort(Comparator.comparingLong(RecorrenciaDetectadaResponse::getQtdPendentes).reversed());

        int start = (int) pageable.getOffset();
        int end = Math.min(start + pageable.getPageSize(), filtrados.size());
        List<RecorrenciaDetectadaResponse> pagina =
                start >= filtrados.size() ? List.of() : filtrados.subList(start, end);
        return new PageImpl<>(pagina, pageable, filtrados.size());
    }

    @Transactional
    public AplicarRecorrenciaResponse aplicarRecorrencia(AplicarRecorrenciaRequest req) {
        validarAplicar(req);
        List<LancamentoFinanceiroEntity> pendentes =
                lancamentoRepository.findPendentesPorPadrao(req.getDescricaoNorm().trim(), req.getNumeroBanco());

        AplicarRecorrenciaResponse resp = new AplicarRecorrenciaResponse();
        resp.setAplicados(pendentes.size());

        if (req.isDryRun() || pendentes.isEmpty()) {
            if (req.isCriarRegra() && !req.isDryRun()) {
                resp.setJaExistiaRegra(true);
            }
            return resp;
        }

        for (int i = 0; i < pendentes.size(); i += CHUNK_APLICAR) {
            List<LancamentoFinanceiroEntity> chunk =
                    pendentes.subList(i, Math.min(i + CHUNK_APLICAR, pendentes.size()));
            AplicarSugestaoLoteRequest lote = new AplicarSugestaoLoteRequest();
            List<AplicarSugestaoLoteItemRequest> itens = new ArrayList<>(chunk.size());
            for (LancamentoFinanceiroEntity l : chunk) {
                AplicarSugestaoLoteItemRequest item = new AplicarSugestaoLoteItemRequest();
                item.setLancamentoId(l.getId());
                item.setContaContabilId(req.getContaContabilId());
                item.setClienteId(req.getClienteId());
                item.setProcessoId(req.getProcessoId());
                itens.add(item);
            }
            lote.setAplicacoes(itens);
            AplicarSugestaoLoteResult parcial = sugestaoService.aplicarSugestoesLote(lote);
            resp.getErros().addAll(parcial.getErros());
        }

        if (req.isCriarRegra()) {
            Optional<RegraClassificacaoEntity> existente = buscarRegraIdentica(req);
            if (existente.isPresent()) {
                resp.setJaExistiaRegra(true);
                resp.setRegraCriadaId(existente.get().getId());
            } else {
                RegraClassificacaoEntity nova = criarRegraDePadrao(req);
                resp.setRegraCriadaId(regraRepository.save(nova).getId());
                resp.setJaExistiaRegra(false);
            }
        }

        return resp;
    }

    private RecorrenciaDetectadaResponse mapearPadrao(PadraoRecorrenciaRow p) {
        RecorrenciaDetectadaResponse r = new RecorrenciaDetectadaResponse();
        r.setDescricaoNorm(Utf8MojibakeUtil.corrigir(p.descricaoNorm));
        r.setDescricaoExemplo(Utf8MojibakeUtil.corrigir(p.descricaoExemplo));
        r.setNumeroBanco(p.numeroBanco);
        r.setBancoNome(Utf8MojibakeUtil.corrigir(p.bancoNome));
        r.setValorTipico(
                p.valorMedio != null
                        ? p.valorMedio.setScale(2, RoundingMode.HALF_UP)
                        : BigDecimal.ZERO);
        r.setContaContabilId(p.contaContabilId);
        r.setContaCodigo(p.contaCodigo);
        r.setContaNome(Utf8MojibakeUtil.corrigir(p.contaNome));
        r.setOcorrenciasHistorico(p.ocorrenciasHistorico);
        r.setMesesCobertos(p.mesesCobertos);
        r.setQtdPendentes(p.qtdPendentes);

        double consistenciaConta =
                p.ocorrenciasHistorico > 0 ? (double) p.cntContaDominante / p.ocorrenciasHistorico : 0.0;
        r.setConsistenciaConta(consistenciaConta);

        Double consistenciaVinculo = null;
        if ("A".equalsIgnoreCase(p.contaCodigo) && p.contaContabilId != null && p.numeroBanco != null) {
            VinculoDominanteRow vinculo = recorrenciaRepository.buscarVinculoDominanteContaA(
                    p.descricaoNorm, p.numeroBanco, p.contaContabilId);
            if (vinculo != null && p.cntContaDominante > 0) {
                consistenciaVinculo = (double) vinculo.cnt / p.cntContaDominante;
                r.setConsistenciaVinculo(consistenciaVinculo);
                if (vinculo.clienteId != null) {
                    r.setClienteId(vinculo.clienteId);
                    clienteRepository.findById(vinculo.clienteId).ifPresent(c -> r.setClienteNome(nomeCliente(c)));
                }
                if (vinculo.processoId != null) {
                    r.setProcessoId(vinculo.processoId);
                    processoRepository.findById(vinculo.processoId).ifPresent(pr -> r.setProcessoNumero(numeroProcesso(pr)));
                }
            }
        }

        r.setConfianca(calcularConfianca(consistenciaConta, p.ocorrenciasHistorico, p.contaCodigo, consistenciaVinculo));
        return r;
    }

    private static ConfiancaSugestao calcularConfianca(
            double consistenciaConta, long ocorrencias, String contaCodigo, Double consistenciaVinculo) {
        if (consistenciaConta >= 0.95 && ocorrencias >= 5) {
            if ("A".equalsIgnoreCase(contaCodigo)
                    && (consistenciaVinculo == null || consistenciaVinculo < 0.90)) {
                return ConfiancaSugestao.MEDIA;
            }
            return ConfiancaSugestao.ALTA;
        }
        if (consistenciaConta >= 0.80 && ocorrencias >= 3) {
            return ConfiancaSugestao.MEDIA;
        }
        return ConfiancaSugestao.BAIXA;
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
        return null;
    }

    private Optional<RegraClassificacaoEntity> buscarRegraIdentica(AplicarRecorrenciaRequest req) {
        return regraRepository.findByAtivoTrueOrderByPrioridadeAscIdAsc().stream()
                .filter(r -> r.getTipoMatch() == TipoMatch.CONTAINS)
                .filter(r -> Objects.equals(r.getNumeroBanco(), req.getNumeroBanco()))
                .filter(r -> r.getContaContabil().getId().equals(req.getContaContabilId()))
                .filter(r -> req.getDescricaoNorm().equalsIgnoreCase(r.getPadraoDescricao()))
                .findFirst();
    }

    private RegraClassificacaoEntity criarRegraDePadrao(AplicarRecorrenciaRequest req) {
        ContaContabilEntity conta = contaContabilRepository
                .findById(req.getContaContabilId())
                .orElseThrow(() -> new BusinessRuleException("Conta contábil não encontrada."));
        RegraClassificacaoEntity e = new RegraClassificacaoEntity();
        e.setPadraoDescricao(req.getDescricaoNorm().trim());
        e.setTipoMatch(TipoMatch.CONTAINS);
        e.setContaContabil(conta);
        e.setLetraDestino(conta.getCodigo());
        e.setNumeroBanco(req.getNumeroBanco());
        e.setPrioridade(20);
        e.setConfianca(new BigDecimal("0.9000"));
        e.setAtivo(true);
        if (req.getClienteId() != null) {
            clienteRepository.findById(req.getClienteId()).ifPresent(e::setClienteEntidade);
        }
        if (req.getProcessoId() != null) {
            processoRepository.findById(req.getProcessoId()).ifPresent(e::setProcesso);
        }
        return e;
    }

    private static void validarAplicar(AplicarRecorrenciaRequest req) {
        if (req == null || !StringUtils.hasText(req.getDescricaoNorm())) {
            throw new BusinessRuleException("descricaoNorm é obrigatório.");
        }
        if (req.getNumeroBanco() == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        if (req.getContaContabilId() == null) {
            throw new BusinessRuleException("contaContabilId é obrigatório.");
        }
    }
}
