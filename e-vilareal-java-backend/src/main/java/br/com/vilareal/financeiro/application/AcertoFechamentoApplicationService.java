package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.AcertoFechamentoResponse;
import br.com.vilareal.financeiro.api.dto.AcertoFechamentoWriteRequest;
import br.com.vilareal.financeiro.infrastructure.persistence.LancamentoFinanceiroSpecifications;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoFechamentoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoFechamentoGrupoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.LancamentoFinanceiroEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.AcertoFechamentoGrupoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.AcertoFechamentoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Acerto como evento de fechamento (Etapa 5b): RASCUNHO (define o corte) → conferir/ajustar →
 * registrar pagamento → compensar → FECHADO (arquiva o relatório PDF, grava o saldo final e
 * vincula os grupos de compensação cobertos).
 */
@Service
public class AcertoFechamentoApplicationService {

    private final AcertoFechamentoRepository fechamentoRepository;
    private final AcertoFechamentoGrupoRepository grupoRepository;
    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ClienteRepository clienteRepository;
    private final AcertoTrabalhoApplicationService acertoTrabalhoService;
    private final AcertoPdfService acertoPdfService;

    public AcertoFechamentoApplicationService(
            AcertoFechamentoRepository fechamentoRepository,
            AcertoFechamentoGrupoRepository grupoRepository,
            LancamentoFinanceiroRepository lancamentoRepository,
            ClienteRepository clienteRepository,
            AcertoTrabalhoApplicationService acertoTrabalhoService,
            AcertoPdfService acertoPdfService) {
        this.fechamentoRepository = fechamentoRepository;
        this.grupoRepository = grupoRepository;
        this.lancamentoRepository = lancamentoRepository;
        this.clienteRepository = clienteRepository;
        this.acertoTrabalhoService = acertoTrabalhoService;
        this.acertoPdfService = acertoPdfService;
    }

