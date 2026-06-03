package br.com.vilareal.condominio.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.condominio.api.dto.RelatorioExecucaoCobranca;
import br.com.vilareal.condominio.infrastructure.persistence.entity.CobrancaExecucaoEntity;
import br.com.vilareal.condominio.infrastructure.persistence.repository.CobrancaExecucaoRepository;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class CobrancaExecucaoPersistenciaService {

    private final CobrancaExecucaoRepository repository;
    private final ObjectMapper objectMapper;

    public CobrancaExecucaoPersistenciaService(CobrancaExecucaoRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional
    public void salvar(RelatorioExecucaoCobranca relatorio) {
        var exec = relatorio.totaisExecucao();
        CobrancaExecucaoEntity e = new CobrancaExecucaoEntity();
        e.setCriadoEm(Instant.parse(relatorio.cabecalho().criadoEmIso()));
        e.setImportacaoId(relatorio.importacaoId());
        e.setClienteCodigo(relatorio.cabecalho().clienteCodigo());
        e.setTotalTitulos(relatorio.totaisDocumento().titulos());
        e.setTotalInseridos(exec.titulosInseridos());
        e.setTotalIgnorados(exec.titulosIgnorados());
        e.setTotalFalhados(exec.titulosFalhados());
        e.setProcessosCriados(exec.processosCriados());
        e.setRevisoesTrocaDono(exec.revisoesTrocaDono());
        try {
            e.setRelatorioJson(objectMapper.writeValueAsString(relatorio));
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Falha ao serializar relatório de cobrança", ex);
        }
        repository.save(e);
    }

    @Transactional(readOnly = true)
    public RelatorioExecucaoCobranca carregar(String importacaoId) {
        CobrancaExecucaoEntity e = repository
                .findByImportacaoId(importacaoId.trim())
                .orElseThrow(() -> new ResourceNotFoundException("Relatório de cobrança não encontrado: " + importacaoId));
        try {
            return objectMapper.readValue(e.getRelatorioJson(), RelatorioExecucaoCobranca.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Relatório armazenado inválido", ex);
        }
    }
}
