package br.com.vilareal.topicos.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.topicos.api.dto.TopicoNoDto;
import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoHierarquiaEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoHierarquiaRepository;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class TopicosApplicationService {

    private static final int CONFIG_ID = 1;

    private final TopicoHierarquiaRepository repository;
    private final ObjectMapper objectMapper;

    public TopicosApplicationService(TopicoHierarquiaRepository repository, ObjectMapper objectMapper) {
        this.repository = repository;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public TopicoNoDto obterRaiz() {
        TopicoHierarquiaEntity row = repository.findById(CONFIG_ID)
                .orElseThrow(() -> new ResourceNotFoundException("Hierarquia de tópicos não configurada."));
        if (!StringUtils.hasText(row.getRaizJson())) {
            throw new ResourceNotFoundException("Hierarquia de tópicos vazia.");
        }
        try {
            return objectMapper.readValue(row.getRaizJson(), TopicoNoDto.class);
        } catch (Exception e) {
            throw new IllegalStateException("JSON da hierarquia de tópicos inválido.", e);
        }
    }
}
