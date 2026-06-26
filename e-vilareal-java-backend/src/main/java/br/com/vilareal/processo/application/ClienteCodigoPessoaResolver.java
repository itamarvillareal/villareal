package br.com.vilareal.processo.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.importacao.PlanilhaPasta1MapeamentoUtil;
import br.com.vilareal.importacao.infrastructure.persistence.entity.PlanilhaPasta1ClienteEntity;
import br.com.vilareal.importacao.infrastructure.persistence.repository.PlanilhaPasta1ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Optional;

/**
 * Resolve o código de cliente (8 dígitos ou chave da planilha Pasta1) para {@code pessoa.id},
 * consultando {@code planilha_pasta1_cliente} antes da convenção legada (código = id da pessoa).
 */
@Service
public class ClienteCodigoPessoaResolver {

    private final PlanilhaPasta1ClienteRepository planilhaPasta1ClienteRepository;
    private final ClienteRepository clienteRepository;

    public ClienteCodigoPessoaResolver(
            PlanilhaPasta1ClienteRepository planilhaPasta1ClienteRepository,
            ClienteRepository clienteRepository) {
        this.planilhaPasta1ClienteRepository = planilhaPasta1ClienteRepository;
        this.clienteRepository = clienteRepository;
    }

    public long resolverPessoaId(String codigoCliente) {
        if (codigoCliente == null || codigoCliente.isBlank()) {
            throw new BusinessRuleException("codigoCliente é obrigatório");
        }
        String norm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente.trim());
        return buscarMapeamentoPlanilha(norm)
                .map(PlanilhaPasta1ClienteEntity::getPessoaId)
                .orElseGet(() -> CodigoClienteUtil.parsePessoaId(norm));
    }

    /**
     * Preferência por {@code findById(chave)} após upsert na importação massiva (evita {@code findAll} por linha).
     */
    public long resolverPessoaIdAposMapeamentoChaveExacta(String chaveOuCodigo) {
        if (chaveOuCodigo == null || chaveOuCodigo.isBlank()) {
            throw new BusinessRuleException("codigoCliente é obrigatório");
        }
        String t = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(chaveOuCodigo.trim());
        return planilhaPasta1ClienteRepository
                .findById(t)
                .map(PlanilhaPasta1ClienteEntity::getPessoaId)
                .orElseGet(
                        () -> buscarMapeamentoPlanilha(t)
                                .map(PlanilhaPasta1ClienteEntity::getPessoaId)
                                .orElseGet(() -> CodigoClienteUtil.parsePessoaId(t)));
    }

    /** Só a tabela Pasta1 — sem fallback “código = id da pessoa”. */
    public Optional<Long> resolverPessoaIdSomentePlanilha(String codigoCliente) {
        if (codigoCliente == null || codigoCliente.isBlank()) {
            return Optional.empty();
        }
        String norm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente.trim());
        return buscarMapeamentoPlanilha(norm).map(PlanilhaPasta1ClienteEntity::getPessoaId);
    }

    /** {@code true} quando há import Pasta1 gravado — UI e APIs não devem assumir cliente N = pessoa N. */
    public boolean haMapeamentosPlanilhaPasta1() {
        return planilhaPasta1ClienteRepository.count() > 0;
    }

    /**
     * Código do cliente contratante do processo ({@code processo.cliente_id}), alinhado a
     * {@code ProcessoResponse#getCodigoCliente()}. Só usa o titular ({@code processo.pessoa_id})
     * quando não há cliente vinculado.
     */
    public String codigoClienteExibicaoParaProcesso(ProcessoEntity processo) {
        if (processo == null) {
            return null;
        }
        if (processo.getCliente() != null && StringUtils.hasText(processo.getCliente().getCodigoCliente())) {
            return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(processo.getCliente().getCodigoCliente());
        }
        if (processo.getPessoa() != null) {
            return codigoClienteExibicaoParaPessoaId(processo.getPessoa().getId());
        }
        return null;
    }

    public String codigoClienteExibicaoParaPessoaId(long pessoaIdDonoProcesso) {
        List<ClienteEntity> clientes =
                clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaIdDonoProcesso);
        if (!clientes.isEmpty()) {
            String codCadastro =
                    CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(clientes.get(0).getCodigoCliente());
            if (codCadastro != null && !codCadastro.isEmpty()) {
                return codCadastro;
            }
        }
        if (haMapeamentosPlanilhaPasta1()) {
            List<PlanilhaPasta1ClienteEntity> maps =
                    planilhaPasta1ClienteRepository.findByPessoaIdOrderByChaveClienteAsc(pessoaIdDonoProcesso);
            if (!maps.isEmpty()) {
                String chave = maps.get(0).getChaveCliente();
                return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(chave);
            }
        }
        return CodigoClienteUtil.formatar(pessoaIdDonoProcesso);
    }

    /**
     * Para listagens (processos, etc.): primeiro tenta {@code cliente.codigo_cliente} (cadastro / import —
     * fonte de verdade). Depois, se houver Pasta1 importada, o mapeamento da planilha. Por fim, convenção
     * legada {@link #resolverPessoaId(String)} (código numérico = id da pessoa), que falha silenciosamente
     * aqui via {@link Optional} quando não aplicável.
     * <p>
     * Sem consultar {@code cliente} antes do legado, um código como {@code 00000728} era interpretado como
     * pessoa id 728 em ambiente sem linhas em {@code planilha_pasta1_cliente}, ignorando o {@code pessoa_id}
     * real (ex.: 1809) gravado em {@code cliente}.
     */
    public Optional<Long> resolverPessoaIdComFallbackCliente(String codigoCliente) {
        if (codigoCliente == null || codigoCliente.isBlank()) {
            return Optional.empty();
        }
        String norm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente.trim());
        if (norm == null || norm.isEmpty()) {
            return Optional.empty();
        }
        Optional<ClienteEntity> linha =
                clienteRepository.findByCodigoClienteFetchPessoa(norm);
        if (linha.isEmpty()) {
            linha = clienteRepository.findByCodigoClienteFetchPessoaTrim(norm);
        }
        Optional<Long> fromCliente = linha.map(c -> c.getPessoa().getId());
        if (fromCliente.isPresent()) {
            return fromCliente;
        }
        if (haMapeamentosPlanilhaPasta1()) {
            Optional<Long> fromPlanilha = resolverPessoaIdSomentePlanilha(codigoCliente);
            if (fromPlanilha.isPresent()) {
                return fromPlanilha;
            }
        }
        try {
            return Optional.of(resolverPessoaId(codigoCliente));
        } catch (BusinessRuleException e) {
            return Optional.empty();
        }
    }

    public Optional<PlanilhaPasta1ClienteEntity> buscarMapeamentoPlanilha(String codigoOuChave) {
        if (codigoOuChave == null || codigoOuChave.isBlank()) {
            return Optional.empty();
        }
        return PlanilhaPasta1MapeamentoUtil.escolherMelhorMapeamento(
                planilhaPasta1ClienteRepository.findAll(), codigoOuChave.trim());
    }

    /** Ex.: {@code "00000001"} → {@code "1"}; só altera se a string for só dígitos. */
    public static String compactarChaveSoDigitos(String cod) {
        String s = cod.trim();
        if (s.isEmpty() || !s.chars().allMatch(Character::isDigit)) {
            return s;
        }
        String stripped = s.replaceFirst("^0+(?!$)", "");
        return stripped.isEmpty() ? "0" : stripped;
    }
}
