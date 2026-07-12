package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.AcertoClienteConfigResponse;
import br.com.vilareal.financeiro.api.dto.AcertoClienteConfigWriteRequest;
import br.com.vilareal.financeiro.api.dto.AcertoConferenciaResponse;
import br.com.vilareal.financeiro.api.dto.AcertoConferirProcessoRequest;
import br.com.vilareal.financeiro.api.dto.AcertoConferirRequest;
import br.com.vilareal.financeiro.api.dto.AcertoResumoProcessoResponse;
import br.com.vilareal.financeiro.api.dto.AcertoResumoProcessosResponse;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoClienteConfigEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.entity.AcertoFechamentoEntity;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.AcertoClienteConfigRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.AcertoFechamentoRepository;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.mensalista.infrastructure.persistence.repository.MensalistaRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.sql.Timestamp;
import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

/**
 * Mesa de trabalho do acerto (Etapas 5/5b da CONTA ZERO): visão agrupada por processo,
 * marcação de conferência persistente (o "OK" da planilha antiga) e Ficha do Acerto por cliente.
 */
@Service
public class AcertoTrabalhoApplicationService {

    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaBancariaApplicationService contaBancariaApplicationService;
    private final FinanceiroExtratoAcessoService extratoAcessoService;
    private final AcertoClienteConfigRepository configRepository;
    private final AcertoFechamentoRepository fechamentoRepository;
    private final MensalistaRepository mensalistaRepository;
    private final ClienteRepository clienteRepository;
    private final UsuarioRepository usuarioRepository;

