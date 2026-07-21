package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ContratoLocacaoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelVinculoProcessoPrincipalEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelVinculoProcessoPrincipalRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.application.ProcessoCanonicalLookup;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Optional;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * Resolve o processo vigente de um imóvel/contrato para reconciliação e conta corrente.
 * Prioridade: vínculo principal persistido ({@code imovel_vinculo_processo_principal}) →
 * N:N ativo ({@code imovel_processo}) → escalar {@code imovel.processo_id}.
 */
@Service
public class ImovelVinculoProcessoPrincipalResolver {

    private static final Pattern LEGADO_PLANILHA_OBS =
            Pattern.compile("planilha\\s+legado[^0-9]*(\\d{1,3})", Pattern.CASE_INSENSITIVE | Pattern.UNICODE_CASE);

    private final ImovelVinculoProcessoPrincipalRepository vinculoPrincipalRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ImovelProcessoRepository imovelProcessoRepository;

    public ImovelVinculoProcessoPrincipalResolver(
            ImovelVinculoProcessoPrincipalRepository vinculoPrincipalRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ImovelProcessoRepository imovelProcessoRepository) {
        this.vinculoPrincipalRepository = vinculoPrincipalRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.imovelProcessoRepository = imovelProcessoRepository;
    }

    @Transactional(readOnly = true)
    public Optional<ProcessoEntity> resolverProcessoDoContrato(ContratoLocacaoEntity contrato) {
        ImovelEntity imovel = contrato != null ? contrato.getImovel() : null;
        if (imovel == null) {
            return Optional.empty();
        }
        Optional<ProcessoEntity> principal = resolverProcessoPrincipalPorImovel(imovel);
        if (principal.isPresent()) {
            return principal;
        }
        return resolverProcessoAtivoImovel(imovel);
    }

    @Transactional(readOnly = true)
    public Optional<ProcessoEntity> resolverProcessoPrincipalPorImovel(ImovelEntity imovel) {
        if (imovel == null) {
            return Optional.empty();
        }
        Integer planilha = numeroPlanilhaDoImovel(imovel);
        if (planilha == null || planilha < 1) {
            return Optional.empty();
        }
        return vinculoPrincipalRepository
                .findById(planilha)
                .flatMap(this::resolverProcessoDoVinculoPrincipal);
    }

    @Transactional(readOnly = true)
    public Optional<ProcessoEntity> resolverProcessoAtivoImovel(ImovelEntity imovel) {
        if (imovel == null) {
            return Optional.empty();
        }
        if (imovel.getId() != null) {
            Optional<ProcessoEntity> fromNn = imovelProcessoRepository
                    .findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(imovel.getId())
                    .map(ImovelProcessoEntity::getProcesso)
                    .filter(p -> p.getNumeroInterno() != null);
            if (fromNn.isPresent()) {
                return fromNn;
            }
        }
        ProcessoEntity escalar = imovel.getProcesso();
        if (escalar != null && escalar.getNumeroInterno() != null) {
            return Optional.of(escalar);
        }
        return Optional.empty();
    }

    private Optional<ProcessoEntity> resolverProcessoDoVinculoPrincipal(ImovelVinculoProcessoPrincipalEntity pref) {
        if (pref == null) {
            return Optional.empty();
        }
        return buscarProcessoPorCodigoProc(pref.getCodigoCliente(), pref.getNumeroInterno());
    }

    Optional<ProcessoEntity> buscarProcessoPorCodigoProc(String codigoCliente, Integer numeroInterno) {
        if (!StringUtils.hasText(codigoCliente) || numeroInterno == null || numeroInterno < 1) {
            return Optional.empty();
        }
        String codNorm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente);
        if (!StringUtils.hasText(codNorm)) {
            return Optional.empty();
        }
        return clienteRepository
                .findByCodigoCliente(codNorm)
                .flatMap(cliente -> {
                    Long pessoaId = cliente.getPessoa() != null ? cliente.getPessoa().getId() : null;
                    return ProcessoCanonicalLookup.escolher(
                                    processoRepository.findAllByCliente_IdAndNumeroInternoOrderByIdDesc(
                                            cliente.getId(), numeroInterno),
                                    pessoaId)
                            .or(() -> processoRepository.findByCliente_IdAndNumeroInterno(cliente.getId(), numeroInterno))
                            .or(() -> pessoaId != null
                                    ? processoRepository.findByPessoa_IdAndNumeroInterno(pessoaId, numeroInterno)
                                    : Optional.empty());
                });
    }

    private static Integer numeroPlanilhaDoImovel(ImovelEntity imovel) {
        if (imovel.getNumeroPlanilha() != null && imovel.getNumeroPlanilha() >= 1) {
            return imovel.getNumeroPlanilha();
        }
        return extrairNumeroPlanilhaLegadoObservacoes(imovel.getObservacoes());
    }

    private static Integer extrairNumeroPlanilhaLegadoObservacoes(String observacoes) {
        if (!StringUtils.hasText(observacoes)) {
            return null;
        }
        Matcher m = LEGADO_PLANILHA_OBS.matcher(observacoes);
        if (!m.find()) {
            return null;
        }
        try {
            int n = Integer.parseInt(m.group(1));
            return n >= 1 ? n : null;
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
