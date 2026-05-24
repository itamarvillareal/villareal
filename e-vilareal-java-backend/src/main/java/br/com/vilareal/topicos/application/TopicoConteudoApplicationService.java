package br.com.vilareal.topicos.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.topicos.api.dto.TopicoResumoResponse;
import br.com.vilareal.topicos.api.dto.TopicoResponse;
import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;

@Service
public class TopicoConteudoApplicationService {

    private final TopicoRepository topicoRepository;

    public TopicoConteudoApplicationService(TopicoRepository topicoRepository) {
        this.topicoRepository = topicoRepository;
    }

    @Transactional(readOnly = true)
    public Page<TopicoResumoResponse> listarAtivos(Pageable pageable) {
        return topicoRepository
                .findByAtivoTrueOrderByCategoriaAscSubcategoriaAscOrdemAscNomeAsc(pageable)
                .map(this::toResumo);
    }

    @Transactional(readOnly = true)
    public List<String> listarCategorias() {
        return topicoRepository.findDistinctCategoriasAtivas();
    }

    @Transactional(readOnly = true)
    public List<TopicoResumoResponse> listarPorCategoria(String categoria) {
        if (!StringUtils.hasText(categoria)) {
            return List.of();
        }
        return topicoRepository
                .findByAtivoTrueAndCategoriaIgnoreCaseOrderBySubcategoriaAscOrdemAscNomeAsc(categoria.trim())
                .stream()
                .map(this::toResumo)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<TopicoResumoResponse> buscar(String q) {
        if (!StringUtils.hasText(q)) {
            return List.of();
        }
        return topicoRepository.searchAtivos(q.trim()).stream().map(this::toResumo).toList();
    }

    @Transactional(readOnly = true)
    public TopicoResponse obterDetalhe(Long id) {
        TopicoEntity entity = topicoRepository
                .findById(id)
                .filter(TopicoEntity::getAtivo)
                .orElseThrow(() -> new ResourceNotFoundException("Tópico não encontrado: " + id));
        return toDetalhe(entity);
    }

    private TopicoResumoResponse toResumo(TopicoEntity entity) {
        TopicoResumoResponse dto = new TopicoResumoResponse();
        dto.setId(entity.getId());
        dto.setCategoria(entity.getCategoria());
        dto.setSubcategoria(entity.getSubcategoria());
        dto.setNome(entity.getNome());
        dto.setChaveNavegacao(entity.getChaveNavegacao());
        dto.setTipoFormatacao(entity.getTipoFormatacao());
        dto.setOrdem(entity.getOrdem());
        return dto;
    }

    private TopicoResponse toDetalhe(TopicoEntity entity) {
        TopicoResponse dto = new TopicoResponse();
        dto.setId(entity.getId());
        dto.setCategoria(entity.getCategoria());
        dto.setSubcategoria(entity.getSubcategoria());
        dto.setNome(entity.getNome());
        dto.setChaveNavegacao(entity.getChaveNavegacao());
        dto.setConteudoTemplate(entity.getConteudoTemplate());
        dto.setTipoFormatacao(entity.getTipoFormatacao());
        dto.setOrdem(entity.getOrdem());
        dto.setAtivo(entity.getAtivo());
        return dto;
    }
}
