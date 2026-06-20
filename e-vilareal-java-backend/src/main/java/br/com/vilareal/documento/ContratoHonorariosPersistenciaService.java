package br.com.vilareal.documento;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosParcelaEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.pagamento.api.dto.PagamentoWriteRequest;
import br.com.vilareal.pagamento.application.PagamentoApplicationService;
import br.com.vilareal.pagamento.domain.PagamentoDominio;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;

@Service
public class ContratoHonorariosPersistenciaService {

    private final ContratoHonorariosRepository contratoRepository;
    private final ProcessoRepository processoRepository;
    private final PessoaRepository pessoaRepository;
    private final PagamentoApplicationService pagamentoApplicationService;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public ContratoHonorariosPersistenciaService(
            ContratoHonorariosRepository contratoRepository,
            ProcessoRepository processoRepository,
            PessoaRepository pessoaRepository,
            PagamentoApplicationService pagamentoApplicationService,
            UsuarioRepository usuarioRepository,
            Clock clock) {
        this.contratoRepository = contratoRepository;
        this.processoRepository = processoRepository;
        this.pessoaRepository = pessoaRepository;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    @Transactional
    public ContratoHonorariosEntity registrarContratoGerado(
            ContratoHonorariosRequest request, String clausula3Texto, ContratoHonorariosClausula3Dados dados) {
        PessoaEntity pessoa = pessoaRepository
                .findById(request.pessoaId())
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + request.pessoaId()));

        ContratoHonorariosEntity entity = new ContratoHonorariosEntity();
        entity.setPessoa(pessoa);
        entity.setDataContrato(request.data() != null ? request.data() : LocalDate.now(clock));
        entity.setFormaAssinatura(
                request.formaAssinatura() != null && !request.formaAssinatura().isBlank()
                        ? request.formaAssinatura().trim()
                        : "duas_vias");
        entity.setObjetoContrato(request.objetoContrato());
        entity.setClausula3Texto(clausula3Texto);
        entity.setCriadoEm(Instant.now(clock));
        entity.setCriadoPorUsuario(usuarioAtualOrNull());

