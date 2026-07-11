package br.com.vilareal.financeiro.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.financeiro.api.dto.ContaAcertoResumoResponse;
import br.com.vilareal.financeiro.api.dto.ContaAcertoResumoVinculoResponse;
import br.com.vilareal.financeiro.infrastructure.persistence.repository.LancamentoFinanceiroRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.util.List;

/**
 * Resumo da conta de acerto (CONTA ZERO): por vínculo (cliente ou pessoa/imóvel), total pendente e
 * saldo líquido — quem deve a quem. Alimenta o alerta de "conta não zerada" na UI.
 */
@Service
public class ContaAcertoApplicationService {

    private final LancamentoFinanceiroRepository lancamentoRepository;
    private final ContaBancariaApplicationService contaBancariaApplicationService;
    private final ClienteRepository clienteRepository;
    private final PessoaRepository pessoaRepository;

    public ContaAcertoApplicationService(
            LancamentoFinanceiroRepository lancamentoRepository,
            ContaBancariaApplicationService contaBancariaApplicationService,
            ClienteRepository clienteRepository,
            PessoaRepository pessoaRepository) {
        this.lancamentoRepository = lancamentoRepository;
        this.contaBancariaApplicationService = contaBancariaApplicationService;
        this.clienteRepository = clienteRepository;
        this.pessoaRepository = pessoaRepository;
    }

    @Transactional(readOnly = true)
    public ContaAcertoResumoResponse resumo(Integer numeroBanco) {
        if (numeroBanco == null) {
            throw new BusinessRuleException("numeroBanco é obrigatório.");
        }
        if (!contaBancariaApplicationService.exigeSomaZero(numeroBanco)) {
            throw new BusinessRuleException(
                    "Conta " + numeroBanco + " não é conta de acerto (exige_soma_zero).");
        }

        ContaAcertoResumoResponse response = new ContaAcertoResumoResponse();
        response.setNumeroBanco(numeroBanco);
        BigDecimal somaConta = BigDecimal.ZERO;
        BigDecimal somaPendente = BigDecimal.ZERO;
        long totalLancamentos = 0;
        long totalPendentes = 0;

        List<Object[]> rows = lancamentoRepository.resumoContaAcertoPorVinculo(numeroBanco);
        for (Object[] row : rows) {
            String tipo = String.valueOf(row[0]);
            Long vinculoId = row[1] != null ? ((Number) row[1]).longValue() : null;
            long total = row[2] != null ? ((Number) row[2]).longValue() : 0;
            BigDecimal saldo = row[3] != null ? new BigDecimal(row[3].toString()) : BigDecimal.ZERO;
            long pendentes = row[4] != null ? ((Number) row[4]).longValue() : 0;
            BigDecimal saldoPendente = row[5] != null ? new BigDecimal(row[5].toString()) : BigDecimal.ZERO;

            ContaAcertoResumoVinculoResponse v = new ContaAcertoResumoVinculoResponse();
            if ("C".equals(tipo) && vinculoId != null) {
                v.setClienteId(vinculoId);
                clienteRepository.findById(vinculoId).ifPresent(c -> {
                    v.setCodigoCliente(c.getCodigoCliente());
                    v.setNome(nomeCliente(c));
                });
            } else if ("P".equals(tipo) && vinculoId != null) {
                v.setPessoaRefId(vinculoId);
                pessoaRepository.findById(vinculoId)
                        .ifPresent(p -> v.setNome(Utf8MojibakeUtil.corrigir(p.getNome())));
            } else {
                v.setNome("(sem vínculo)");
            }
            v.setTotalLancamentos(total);
            v.setPendentes(pendentes);
            v.setSaldo(saldo);
            v.setSaldoPendente(saldoPendente);
            response.getVinculos().add(v);

            somaConta = somaConta.add(saldo);
            somaPendente = somaPendente.add(saldoPendente);
            totalLancamentos += total;
            totalPendentes += pendentes;
        }

        response.setSomaConta(somaConta);
        response.setSomaPendente(somaPendente);
        response.setTotalLancamentos(totalLancamentos);
        response.setTotalPendentes(totalPendentes);
        return response;
    }

    private static String nomeCliente(ClienteEntity c) {
        if (c.getPessoa() != null && c.getPessoa().getNome() != null) {
            return Utf8MojibakeUtil.corrigir(c.getPessoa().getNome());
        }
        return Utf8MojibakeUtil.corrigir(c.getNomeReferencia());
    }
}
