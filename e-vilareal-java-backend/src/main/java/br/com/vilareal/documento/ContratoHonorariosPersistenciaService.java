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
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRepository;
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
    private final PagamentoRepository pagamentoRepository;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public ContratoHonorariosPersistenciaService(
            ContratoHonorariosRepository contratoRepository,
            ProcessoRepository processoRepository,
            PessoaRepository pessoaRepository,
            PagamentoApplicationService pagamentoApplicationService,
            PagamentoRepository pagamentoRepository,
            UsuarioRepository usuarioRepository,
            Clock clock) {
        this.contratoRepository = contratoRepository;
        this.processoRepository = processoRepository;
        this.pessoaRepository = pessoaRepository;
        this.pagamentoApplicationService = pagamentoApplicationService;
        this.pagamentoRepository = pagamentoRepository;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    /**
     * Salva ou atualiza a contratação vigente do processo (upsert por {@code processoId}).
     * Geração de PDF não deve chamar este método — apenas esta API de contratação.
     */
    @Transactional
    public ContratoHonorariosEntity salvarContratoProcesso(
            Long processoId, ContratoHonorariosRequest request, String clausula3Texto, ContratoHonorariosClausula3Dados dados) {
        if (processoId == null) {
            throw new BusinessRuleException("Informe o processo para salvar a contratação.");
        }
        if (request == null || request.pessoaId() == null) {
            throw new IllegalArgumentException("pessoaId é obrigatório");
        }
        if (dados == null) {
            throw new BusinessRuleException("Configure a Cláusula 3ª (remuneração) antes de salvar.");
        }

        ProcessoEntity processo = processoRepository
                .findById(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));

        PessoaEntity pessoa = pessoaRepository
                .findById(request.pessoaId())
                .orElseThrow(() -> new ResourceNotFoundException("Pessoa não encontrada: " + request.pessoaId()));

        ContratoHonorariosEntity entity =
                contratoRepository.findByProcessoIdWithDetalhes(processoId).orElseGet(ContratoHonorariosEntity::new);

        Instant agora = Instant.now(clock);
        if (entity.getId() == null) {
            entity.setCriadoEm(agora);
            entity.setCriadoPorUsuario(usuarioAtualOrNull());
        } else {
            entity.setAtualizadoEm(agora);
        }

        entity.setProcesso(processo);
        entity.setPessoa(pessoa);
        entity.setDataContrato(request.data() != null ? request.data() : LocalDate.now(clock));
        entity.setFormaAssinatura(
                request.formaAssinatura() != null && !request.formaAssinatura().isBlank()
                        ? request.formaAssinatura().trim()
                        : "duas_vias");
        entity.setObjetoContrato(request.objetoContrato());
        entity.setClausula3Texto(clausula3Texto);
        entity.setTipoRemuneracao(normalizarTipo(dados.tipoRemuneracao()));
        entity.setPercentualProveito(dados.percentualProveito());
        entity.setValorFixo(dados.valorFixo());
        entity.setGerarRecebiveis(Boolean.TRUE.equals(dados.gerarRecebiveis()));
        entity.setValorTotalParcelas(dados.valorTotalParcelas());
        entity.setQuantidadeParcelas(dados.quantidadeParcelas());
        entity.setFormaPagamentoParcelas(dados.formaPagamento());

        entity = contratoRepository.save(entity);
        sincronizarRecebiveis(entity, dados);
        return entity;
    }

    @Transactional(readOnly = true)
    public ContratoHonorariosProcessoResponse buscarPorProcesso(Long processoId) {
        return contratoRepository
                .findByProcessoIdWithDetalhes(processoId)
                .map(this::toProcessoResponse)
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public List<ContratoHonorariosResumoResponse> listar(Long processoId, Long pessoaId, LocalDate de, LocalDate ate) {
        return contratoRepository.listarComFiltros(processoId, pessoaId, de, ate).stream()
                .map(this::toResumo)
                .toList();
    }

    private void sincronizarRecebiveis(ContratoHonorariosEntity contrato, ContratoHonorariosClausula3Dados dados) {
        removerRecebiveisPendentes(contrato);
        if (Boolean.TRUE.equals(dados.gerarRecebiveis())) {
            criarRecebiveis(contrato, dados);
        }
    }

    private void removerRecebiveisPendentes(ContratoHonorariosEntity contrato) {
        if (contrato.getParcelas() == null || contrato.getParcelas().isEmpty()) {
            return;
        }
        for (ContratoHonorariosParcelaEntity parcela : new ArrayList<>(contrato.getParcelas())) {
            if (parcela.getPagamento() == null || parcela.getPagamento().getId() == null) {
                continue;
            }
            pagamentoRepository
                    .findById(parcela.getPagamento().getId())
                    .filter(this::podeCancelarRecebivel)
                    .ifPresent(pag -> pagamentoApplicationService.cancelar(pag.getId(), null));
        }
        contrato.getParcelas().clear();
        contratoRepository.save(contrato);
    }

    private boolean podeCancelarRecebivel(PagamentoEntity pag) {
        if (!PagamentoDominio.isTipoReceber(pag.getTipo())) {
            return false;
        }
        return !PagamentoDominio.ST_RECEBIDO.equals(pag.getStatus())
                && !PagamentoDominio.ST_CONCILIADO.equals(pag.getStatus());
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

    private ContratoHonorariosProcessoResponse toProcessoResponse(ContratoHonorariosEntity e) {
        return new ContratoHonorariosProcessoResponse(
                toResumo(e),
                montarClausula3Dados(e),
                e.getFormaAssinatura(),
                e.getCriadoEm(),
                e.getAtualizadoEm());
    }

    static ContratoHonorariosClausula3Dados montarClausula3Dados(ContratoHonorariosEntity e) {
        boolean temParcelamento = e.getValorTotalParcelas() != null
                && e.getQuantidadeParcelas() != null
                && e.getQuantidadeParcelas() > 0;
        LocalDate primeiroVencimento = null;
        if (e.getParcelas() != null && !e.getParcelas().isEmpty()) {
            primeiroVencimento = e.getParcelas().stream()
                    .min(Comparator.comparing(
                            ContratoHonorariosParcelaEntity::getNumeroParcela, Comparator.nullsLast(Integer::compareTo)))
                    .map(ContratoHonorariosParcelaEntity::getDataVencimento)
                    .orElse(null);
        }
        String intervalo = temParcelamento
                        && e.getQuantidadeParcelas() != null
                        && e.getQuantidadeParcelas() == 1
                ? "UNICA"
                : "MENSAL";
        return new ContratoHonorariosClausula3Dados(
                e.getTipoRemuneracao(),
                e.getPercentualProveito(),
                e.getValorFixo(),
                temParcelamento,
                e.getGerarRecebiveis(),
                e.getQuantidadeParcelas(),
                e.getValorTotalParcelas(),
                primeiroVencimento,
                intervalo,
                e.getFormaPagamentoParcelas());
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