    public AcertoTrabalhoApplicationService(
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaBancariaApplicationService contaBancariaApplicationService,
            FinanceiroExtratoAcessoService extratoAcessoService,
            AcertoClienteConfigRepository configRepository,
            AcertoFechamentoRepository fechamentoRepository,
            MensalistaRepository mensalistaRepository,
            ClienteRepository clienteRepository,
            UsuarioRepository usuarioRepository) {
        this.lancamentoRepository = lancamentoRepository;
        this.contaBancariaApplicationService = contaBancariaApplicationService;
        this.extratoAcessoService = extratoAcessoService;
        this.configRepository = configRepository;
        this.fechamentoRepository = fechamentoRepository;
        this.mensalistaRepository = mensalistaRepository;
        this.clienteRepository = clienteRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public AcertoResumoProcessosResponse resumoProcessos(
            Integer numeroBanco,
            Long clienteId,
            Long pessoaRefId,
            LocalDate dataInicio,
            LocalDate dataFim,
            String busca,
            Boolean apenasPendentes,
            Boolean apenasNaoConferidos) {
        validarContaAcerto(numeroBanco);
        if (clienteId == null && pessoaRefId == null) {
            throw new BusinessRuleException("Informe clienteId ou pessoaRefId.");
        }

        String buscaLike = null;
        Integer buscaNumero = null;
        if (busca != null && !busca.isBlank()) {
            String term = busca.trim();
            buscaLike = "%" + term.toUpperCase(Locale.ROOT) + "%";
            if (term.matches("\\d{1,9}")) {
                buscaNumero = Integer.parseInt(term);
            }
        }

        List<Object[]> rows = lancamentoRepository.resumoAcertoPorProcesso(
                numeroBanco, clienteId, pessoaRefId, dataInicio, dataFim, buscaLike, buscaNumero);

        AcertoResumoProcessosResponse response = new AcertoResumoProcessosResponse();
        for (Object[] row : rows) {
            AcertoResumoProcessoResponse p = new AcertoResumoProcessoResponse();
            p.setProcessoId(row[0] != null ? ((Number) row[0]).longValue() : null);
            p.setNumeroInterno(row[1] != null ? ((Number) row[1]).intValue() : null);
            p.setPartes(row[2] != null ? Utf8MojibakeUtil.corrigir(row[2].toString()) : null);
            p.setQtdLancamentos(toLong(row[3]));
            p.setSomaCreditos(toDecimal(row[4]));
            p.setSomaDebitos(toDecimal(row[5]));
            p.setSaldo(toDecimal(row[6]));
            p.setPendentes(toLong(row[7]));
            p.setNaoConferidos(toLong(row[8]));
            p.setUltimaConferencia(toInstant(row[9]));
            p.setPrimeiraData(toLocalDate(row[10]));
            p.setUltimaData(toLocalDate(row[11]));

            response.setTotalProcessos(response.getTotalProcessos() + 1);
            response.setTotalLancamentos(response.getTotalLancamentos() + p.getQtdLancamentos());
            response.setLancamentosNaoConferidos(
                    response.getLancamentosNaoConferidos() + p.getNaoConferidos());
            if (p.getNaoConferidos() == 0) {
                response.setProcessosConferidos(response.getProcessosConferidos() + 1);
            }

            if (Boolean.TRUE.equals(apenasPendentes) && p.getPendentes() == 0) {
                continue;
            }
            if (Boolean.TRUE.equals(apenasNaoConferidos) && p.getNaoConferidos() == 0) {
                continue;
            }
            response.getProcessos().add(p);
        }
        return response;
    }

    @Transactional
    public AcertoConferenciaResponse conferirLancamentos(AcertoConferirRequest request) {
        boolean conferir = Boolean.TRUE.equals(request.getConferido());
        UsuarioEntity usuario = conferir ? usuarioAtual() : null;
        Instant quando = conferir ? Instant.now() : null;
        int atualizados = lancamentoRepository.atualizarConferenciaPorIds(
                request.getLancamentoIds(), quando, usuario != null ? usuario.getId() : null);
        return conferenciaResponse(atualizados, quando, usuario);
    }

    @Transactional
    public AcertoConferenciaResponse conferirProcesso(AcertoConferirProcessoRequest request) {
        validarContaAcerto(request.getNumeroBanco());
        if (request.getClienteId() == null && request.getPessoaRefId() == null) {
            throw new BusinessRuleException("Informe clienteId ou pessoaRefId.");
        }
        boolean conferir = Boolean.TRUE.equals(request.getConferido());
        UsuarioEntity usuario = conferir ? usuarioAtual() : null;
        Instant quando = conferir ? Instant.now() : null;
        int atualizados = lancamentoRepository.atualizarConferenciaPorProcesso(
                request.getNumeroBanco(),
                request.getClienteId(),
                request.getPessoaRefId(),
                request.getProcessoId(),
                quando,
                usuario != null ? usuario.getId() : null);
        return conferenciaResponse(atualizados, quando, usuario);
    }

    @Transactional(readOnly = true)
    public AcertoClienteConfigResponse obterConfig(Long clienteId, Integer numeroBanco) {
        ClienteEntity cliente = clienteRepository.findById(clienteId)
                .orElseThrow(() -> new ResourceNotFoundException("Cliente não encontrado: " + clienteId));

        AcertoClienteConfigResponse r = new AcertoClienteConfigResponse();
        r.setClienteId(cliente.getId());
        r.setCodigoCliente(cliente.getCodigoCliente());
        r.setClienteNome(nomeCliente(cliente));

        configRepository.findByCliente_Id(clienteId).ifPresent(cfg -> {
            r.setPercentualRepasse(cfg.getPercentualRepasse());
            r.setObservacoes(Utf8MojibakeUtil.corrigir(cfg.getObservacoes()));
        });

        mensalistaRepository.findByCliente_IdWithDetalhes(clienteId).ifPresent(m -> {
            r.setMensalidadeValor(m.getValor());
            r.setMensalidadeDiaVencimento(m.getDiaVencimento());
            r.setMensalistaAtivo(m.getAtivo());
        });

        if (numeroBanco != null) {
            fechamentoRepository
                    .findFirstByCliente_IdAndNumeroBancoAndStatusOrderByIdDesc(
                            clienteId, numeroBanco, AcertoFechamentoEntity.STATUS_FECHADO)
                    .ifPresent(f -> {
                        r.setUltimoFechamentoId(f.getId());
                        r.setUltimoFechamentoData(f.getDataFechamento());
                        r.setUltimoFechamentoSaldo(f.getSaldoFinal());
                        r.setUltimoFechamentoPeriodoFim(f.getPeriodoFim());
                    });
        }
        return r;
    }

    @Transactional
    public AcertoClienteConfigResponse salvarConfig(AcertoClienteConfigWriteRequest request) {
        ClienteEntity cliente = clienteRepository.findById(request.getClienteId())
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Cliente não encontrado: " + request.getClienteId()));
        if (request.getPercentualRepasse() != null
                && (request.getPercentualRepasse().compareTo(BigDecimal.ZERO) < 0
                        || request.getPercentualRepasse().compareTo(new BigDecimal("100")) > 0)) {
            throw new BusinessRuleException("Percentual de repasse deve estar entre 0 e 100.");
        }
        AcertoClienteConfigEntity cfg = configRepository.findByCliente_Id(cliente.getId())
                .orElseGet(() -> {
                    AcertoClienteConfigEntity nova = new AcertoClienteConfigEntity();
                    nova.setCliente(cliente);
                    return nova;
                });
        cfg.setPercentualRepasse(request.getPercentualRepasse());
        cfg.setObservacoes(
                request.getObservacoes() != null && !request.getObservacoes().isBlank()
                        ? request.getObservacoes().trim()
                        : null);
        configRepository.save(cfg);
        return obterConfig(cliente.getId(), null);
    }

    void validarContaAcerto(Integer numeroBanco) {
        if (numeroBanco == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        if (!contaBancariaApplicationService.exigeSomaZero(numeroBanco)) {
            throw new BusinessRuleException(
                    "Conta " + numeroBanco + " não é conta de acerto (exige_soma_zero).");
        }
        extratoAcessoService.assertAcessoExtratoBanco(numeroBanco);
    }

    private AcertoConferenciaResponse conferenciaResponse(
            int atualizados, Instant quando, UsuarioEntity usuario) {
        AcertoConferenciaResponse r = new AcertoConferenciaResponse();
        r.setAtualizados(atualizados);
        r.setConferidoEm(quando);
        if (usuario != null) {
            r.setConferidoPorNome(Utf8MojibakeUtil.corrigir(usuario.getNome()));
        }
        return r;
    }

    UsuarioEntity usuarioAtual() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated()) {
            throw new BusinessRuleException("Usuário não autenticado.");
        }
        return usuarioRepository
                .findWithPerfilByLoginIgnoreCase(a.getName())
                .orElseThrow(() -> new BusinessRuleException("Usuário não encontrado."));
    }

    static String nomeCliente(ClienteEntity c) {
        if (c.getPessoa() != null && c.getPessoa().getNome() != null) {
            return Utf8MojibakeUtil.corrigir(c.getPessoa().getNome());
        }
        return Utf8MojibakeUtil.corrigir(c.getNomeReferencia());
    }

    private static long toLong(Object o) {
        return o != null ? ((Number) o).longValue() : 0;
    }

    private static BigDecimal toDecimal(Object o) {
        return o != null ? new BigDecimal(o.toString()) : BigDecimal.ZERO;
    }

    private static Instant toInstant(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof Timestamp ts) {
            return ts.toInstant();
        }
        if (o instanceof Instant i) {
            return i;
        }
        if (o instanceof java.time.LocalDateTime ldt) {
            return ldt.atZone(java.time.ZoneId.systemDefault()).toInstant();
        }
        return null;
    }

    private static LocalDate toLocalDate(Object o) {
        if (o == null) {
            return null;
        }
        if (o instanceof java.sql.Date d) {
            return d.toLocalDate();
        }
        if (o instanceof LocalDate ld) {
            return ld;
        }
        return null;
    }
}
