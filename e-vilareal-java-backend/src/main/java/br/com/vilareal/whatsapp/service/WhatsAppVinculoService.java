package br.com.vilareal.whatsapp.service;

import br.com.vilareal.common.text.Utf8MojibakeUtil;
import br.com.vilareal.pessoa.application.TelefoneBuscaSupport;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.PessoaEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;

/**
 * Resolve clientes (código + nome) vinculados a um telefone de conversa WhatsApp.
 *
 * <p>Mesma regra do modal «Vínculos pelo telefone»: telefone → pessoa(s) no cadastro → linhas em
 * {@code cliente} da pessoa. Não inclui processos/partes.</p>
 */
@Service
public class WhatsAppVinculoService {

    public record ClienteVinculoResumo(String codigoCliente, String nome) {}

    private final PessoaRepository pessoaRepository;
    private final ClienteRepository clienteRepository;

    public WhatsAppVinculoService(PessoaRepository pessoaRepository, ClienteRepository clienteRepository) {
        this.pessoaRepository = pessoaRepository;
        this.clienteRepository = clienteRepository;
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
            for (ClienteEntity cliente : clienteRepository.findByPessoa_IdOrderByCodigoClienteAsc(pessoaId)) {
                String codigo = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(cliente.getCodigoCliente());
                if (!StringUtils.hasText(codigo)) {
                    continue;
                }
                porCodigo.putIfAbsent(codigo, new ClienteVinculoResumo(codigo, resolverNome(cliente)));
            }
        }
        return new ArrayList<>(porCodigo.values());
    }

    private List<Long> buscarIdsPorTelefone(String telDigits) {
        List<String> variants = TelefoneBuscaSupport.variantes(telDigits);
        String sufixoLocal = TelefoneBuscaSupport.sufixoLocal(telDigits);
        String parcial = telDigits.length() < 8 ? telDigits : "";
        return pessoaRepository.findIdsByTelefoneIndice(
                variants, sufixoLocal != null ? sufixoLocal : "", parcial);
    }

    private static String resolverNome(ClienteEntity cliente) {
        PessoaEntity pessoa = cliente.getPessoa();
        String nome =
                StringUtils.hasText(cliente.getNomeReferencia()) ? cliente.getNomeReferencia() : pessoa.getNome();
        return StringUtils.hasText(nome) ? Utf8MojibakeUtil.corrigir(nome.trim()) : "";
    }
}
