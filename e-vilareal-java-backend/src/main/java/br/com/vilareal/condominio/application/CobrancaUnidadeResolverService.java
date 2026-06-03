package br.com.vilareal.condominio.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.documento.ClaudeApiService;
import br.com.vilareal.pessoa.api.dto.PessoaCadastroRequest;
import br.com.vilareal.pessoa.api.dto.PessoaCadastroResponse;
import br.com.vilareal.pessoa.api.dto.PessoaComplementarPayload;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.pessoa.application.PessoaApplicationService;
import br.com.vilareal.processo.api.dto.ProcessoParteWriteRequest;
import br.com.vilareal.processo.api.dto.ProcessoResponse;
import br.com.vilareal.processo.api.dto.ProcessoWriteRequest;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.application.ProcessoApplicationService;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoParteEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.Set;

/**
 * Resolve (ou cria) pessoa devedora e processo da unidade para ingestão automática de cobrança.
 */
@Service
public class CobrancaUnidadeResolverService {

    private static final Logger log = LoggerFactory.getLogger(CobrancaUnidadeResolverService.class);

    private static final String POLO_REU = "REU";
    private static final String QUAL_PROPRIETARIO = "Proprietário";
    private static final String GENERO_PJ = "PJ";

    private final PessoaRepository pessoaRepository;
    private final PessoaApplicationService pessoaApplicationService;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository processoParteRepository;
    private final ProcessoApplicationService processoApplicationService;
    private final ClaudeApiService claudeApiService;

