package br.com.vilareal.documento.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.documento.api.dto.DocumentoModeloListItemResponse;
import br.com.vilareal.documento.api.dto.DocumentoModeloPreviewRequest;
import br.com.vilareal.documento.api.dto.DocumentoModeloResponse;
import br.com.vilareal.documento.api.dto.DocumentoModeloWriteRequest;
import br.com.vilareal.documento.DocumentoPdfService;
import br.com.vilareal.documento.infrastructure.persistence.entity.DocumentoModeloEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.DocumentoModeloRepository;
import br.com.vilareal.documento.tema.DocumentoModeloMapper;
import br.com.vilareal.documento.tema.TemaDocumento;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class DocumentoModeloApplicationService {

    private static final long MAX_CABECALHO_BYTES = 2_097_152L;
    private static final Set<String> CONTENT_TYPES_PERMITIDOS = Set.of("image/jpeg", "image/png", "image/jpg");

    private final DocumentoModeloRepository documentoModeloRepository;
    private final UsuarioRepository usuarioRepository;
    private final DocumentoModeloMapper documentoModeloMapper;
    private final DocumentoPdfService documentoPdfService;

    public DocumentoModeloApplicationService(
            DocumentoModeloRepository documentoModeloRepository,
            UsuarioRepository usuarioRepository,
            DocumentoModeloMapper documentoModeloMapper,
            DocumentoPdfService documentoPdfService) {
        this.documentoModeloRepository = documentoModeloRepository;
        this.usuarioRepository = usuarioRepository;
        this.documentoModeloMapper = documentoModeloMapper;
        this.documentoPdfService = documentoPdfService;
    }

    @Transactional(readOnly = true)
    public List<DocumentoModeloListItemResponse> listar() {
        return documentoModeloRepository.findAllByOrderByLabelAsc().stream()
                .map(this::toListItem)
                .toList();
    }

    @Transactional(readOnly = true)
    public DocumentoModeloResponse buscar(Long id) {
        return toResponse(buscarEntidade(id));
    }

    @Transactional(readOnly = true)
    public CabecalhoImagem buscarCabecalho(Long id) {
        DocumentoModeloEntity entity = buscarEntidade(id);
        if (entity.getCabecalhoImagem() == null || entity.getCabecalhoImagem().length == 0) {
            throw new ResourceNotFoundException("Modelo sem imagem de cabeçalho: " + id);
        }
        String contentType = StringUtils.hasText(entity.getCabecalhoContentType())
                ? entity.getCabecalhoContentType().trim()
                : "image/jpeg";
        return new CabecalhoImagem(entity.getCabecalhoImagem(), contentType);
    }

    @Transactional
    public DocumentoModeloResponse criar(DocumentoModeloWriteRequest request, MultipartFile cabecalho) {
        if (documentoModeloRepository.existsByUsuarioResponsavelId(request.usuarioResponsavelId())) {
            throw new BusinessRuleException(
                    "Já existe modelo para este responsável (usuarioResponsavelId="
                            + request.usuarioResponsavelId()
                            + "). Use editar.");
        }
        DocumentoModeloEntity entity = new DocumentoModeloEntity();
        entity.setUsuarioResponsavel(resolverUsuario(request.usuarioResponsavelId()));
        aplicarCampos(entity, request);
        if (cabecalho != null && !cabecalho.isEmpty()) {
            aplicarCabecalho(entity, cabecalho);
        }
        return toResponse(documentoModeloRepository.save(entity));
    }

    @Transactional
    public DocumentoModeloResponse atualizar(Long id, DocumentoModeloWriteRequest request, MultipartFile cabecalho) {
        DocumentoModeloEntity entity = buscarEntidade(id);
        if (!entity.getUsuarioResponsavel().getId().equals(request.usuarioResponsavelId())) {
            throw new BusinessRuleException(
                    "Não é permitido alterar o responsável de um modelo existente. Exclua e crie outro.");
        }
        aplicarCampos(entity, request);
        if (Boolean.TRUE.equals(request.removerCabecalho())) {
            entity.setCabecalhoImagem(null);
            entity.setCabecalhoContentType(null);
        } else if (cabecalho != null && !cabecalho.isEmpty()) {
            aplicarCabecalho(entity, cabecalho);
        }
        return toResponse(documentoModeloRepository.save(entity));
    }

    @Transactional
    public void excluir(Long id) {
        DocumentoModeloEntity entity = buscarEntidade(id);
        entity.setAtivo(false);
        documentoModeloRepository.save(entity);
    }

    @Transactional(readOnly = true)
    public byte[] gerarPreviewPdf(DocumentoModeloPreviewRequest request, MultipartFile cabecalho) {
        byte[] cabecalhoBytes = null;
        String cabecalhoContentType = null;

        if (cabecalho != null && !cabecalho.isEmpty()) {
            validarCabecalho(cabecalho);
            try {
                cabecalhoBytes = cabecalho.getBytes();
                cabecalhoContentType = normalizarContentType(cabecalho.getContentType());
            } catch (IOException e) {
                throw new BusinessRuleException("Falha ao ler imagem de cabeçalho: " + e.getMessage());
            }
        } else if (request.modeloId() != null && !Boolean.TRUE.equals(request.removerCabecalho())) {
            DocumentoModeloEntity salvo = buscarEntidade(request.modeloId());
            if (salvo.getCabecalhoImagem() != null && salvo.getCabecalhoImagem().length > 0) {
                cabecalhoBytes = salvo.getCabecalhoImagem();
                cabecalhoContentType = salvo.getCabecalhoContentType();
            }
        }

        TemaDocumento tema = documentoModeloMapper.toTemaDocumento(
                "preview",
                request.advogadoNome(),
                request.advogadoOab(),
                request.rodapeTexto(),
                cabecalhoBytes,
                cabecalhoContentType);
        return documentoPdfService.gerarPeticaoDemonstracaoPdf(tema);
    }

    private DocumentoModeloEntity buscarEntidade(Long id) {
        return documentoModeloRepository
                .findWithUsuarioById(id)
                .orElseThrow(() -> new ResourceNotFoundException("Modelo de documento não encontrado: " + id));
    }

    private UsuarioEntity resolverUsuario(Long usuarioResponsavelId) {
        return usuarioRepository
                .findById(usuarioResponsavelId)
                .orElseThrow(() -> new ResourceNotFoundException("Usuário não encontrado: " + usuarioResponsavelId));
    }

    private void aplicarCampos(DocumentoModeloEntity entity, DocumentoModeloWriteRequest request) {
        entity.setLabel(request.label().trim());
        entity.setAdvogadoNome(request.advogadoNome().trim());
        entity.setAdvogadoOab(request.advogadoOab().trim());
        entity.setRodapeTexto(request.rodapeTexto().trim());
        entity.setAtivo(request.ativo() == null || request.ativo());
    }

    private void aplicarCabecalho(DocumentoModeloEntity entity, MultipartFile cabecalho) {
        validarCabecalho(cabecalho);
        try {
            entity.setCabecalhoImagem(cabecalho.getBytes());
            entity.setCabecalhoContentType(normalizarContentType(cabecalho.getContentType()));
        } catch (IOException e) {
            throw new BusinessRuleException("Falha ao ler imagem de cabeçalho: " + e.getMessage());
        }
    }

    private void validarCabecalho(MultipartFile cabecalho) {
        if (cabecalho.getSize() > MAX_CABECALHO_BYTES) {
            throw new BusinessRuleException("Imagem de cabeçalho excede o limite de 2 MB.");
        }
        String contentType = normalizarContentType(cabecalho.getContentType());
        if (!CONTENT_TYPES_PERMITIDOS.contains(contentType)) {
            throw new BusinessRuleException("Imagem de cabeçalho deve ser JPEG ou PNG.");
        }
    }

    private static String normalizarContentType(String contentType) {
        if (!StringUtils.hasText(contentType)) {
            return "image/jpeg";
        }
        return contentType.trim().toLowerCase(Locale.ROOT);
    }

    private DocumentoModeloListItemResponse toListItem(DocumentoModeloEntity entity) {
        UsuarioEntity u = entity.getUsuarioResponsavel();
        return new DocumentoModeloListItemResponse(
                entity.getId(),
                entity.getLabel(),
                u != null ? u.getId() : null,
                u != null ? u.getNome() : null,
                u != null ? u.getLogin() : null,
                entity.getAdvogadoNome(),
                entity.getAdvogadoOab(),
                entity.getCabecalhoImagem() != null && entity.getCabecalhoImagem().length > 0,
                Boolean.TRUE.equals(entity.getAtivo()),
                entity.getAtualizadoEm());
    }

    private DocumentoModeloResponse toResponse(DocumentoModeloEntity entity) {
        UsuarioEntity u = entity.getUsuarioResponsavel();
        return new DocumentoModeloResponse(
                entity.getId(),
                entity.getLabel(),
                u != null ? u.getId() : null,
                u != null ? u.getNome() : null,
                u != null ? u.getLogin() : null,
                entity.getAdvogadoNome(),
                entity.getAdvogadoOab(),
                entity.getRodapeTexto(),
                entity.getCabecalhoImagem() != null && entity.getCabecalhoImagem().length > 0,
                entity.getCabecalhoContentType(),
                Boolean.TRUE.equals(entity.getAtivo()),
                entity.getCriadoEm(),
                entity.getAtualizadoEm());
    }

    public record CabecalhoImagem(byte[] bytes, String contentType) {}
}