    @Transactional(readOnly = true)
    public List<AcertoFechamentoResponse> listar(Long clienteId, Integer numeroBanco) {
        acertoTrabalhoService.validarContaAcerto(numeroBanco);
        return fechamentoRepository
                .findByCliente_IdAndNumeroBancoOrderByIdDesc(clienteId, numeroBanco)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public AcertoFechamentoResponse iniciar(AcertoFechamentoWriteRequest request) {
        acertoTrabalhoService.validarContaAcerto(request.getNumeroBanco());
        ClienteEntity cliente = clienteRepository.findById(request.getClienteId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cliente não encontrado: " + request.getClienteId()));
        if (fechamentoRepository.existsByCliente_IdAndNumeroBancoAndStatus(
                cliente.getId(), request.getNumeroBanco(), AcertoFechamentoEntity.STATUS_RASCUNHO)) {
            throw new BusinessRuleException(
                    "Já existe um acerto em rascunho para este cliente nesta conta. Feche-o ou exclua-o antes.");
        }
        validarPeriodo(request);

        AcertoFechamentoEntity e = new AcertoFechamentoEntity();
        e.setCliente(cliente);
        e.setNumeroBanco(request.getNumeroBanco());
        e.setPeriodoInicio(request.getPeriodoInicio());
        e.setPeriodoFim(request.getPeriodoFim());
        e.setObservacoes(trimOrNull(request.getObservacoes()));
        e.setStatus(AcertoFechamentoEntity.STATUS_RASCUNHO);
        e.setCriadoPorUsuario(acertoTrabalhoService.usuarioAtual());
        return toResponse(fechamentoRepository.save(e));
    }

    @Transactional
    public AcertoFechamentoResponse atualizar(Long id, AcertoFechamentoWriteRequest request) {
        AcertoFechamentoEntity e = obter(id);
        exigirRascunho(e);
        validarPeriodo(request);
        e.setPeriodoInicio(request.getPeriodoInicio());
        e.setPeriodoFim(request.getPeriodoFim());
        e.setObservacoes(trimOrNull(request.getObservacoes()));
        return toResponse(fechamentoRepository.save(e));
    }

    @Transactional
    public void excluir(Long id) {
        AcertoFechamentoEntity e = obter(id);
        exigirRascunho(e);
        fechamentoRepository.delete(e);
    }

    /**
     * Fecha o acerto: grava o saldo pendente do cliente na conta como saldo final, vincula os
     * grupos de compensação ainda não cobertos por acertos anteriores e arquiva o relatório PDF
     * (visão do cliente). O saldo final vira o "último fechamento" da Ficha do Acerto.
     */
    @Transactional
    public AcertoFechamentoResponse fechar(Long id) {
        AcertoFechamentoEntity e = obter(id);
        exigirRascunho(e);
        acertoTrabalhoService.validarContaAcerto(e.getNumeroBanco());
        UsuarioEntity usuario = acertoTrabalhoService.usuarioAtual();
        Long clienteId = e.getCliente().getId();

        BigDecimal saldoFinal =
                lancamentoRepository.sumSaldoPendentePorClienteEConta(e.getNumeroBanco(), clienteId);
        e.setSaldoFinal(saldoFinal);
        e.setStatus(AcertoFechamentoEntity.STATUS_FECHADO);
        e.setDataFechamento(Instant.now());
        e.setFechadoPorUsuario(usuario);
        fechamentoRepository.save(e);

        Set<String> jaVinculados = new HashSet<>(
                grupoRepository.findGruposVinculadosPorClienteEConta(clienteId, e.getNumeroBanco()));
        for (String grupo : lancamentoRepository.findGruposCompensacaoPorClienteEConta(
                e.getNumeroBanco(), clienteId)) {
            if (jaVinculados.contains(grupo)) {
                continue;
            }
            AcertoFechamentoGrupoEntity g = new AcertoFechamentoGrupoEntity();
            g.setAcertoFechamento(e);
            g.setGrupoCompensacao(grupo);
            grupoRepository.save(g);
        }

        List<LancamentoFinanceiroEntity> visaoCliente = lancamentosVisaoCliente(e.getNumeroBanco(), clienteId);
        try {
            String rel = acertoPdfService.gerarESalvar(
                    e,
                    AcertoTrabalhoApplicationService.nomeCliente(e.getCliente()),
                    e.getCliente().getCodigoCliente(),
                    visaoCliente,
                    usuario.getNome());
            e.setArquivoPdfPath(rel);
        } catch (IOException ex) {
            throw new BusinessRuleException("Falha ao gerar o PDF do acerto: " + ex.getMessage());
        }
        return toResponse(fechamentoRepository.save(e));
    }

    @Transactional(readOnly = true)
    public Path resolverPdf(Long id) {
        AcertoFechamentoEntity e = obter(id);
        Path p = acertoPdfService.resolverArquivo(e.getArquivoPdfPath());
        if (p == null) {
            throw new ResourceNotFoundException("PDF do acerto não disponível.");
        }
        return p;
    }

    private List<LancamentoFinanceiroEntity> lancamentosVisaoCliente(Integer numeroBanco, Long clienteId) {
        Specification<LancamentoFinanceiroEntity> spec = LancamentoFinanceiroSpecifications
                .comFiltros(clienteId, null, null, null, null)
                .and(LancamentoFinanceiroSpecifications.comNumeroBanco(numeroBanco))
                .and(LancamentoFinanceiroSpecifications.comVisivelCliente(true));
        return lancamentoRepository.findAll(
                spec, Sort.by(Sort.Direction.ASC, "dataLancamento", "id"));
    }

    private AcertoFechamentoEntity obter(Long id) {
        return fechamentoRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Acerto não encontrado: " + id));
    }

    private static void exigirRascunho(AcertoFechamentoEntity e) {
        if (!AcertoFechamentoEntity.STATUS_RASCUNHO.equals(e.getStatus())) {
            throw new BusinessRuleException("Acerto " + e.getId() + " não está em rascunho.");
        }
    }

    private static void validarPeriodo(AcertoFechamentoWriteRequest request) {
        if (request.getPeriodoInicio() != null
                && request.getPeriodoFim() != null
                && request.getPeriodoFim().isBefore(request.getPeriodoInicio())) {
            throw new BusinessRuleException("Período final anterior ao inicial.");
        }
    }

    private static String trimOrNull(String s) {
        return s != null && !s.isBlank() ? s.trim() : null;
    }

    private AcertoFechamentoResponse toResponse(AcertoFechamentoEntity e) {
        AcertoFechamentoResponse r = new AcertoFechamentoResponse();
        r.setId(e.getId());
        r.setClienteId(e.getCliente().getId());
        r.setCodigoCliente(e.getCliente().getCodigoCliente());
        r.setClienteNome(AcertoTrabalhoApplicationService.nomeCliente(e.getCliente()));
        r.setNumeroBanco(e.getNumeroBanco());
        r.setPeriodoInicio(e.getPeriodoInicio());
        r.setPeriodoFim(e.getPeriodoFim());
        r.setDataFechamento(e.getDataFechamento());
        r.setSaldoFinal(e.getSaldoFinal());
        r.setStatus(e.getStatus());
        r.setObservacoes(Utf8MojibakeUtil.corrigir(e.getObservacoes()));
        r.setTemPdf(e.getArquivoPdfPath() != null && !e.getArquivoPdfPath().isBlank());
        r.setQtdGrupos(grupoRepository.countByAcertoFechamento_Id(e.getId()));
        if (e.getCriadoPorUsuario() != null) {
            r.setCriadoPorNome(Utf8MojibakeUtil.corrigir(e.getCriadoPorUsuario().getNome()));
        }
        if (e.getFechadoPorUsuario() != null) {
            r.setFechadoPorNome(Utf8MojibakeUtil.corrigir(e.getFechadoPorUsuario().getNome()));
        }
        r.setCreatedAt(e.getCreatedAt());
        return r;
    }
}