    public CobrancaUnidadeResolverService(
            PessoaRepository pessoaRepository,
            PessoaApplicationService pessoaApplicationService,
            ProcessoRepository processoRepository,
            ProcessoParteRepository processoParteRepository,
            ProcessoApplicationService processoApplicationService,
            ClaudeApiService claudeApiService) {
        this.pessoaRepository = pessoaRepository;
        this.pessoaApplicationService = pessoaApplicationService;
        this.processoRepository = processoRepository;
        this.processoParteRepository = processoParteRepository;
        this.processoApplicationService = processoApplicationService;
        this.claudeApiService = claudeApiService;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public ResolucaoUnidade resolverUnidade(ResolverUnidadeInput in) {
        validarEntrada(in);
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(in.codigoCliente8());
        String unidade = in.unidadeNormalizada().trim().toUpperCase(Locale.ROOT);

        PessoaResolvida pessoa = resolverPessoa(in);
        ProcessoResolvido processo = resolverProcesso(in, cod8, unidade, pessoa.pessoaId());

        return new ResolucaoUnidade(
                pessoa.pessoaId(),
                pessoa.criada(),
                pessoa.generoDefinido(),
                processo.processoId(),
                processo.numeroInterno(),
                processo.processoCriado(),
                processo.reuVinculado(),
                processo.revisaoTrocaDono(),
                processo.pessoaIdReuAnterior());
    }

    private void validarEntrada(ResolverUnidadeInput in) {
        if (in.clienteId() < 1) {
            throw new BusinessRuleException("clienteId inválido.");
        }
        if (in.clientePessoaId() < 1) {
            throw new BusinessRuleException("clientePessoaId inválido.");
        }
        if (!StringUtils.hasText(in.unidadeNormalizada())) {
            throw new BusinessRuleException("Unidade é obrigatória.");
        }
        if (!StringUtils.hasText(in.devedorNome())) {
            throw new BusinessRuleException("Nome do devedor é obrigatório.");
        }
        String doc = somenteDigitos(in.devedorDocDigitos());
        if (doc.length() != 11 && doc.length() != 14) {
            throw new BusinessRuleException("CPF/CNPJ do devedor deve ter 11 ou 14 dígitos.");
        }
    }

    private PessoaResolvida resolverPessoa(ResolverUnidadeInput in) {
        String doc = somenteDigitos(in.devedorDocDigitos());
        boolean isPj = doc.length() == 14;

        Optional<PessoaEntity> existente = pessoaRepository.findByCpf(doc);
        if (existente.isPresent()) {
            return new PessoaResolvida(existente.get().getId(), false, null);
        }

        PessoaCadastroRequest req = new PessoaCadastroRequest();
        req.setNome(in.devedorNome().trim());
        req.setCpf(doc);
        req.setAtivo(true);
        PessoaCadastroResponse criada = pessoaApplicationService.criar(req);
        long pessoaId = criada.getId();

        String genero = isPj ? GENERO_PJ : inferirGenero(in.devedorNome());
        if (genero != null) {
            PessoaComplementarPayload comp = new PessoaComplementarPayload();
            comp.setGenero(genero);
            pessoaApplicationService.salvarComplementar(pessoaId, comp);
        }
        return new PessoaResolvida(pessoaId, true, genero);
    }

    private ProcessoResolvido resolverProcesso(
            ResolverUnidadeInput in, String cod8, String unidade, long pessoaIdDevedor) {
        Optional<ProcessoEntity> procOpt =
                processoRepository.findByCliente_IdAndUnidade(in.clienteId(), unidade);

        if (procOpt.isPresent()) {
            return resolverProcessoExistente(in, procOpt.get(), pessoaIdDevedor);
        }

        AlocacaoProcesso aloc = alocarProcVazioOuNovo(in, unidade);
        boolean reuVinculado = vincularReuSeNecessario(aloc.processo().getId(), pessoaIdDevedor, in.importacaoId());
        return new ProcessoResolvido(
                aloc.processo().getId(),
                aloc.processo().getNumeroInterno(),
                aloc.criado(),
                reuVinculado,
                false,
                null);
    }

    private ProcessoResolvido resolverProcessoExistente(
            ResolverUnidadeInput in, ProcessoEntity proc, long pessoaIdDevedor) {
        List<Long> reuIds = listarReuPessoaIds(proc.getId());

        if (reuIds.isEmpty() || reuIds.contains(pessoaIdDevedor)) {
            boolean reuVinculado = false;
            if (reuIds.isEmpty()) {
                reuVinculado = vincularReuSeNecessario(proc.getId(), pessoaIdDevedor, in.importacaoId());
            }
            return new ProcessoResolvido(
                    proc.getId(),
                    proc.getNumeroInterno(),
                    false,
                    reuVinculado,
                    false,
                    null);
        }

        Long reuAnterior = reuIds.getFirst();
        AlocacaoProcesso aloc = alocarProcVazioOuNovo(in, proc.getUnidade());
        boolean reuVinculado = vincularReuSeNecessario(aloc.processo().getId(), pessoaIdDevedor, in.importacaoId());
        return new ProcessoResolvido(
                aloc.processo().getId(),
                aloc.processo().getNumeroInterno(),
                aloc.criado(),
                reuVinculado,
                true,
                reuAnterior);
    }

    private AlocacaoProcesso alocarProcVazioOuNovo(ResolverUnidadeInput in, String unidade) {
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(in.codigoCliente8());
        List<ProcessoEntity> vazios = processoRepository.findProcessosVaziosPorCliente(
                in.clienteId(),
                cod8,
                PageRequest.of(0, 1, Sort.by("numeroInterno").ascending().and(Sort.by("id").ascending())));

        if (!vazios.isEmpty()) {
            ProcessoEntity p = vazios.getFirst();
            p.setUnidade(unidade);
            if (StringUtils.hasText(in.importacaoId())) {
                p.setImportacaoId(in.importacaoId().trim());
            }
            ProcessoEntity salvo = processoRepository.save(p);
            return new AlocacaoProcesso(salvo, false);
        }

        int ni = proximoNumeroInternoDisponivel(in.clienteId());
        ProcessoWriteRequest req = new ProcessoWriteRequest();
        req.setClienteId(in.clienteId());
        req.setPessoaTitularId(in.clientePessoaId());
        req.setNumeroInterno(ni);
        req.setUnidade(unidade);
        if (StringUtils.hasText(in.importacaoId())) {
            req.setImportacaoId(in.importacaoId().trim());
        }
        ProcessoResponse criado = processoApplicationService.criar(req);
        ProcessoEntity proc = processoRepository
                .findById(criado.getId())
                .orElseThrow(() -> new BusinessRuleException("Processo recém-criado não encontrado."));
        return new AlocacaoProcesso(proc, true);
    }

    private int proximoNumeroInternoDisponivel(long clienteId) {
        List<ProcessoEntity> lista = processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(clienteId);
        Set<Integer> usados = new HashSet<>();
        for (ProcessoEntity p : lista) {
            usados.add(p.getNumeroInterno());
        }
        int n = 1;
        while (usados.contains(n)) {
            n++;
        }
        return n;
    }

    private List<Long> listarReuPessoaIds(Long processoId) {
        List<Long> ids = new ArrayList<>();
        for (ProcessoParteEntity pp : processoParteRepository.findByProcesso_IdAndPoloReuOrderByOrdemAscIdAsc(processoId)) {
            if (pp.getPessoa() != null) {
                ids.add(pp.getPessoa().getId());
            }
        }
        return ids;
    }

    private boolean vincularReuSeNecessario(Long processoId, long pessoaIdDevedor, String importacaoId) {
        if (processoParteRepository
                .findFirstByProcesso_IdAndPoloIgnoreCaseAndPessoa_Id(processoId, POLO_REU, pessoaIdDevedor)
                .isPresent()) {
            return false;
        }
        int ordem = proximaOrdemParte(processoId);
        ProcessoParteWriteRequest wr = new ProcessoParteWriteRequest();
        wr.setPessoaId(pessoaIdDevedor);
        wr.setPolo(POLO_REU);
        wr.setQualificacao(QUAL_PROPRIETARIO);
        wr.setOrdem(ordem);
        if (StringUtils.hasText(importacaoId)) {
            wr.setImportacaoId(importacaoId.trim());
        }
        processoApplicationService.criarParte(processoId, wr);
        return true;
    }

    private int proximaOrdemParte(Long processoId) {
        return processoParteRepository.findByProcesso_IdOrderByOrdemAscIdAsc(processoId).stream()
                        .mapToInt(ProcessoParteEntity::getOrdem)
                        .max()
                        .orElse(-1)
                + 1;
    }

    String inferirGenero(String nomeCompleto) {
        try {
            String resposta = claudeApiService.enviarMensagem(
                    "Classifique o gênero provável do nome brasileiro. Responda APENAS 'M' ou 'F'.",
                    primeiroNome(nomeCompleto));
            if (resposta == null) {
                return null;
            }
            String t = resposta.trim().toUpperCase(Locale.ROOT);
            if ("M".equals(t) || "F".equals(t)) {
                return t;
            }
            return null;
        } catch (Exception e) {
            log.warn("Falha ao inferir gênero para '{}': {}", nomeCompleto, e.getMessage());
            return null;
        }
    }

    static String primeiroNome(String nome) {
        if (!StringUtils.hasText(nome)) {
            return "";
        }
        String t = nome.trim();
        int sp = t.indexOf(' ');
        return sp > 0 ? t.substring(0, sp) : t;
    }

    static String somenteDigitos(String raw) {
        if (raw == null) {
            return "";
        }
        return raw.replaceAll("\\D", "");
    }

    private record PessoaResolvida(long pessoaId, boolean criada, String generoDefinido) {}

    private record AlocacaoProcesso(ProcessoEntity processo, boolean criado) {}

    private record ProcessoResolvido(
            long processoId,
            int numeroInterno,
            boolean processoCriado,
            boolean reuVinculado,
            boolean revisaoTrocaDono,
            Long pessoaIdReuAnterior) {}
}
