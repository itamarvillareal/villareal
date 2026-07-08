package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.documento.importacao.api.dto.ProcessoMatchSugestaoResponse;
import br.com.vilareal.documento.importacao.api.dto.ProcessoStubConfirmacao;
import br.com.vilareal.documento.importacao.infrastructure.persistence.entity.ContratoHonorariosImportacaoEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.ClienteRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

import java.util.Comparator;
import java.util.List;
import java.util.Optional;

@Service
public class ContratoHonorariosImportacaoProcessoResolverService {

    private final ProcessoRepository processoRepository;
    private final ClienteRepository clienteRepository;

    public ContratoHonorariosImportacaoProcessoResolverService(
            ProcessoRepository processoRepository, ClienteRepository clienteRepository) {
        this.processoRepository = processoRepository;
        this.clienteRepository = clienteRepository;
    }

    public ProcessoMatchSugestaoResponse sugerirProcesso(
            ContratoHonorariosImportacaoEntity item, String numeroCnjExtraido) {
        if (item.getProcesso() != null && item.getProcesso().getId() != null) {
            ProcessoEntity p = item.getProcesso();
            return new ProcessoMatchSugestaoResponse(
                    p.getId(),
                    p.getNumeroInterno(),
                    p.getNumeroCnj(),
                    p.getDescricaoAcao(),
                    100,
                    false);
        }
        if (StringUtils.hasText(numeroCnjExtraido)) {
            Optional<ProcessoEntity> porCnj = processoRepository.findByNumeroCnj(numeroCnjExtraido);
            if (porCnj.isPresent()) {
                ProcessoEntity p = porCnj.get();
                return new ProcessoMatchSugestaoResponse(
                        p.getId(),
                        p.getNumeroInterno(),
                        p.getNumeroCnj(),
                        p.getDescricaoAcao(),
                        90,
                        false);
            }
        }
        ClienteEntity cliente = item.getCliente();
        if (cliente == null && StringUtils.hasText(item.getCodigoCliente())) {
            cliente = clienteRepository
                    .findByCodigoClienteFetchPessoaTrim(item.getCodigoCliente().trim())
                    .orElse(null);
        }
        if (cliente != null) {
            List<ProcessoEntity> processos = processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(cliente.getId());
            if (processos.size() == 1) {
                ProcessoEntity p = processos.get(0);
                return new ProcessoMatchSugestaoResponse(
                        p.getId(),
                        p.getNumeroInterno(),
                        p.getNumeroCnj(),
                        p.getDescricaoAcao(),
                        60,
                        false);
            }
        }
        return new ProcessoMatchSugestaoResponse(null, null, numeroCnjExtraido, null, 0, true);
    }

    public ProcessoEntity resolverOuCriarStub(
            ContratoHonorariosImportacaoEntity item, ProcessoStubConfirmacao stub, Long processoIdInformado) {
        if (processoIdInformado != null) {
            return processoRepository
                    .findById(processoIdInformado)
                    .orElseThrow(() -> new IllegalArgumentException("Processo não encontrado: " + processoIdInformado));
        }
        if (stub == null || !StringUtils.hasText(stub.codigoCliente())) {
            throw new IllegalArgumentException("Informe processo existente ou dados do stub.");
        }
        ClienteEntity cliente = clienteRepository
                .findByCodigoClienteFetchPessoaTrim(stub.codigoCliente().trim())
                .orElseThrow(() -> new IllegalArgumentException("Cliente não encontrado: " + stub.codigoCliente()));
        Integer numeroInterno = stub.numeroInterno();
        if (numeroInterno == null) {
            numeroInterno = proximoNumeroInterno(cliente.getId());
        }
        Optional<ProcessoEntity> existente =
                processoRepository.findByCliente_IdAndNumeroInterno(cliente.getId(), numeroInterno);
        if (existente.isPresent()) {
            return existente.get();
        }
        ProcessoEntity p = new ProcessoEntity();
        p.setCliente(cliente);
        p.setPessoa(cliente.getPessoa());
        p.setNumeroInterno(numeroInterno);
        p.setNumeroCnj(StringUtils.hasText(stub.numeroCnj()) ? stub.numeroCnj().trim() : null);
        p.setDescricaoAcao(StringUtils.hasText(stub.descricao()) ? stub.descricao().trim() : "Contrato importado");
        p.setImportacaoItemId(item.getId());
        p.setAtivo(true);
        return processoRepository.save(p);
    }

    int proximoNumeroInterno(Long clienteId) {
        return processoRepository.findByCliente_IdOrderByNumeroInternoAscIdAsc(clienteId).stream()
                .map(ProcessoEntity::getNumeroInterno)
                .filter(n -> n != null && n >= 0)
                .max(Comparator.naturalOrder())
                .map(n -> n + 1)
                .orElse(1);
    }
}
