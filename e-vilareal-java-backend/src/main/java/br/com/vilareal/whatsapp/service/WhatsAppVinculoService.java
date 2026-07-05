package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.application.ClienteResolverService;
import br.com.vilareal.pessoa.application.TelefoneBuscaSupport;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.ClienteCodigoPessoaResolver;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoParteRepository;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Optional;

/**
 * Resolve clientes (código + nome) vinculados a um telefone de conversa WhatsApp.
 *
 * <p>Alinhado ao modal «Vínculos pelo telefone»: telefone → pessoa(s) → clientes diretos da pessoa
 * <strong>e</strong> clientes do escritório de cada processo vinculado (titular, parte, advogado ou
 * nome livre em parte).</p>
 */
@Service
public class WhatsAppVinculoService {

    public record ClienteVinculoResumo(String codigoCliente, String nome) {}

    private final PessoaRepository pessoaRepository;
    private final ClienteRepository clienteRepository;
    private final ProcessoRepository processoRepository;
    private final ProcessoParteRepository parteRepository;
    private final ClienteCodigoPessoaResolver clienteCodigoPessoaResolver;
    private final ClienteResolverService clienteResolverService;

    public WhatsAppVinculoService(
            PessoaRepository pessoaRepository,
            ClienteRepository clienteRepository,
            ProcessoRepository processoRepository,
            ProcessoParteRepository parteRepository,
            ClienteCodigoPessoaResolver clienteCodigoPessoaResolver,
            ClienteResolverService clienteResolverService) {
        this.pessoaRepository = pessoaRepository;
        this.clienteRepository = clienteRepository;
        this.processoRepository = processoRepository;
        this.parteRepository = parteRepository;
        this.clienteCodigoPessoaResolver = clienteCodigoPessoaResolver;
        this.clienteResolverService = clienteResolverService;
    }

    @Transactional(readOnly = true)
    public List<ClienteVinculoResumo> resolverClientesPorTelefone(String phoneNumber) {
        String digits = TelefoneBuscaSupport.normalizar(phoneNumber);
        if (digits == null || digits.length() < 4) {
            return List.of();
        }

        List<Long> pessoaIds = buscarIdsPorTelefone(digits);
        if (pessoaIds.isEmpty()) {
            return List.of();
        }

        LinkedHashMap<String, ClienteVinculoResumo> porCodigo = new LinkedHashMap<>();
        for (Long pessoaId : pessoaIds) {
            incluirClientesDiretosDaPessoa(pessoaId, porCodigo);
            incluirClientesDosProcessosDaPessoa(pessoaId, porCodigo);
        }
        return new ArrayList<>(porCodigo.values());
    }

    private void incluirClientesDiretosDaPessoa(Long pessoaId, LinkedHashMap<String, ClienteVinculoResumo> porCodigo) {
        for (ClienteEntity cliente : clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId)) {
            registrarCliente(porCodigo, cliente.getCodigoCliente(), resolverNomeCliente(cliente));
        }
    }

    private void incluirClientesDosProcessosDaPessoa(Long pessoaId, LinkedHashMap<String, ClienteVinculoResumo> porCodigo) {
        LinkedHashMap<Long, ProcessoEntity> processosPorId = new LinkedHashMap<>();
        for (ProcessoEntity processo : processoRepository.findAllDistinctVinculadosPessoa(pessoaId)) {
            processosPorId.put(processo.getId(), processo);
        }

        String nomePessoa =
                pessoaRepository.findById(pessoaId).map(p -> Utf8MojibakeUtil.corrigir(p.getNome())).orElse("");
        if (StringUtils.hasText(nomePessoa)) {
            for (Long processoId : parteRepository.findDistinctProcessoIdsByNomeLivreSemPessoa(nomePessoa.trim())) {
                if (!processosPorId.containsKey(processoId)) {
                    processoRepository.findById(processoId).ifPresent(p -> processosPorId.put(processoId, p));
                }
            }
        }

        for (ProcessoEntity processo : processosPorId.values()) {
            String codigo = clienteCodigoPessoaResolver.codigoClienteExibicaoParaProcesso(processo);
            registrarCliente(porCodigo, codigo, resolverNomePorCodigoCliente(codigo));
        }
    }

    private void registrarCliente(
            LinkedHashMap<String, ClienteVinculoResumo> porCodigo, String codigoBruto, String nome) {
        String canonico = codigoClienteCanonico(codigoBruto);
        if (!StringUtils.hasText(canonico)) {
            return;
        }
        porCodigo.putIfAbsent(canonico, new ClienteVinculoResumo(canonico, nome));
    }

    private static String codigoClienteCanonico(String codigoBruto) {
        return CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoBruto);
    }

    private List<Long> buscarIdsPorTelefone(String telDigits) {
        List<String> variants = TelefoneBuscaSupport.variantes(telDigits);
        String sufixoLocal = TelefoneBuscaSupport.sufixoLocal(telDigits);
        String parcial = telDigits.length() < 8 ? telDigits : "";
        return pessoaRepository.findIdsByTelefoneIndice(
                variants, sufixoLocal != null ? sufixoLocal : "", parcial);
    }

    private String resolverNomePorCodigoCliente(String codigoCliente) {
        String canonico = codigoClienteCanonico(codigoCliente);
        if (!StringUtils.hasText(canonico)) {
            return "";
        }
        Optional<ClienteEntity> cliente = clienteResolverService.encontrarClientePorCodigo(canonico);
        if (cliente.isPresent()) {
            return resolverNomeCliente(cliente.get());
        }
        return canonico;
    }

    private static String resolverNomeCliente(ClienteEntity cliente) {
        if (cliente == null) {
            return "";
        }
        PessoaEntity pessoa = cliente.getPessoa();
        String nome =
                StringUtils.hasText(cliente.getNomeReferencia()) ? cliente.getNomeReferencia() : pessoa.getNome();
        return StringUtils.hasText(nome) ? Utf8MojibakeUtil.corrigir(nome.trim()) : "";
    }
}
