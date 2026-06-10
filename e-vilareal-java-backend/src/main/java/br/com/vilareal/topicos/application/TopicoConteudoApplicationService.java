package br.com.vilareal.topicos.application;

import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.TopicoLegadoConversor;
import br.com.vilareal.documento.TopicoLegadoConversor.TopicoConvertido;
import br.com.vilareal.topicos.api.dto.TopicoConverterHtmlResponse;
import br.com.vilareal.topicos.api.dto.TopicoResumoResponse;
import br.com.vilareal.topicos.api.dto.TopicoResponse;
import br.com.vilareal.topicos.infrastructure.persistence.entity.TopicoEntity;
import br.com.vilareal.topicos.infrastructure.persistence.repository.TopicoRepository;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;
import org.springframework.http.HttpStatus;

import java.util.ArrayList;
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

    /**
     * Converte o conteúdo legado ({@code conteudo_template}) dos tópicos cujo {@code subcategoria}
     * ou {@code chave_navegacao} contém {@code filtro} para o formato novo (HTML + tokens), gravando
     * em {@code conteudo_html}/{@code classe_html}. Idempotente: repetir apenas sobrescreve. Nunca
     * altera {@code conteudo_template}. Com {@code dryRun=true} (default) não grava — só conta e
     * devolve amostra.
     */
    @Transactional
    public TopicoConverterHtmlResponse converterParaHtml(String filtro, boolean dryRun) {
        if (!StringUtils.hasText(filtro)) {
            throw new ResponseStatusException(
                    HttpStatus.BAD_REQUEST, "Informe 'filtro' (ex.: 'EXECUÇÃO › TAXA CONDOMINIAL').");
        }
        List<TopicoEntity> topicos = topicoRepository.findByFiltroSubcategoriaOuChave(filtro.trim());
        List<TopicoConverterHtmlResponse.Amostra> amostra = new ArrayList<>();
        int convertidos = 0;
        for (TopicoEntity t : topicos) {
            TopicoConvertido c = TopicoLegadoConversor.converter(t.getConteudoTemplate());
            convertidos++;
            if (!dryRun) {
                t.setConteudoHtml(c.html());
                t.setClasseHtml(c.classe());
            }
            if (amostra.size() < 10) {
                String html = c.html() == null ? "" : c.html();
                amostra.add(new TopicoConverterHtmlResponse.Amostra(
                        t.getChaveNavegacao(),
                        t.getBlocoIndice(),
                        c.classe(),
                        html.length() > 200 ? html.substring(0, 200) : html));
            }
        }
        return new TopicoConverterHtmlResponse(filtro, topicos.size(), convertidos, dryRun, amostra);
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