        if (request.processoId() != null) {
            ProcessoEntity processo = processoRepository
                    .findById(request.processoId())
                    .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + request.processoId()));
            entity.setProcesso(processo);
        }

        if (dados != null) {
            entity.setTipoRemuneracao(normalizarTipo(dados.tipoRemuneracao()));
            entity.setPercentualProveito(dados.percentualProveito());
            entity.setValorFixo(dados.valorFixo());
            entity.setGerarRecebiveis(Boolean.TRUE.equals(dados.gerarRecebiveis()));
            entity.setValorTotalParcelas(dados.valorTotalParcelas());
            entity.setQuantidadeParcelas(dados.quantidadeParcelas());
            entity.setFormaPagamentoParcelas(dados.formaPagamento());
        } else {
            entity.setTipoRemuneracao(ContratoHonorariosClausula3TextoBuilder.TIPO_PERCENTUAL_PROVEITO);
            entity.setGerarRecebiveis(false);
        }

        entity = contratoRepository.save(entity);

        if (dados != null && Boolean.TRUE.equals(dados.gerarRecebiveis())) {
            criarRecebiveis(entity, dados);
        }

        return entity;
    }

    @Transactional(readOnly = true)
    public List<ContratoHonorariosResumoResponse> listar(Long processoId, Long pessoaId, LocalDate de, LocalDate ate) {
        return contratoRepository.listarComFiltros(processoId, pessoaId, de, ate).stream()
                .map(this::toResumo)
                .toList();
    }

    private void criarRecebiveis(ContratoHonorariosEntity contrato, ContratoHonorariosClausula3Dados dados) {
        if (contrato.getProcesso() == null) {
            throw new BusinessRuleException(
                    "Para gerar recebíveis, o contrato deve estar vinculado a um processo (conta corrente).");
        }
        List<ContratoHonorariosClausula3TextoBuilder.ParcelaCalculada> parcelas =
                ContratoHonorariosClausula3TextoBuilder.calcularParcelas(dados);
        if (parcelas.isEmpty()) {
            throw new BusinessRuleException("Informe valor total e quantidade de parcelas para gerar recebíveis.");
        }

        ProcessoEntity processo = contrato.getProcesso();
        Long clienteId = processo.getCliente() != null ? processo.getCliente().getId() : null;
        String formaPagamento =
                StringUtils.hasText(dados.formaPagamento()) ? dados.formaPagamento().trim() : "PIX";
        int total = parcelas.size();
        Long origemPagamentoId = null;
        List<ContratoHonorariosParcelaEntity> parcelasSalvas = new ArrayList<>(total);

        for (ContratoHonorariosClausula3TextoBuilder.ParcelaCalculada parcela : parcelas) {
            PagamentoWriteRequest req = new PagamentoWriteRequest();
            req.setTipo(PagamentoDominio.TIPO_RECEBER);
            req.setProcessoId(processo.getId());
            req.setClienteId(clienteId);
            req.setValor(parcela.valor());
            req.setDataVencimento(parcela.dataVencimento());
            req.setDataCadastro(LocalDate.now(clock));
            req.setCategoria("CLIENTE");
            req.setFormaPagamento(formaPagamento);
            req.setDescricao(montarDescricaoRecebivel(contrato.getId(), parcela.numero(), total));
            req.setOrigem("CONTRATO_HONORARIOS:" + contrato.getId());
            req.setRecorrente(total > 1);
            if (total > 1) {
                req.setRecorrenciaTipo("MENSAL");
                req.setRecorrenciaQuantidadeParcelas(total);
                req.setRecorrenciaParcelaAtual(parcela.numero());
                req.setRecorrenciaValorFixo(true);
                req.setRecorrenciaDescricaoPadrao("Honorários contratuais");
                if (origemPagamentoId != null) {
                    req.setRecorrenciaPagamentoOrigemId(origemPagamentoId);
                }
            }

            var pagResp = pagamentoApplicationService.criar(req);
            if (origemPagamentoId == null) {
                origemPagamentoId = pagResp.getId();
            }

            ContratoHonorariosParcelaEntity pe = new ContratoHonorariosParcelaEntity();
            pe.setContrato(contrato);
            pe.setNumeroParcela(parcela.numero());
            pe.setValor(parcela.valor());
            pe.setDataVencimento(parcela.dataVencimento());
            PagamentoEntity pagRef = new PagamentoEntity();
            pagRef.setId(pagResp.getId());
            pe.setPagamento(pagRef);
            parcelasSalvas.add(pe);
        }

        contrato.getParcelas().addAll(parcelasSalvas);
        contratoRepository.save(contrato);
    }

    private static String montarDescricaoRecebivel(Long contratoId, int parcela, int total) {
        if (total <= 1) {
            return "Honorários contratuais — contrato #" + contratoId;
        }
        return "Honorários contratuais — contrato #" + contratoId + " — parcela " + parcela + "/" + total;
    }

    private ContratoHonorariosResumoResponse toResumo(ContratoHonorariosEntity e) {
        ProcessoEntity processo = e.getProcesso();
        Long processoId = processo != null ? processo.getId() : null;
        String codigoCliente = null;
        Integer numeroInterno = null;
        if (processo != null) {
            numeroInterno = processo.getNumeroInterno();
            if (processo.getCliente() != null) {
                codigoCliente = processo.getCliente().getCodigoCliente();
            }
        }

        List<ContratoHonorariosParcelaResumoResponse> parcelasResumo =
                e.getParcelas() == null
                        ? List.of()
                        : e.getParcelas().stream()
                                .sorted(Comparator.comparing(
                                        ContratoHonorariosParcelaEntity::getNumeroParcela,
                                        Comparator.nullsLast(Integer::compareTo)))
                                .map(p -> new ContratoHonorariosParcelaResumoResponse(
                                        p.getId(),
                                        p.getNumeroParcela(),
                                        p.getValor(),
                                        p.getDataVencimento(),
                                        p.getPagamento() != null ? p.getPagamento().getId() : null))
                                .toList();

        return new ContratoHonorariosResumoResponse(
                e.getId(),
                processoId,
                e.getPessoa().getId(),
                e.getPessoa().getNome(),
                codigoCliente,
                numeroInterno,
                e.getDataContrato(),
                e.getObjetoContrato(),
                e.getTipoRemuneracao(),
                e.getPercentualProveito(),
                e.getValorFixo(),
                e.getValorTotalParcelas(),
                e.getQuantidadeParcelas(),
                e.getFormaPagamentoParcelas(),
                e.getGerarRecebiveis(),
                parcelasResumo.size(),
                e.getClausula3Texto(),
                parcelasResumo);
    }

    private static String normalizarTipo(String tipo) {
        if (!StringUtils.hasText(tipo)) {
            return ContratoHonorariosClausula3TextoBuilder.TIPO_PERCENTUAL_PROVEITO;
        }
        return tipo.trim().toUpperCase();
    }

    private UsuarioEntity usuarioAtualOrNull() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated()) {
            return null;
        }
        return usuarioRepository.findWithPerfilByLoginIgnoreCase(a.getName()).orElse(null);
    }
}
