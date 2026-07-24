package br.com.vilareal.configuracao.application;

import br.com.vilareal.configuracao.api.dto.UsuarioMenuItemDto;
import br.com.vilareal.configuracao.api.dto.UsuarioMenuPreferenciaRequest;
import br.com.vilareal.configuracao.api.dto.UsuarioMenuPreferenciaResponse;
import br.com.vilareal.configuracao.infrastructure.persistence.entity.UsuarioMenuItemEntity;
import br.com.vilareal.configuracao.infrastructure.persistence.repository.UsuarioMenuItemRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.http.HttpStatus;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
public class UsuarioMenuPreferenciaService {

    private static final String MODULO_SEMPRE_VISIVEL = "configuracoes";
    private static final int MODULO_ID_MAX = 80;

    private final UsuarioMenuItemRepository menuItemRepository;
    private final UsuarioRepository usuarioRepository;

    public UsuarioMenuPreferenciaService(
            UsuarioMenuItemRepository menuItemRepository, UsuarioRepository usuarioRepository) {
        this.menuItemRepository = menuItemRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional(readOnly = true)
    public UsuarioMenuPreferenciaResponse obterDoUsuarioAtual() {
        UsuarioEntity atual = resolverUsuarioAutenticado();
        return montarResposta(atual.getId());
    }

    @Transactional
    public UsuarioMenuPreferenciaResponse salvarDoUsuarioAtual(UsuarioMenuPreferenciaRequest request) {
        UsuarioEntity atual = resolverUsuarioAutenticado();
        return substituirItens(atual.getId(), request);
    }

    @Transactional(readOnly = true)
    public UsuarioMenuPreferenciaResponse obterDeUsuario(String usuarioRef) {
        UsuarioEntity alvo = resolverUsuarioAlvo(usuarioRef);
        return montarResposta(alvo.getId());
    }

    @Transactional
    public UsuarioMenuPreferenciaResponse salvarDeUsuario(String usuarioRef, UsuarioMenuPreferenciaRequest request) {
        UsuarioEntity alvo = resolverUsuarioAlvo(usuarioRef);
        return substituirItens(alvo.getId(), request);
    }

    private UsuarioMenuPreferenciaResponse montarResposta(Long usuarioId) {
        List<UsuarioMenuItemDto> itens = menuItemRepository.findByUsuarioIdOrderByOrdemAscModuloIdAsc(usuarioId)
                .stream()
                .map(e -> new UsuarioMenuItemDto(e.getModuloId(), Boolean.TRUE.equals(e.getVisivel()), e.getOrdem()))
                .toList();
        return new UsuarioMenuPreferenciaResponse(usuarioId, itens);
    }

    private UsuarioMenuPreferenciaResponse substituirItens(Long usuarioId, UsuarioMenuPreferenciaRequest request) {
        List<UsuarioMenuItemDto> entrada = request != null && request.itens() != null ? request.itens() : List.of();
        List<UsuarioMenuItemEntity> entidades = new ArrayList<>();
        Set<String> vistos = new HashSet<>();
        int fallbackOrdem = 0;
        boolean temConfiguracoes = false;

        for (UsuarioMenuItemDto dto : entrada) {
            if (dto == null || !StringUtils.hasText(dto.moduloId())) {
                continue;
            }
            String moduloId = dto.moduloId().trim();
            if (moduloId.length() > MODULO_ID_MAX) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "moduloId excede " + MODULO_ID_MAX + " caracteres.");
            }
            if (!vistos.add(moduloId)) {
                continue;
            }
            boolean visivel = dto.visivel() == null || Boolean.TRUE.equals(dto.visivel());
            if (MODULO_SEMPRE_VISIVEL.equals(moduloId)) {
                visivel = true;
                temConfiguracoes = true;
            }
            int ordem = dto.ordem() != null ? dto.ordem() : fallbackOrdem;
            fallbackOrdem = Math.max(fallbackOrdem, ordem + 1);

            UsuarioMenuItemEntity e = new UsuarioMenuItemEntity();
            e.setUsuarioId(usuarioId);
            e.setModuloId(moduloId);
            e.setVisivel(visivel);
            e.setOrdem(ordem);
            entidades.add(e);
        }

        if (!temConfiguracoes) {
            UsuarioMenuItemEntity cfg = new UsuarioMenuItemEntity();
            cfg.setUsuarioId(usuarioId);
            cfg.setModuloId(MODULO_SEMPRE_VISIVEL);
            cfg.setVisivel(true);
            cfg.setOrdem(fallbackOrdem);
            entidades.add(cfg);
        }

        if (entidades.stream().noneMatch(e -> Boolean.TRUE.equals(e.getVisivel()))) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Marque pelo menos um item do menu.");
        }

        menuItemRepository.deleteByUsuarioId(usuarioId);
        menuItemRepository.flush();
        menuItemRepository.saveAll(entidades);
        return montarResposta(usuarioId);
    }

    private UsuarioEntity resolverUsuarioAutenticado() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !StringUtils.hasText(auth.getName())) {
            throw new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não autenticado.");
        }
        return usuarioRepository
                .findWithPerfilByLoginIgnoreCase(auth.getName().trim())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.UNAUTHORIZED, "Usuário não autenticado."));
    }

    private UsuarioEntity resolverUsuarioAlvo(String usuarioRef) {
        if (!StringUtils.hasText(usuarioRef)) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Usuário inválido.");
        }
        String ref = usuarioRef.trim();
        if (ref.chars().allMatch(Character::isDigit)) {
            Long id = Long.parseLong(ref);
            return usuarioRepository
                    .findWithPerfilById(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
        }
        return usuarioRepository
                .findWithPerfilByLoginIgnoreCase(ref.toLowerCase(Locale.ROOT))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Usuário não encontrado."));
    }
}
