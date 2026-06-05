package br.com.vilareal.notificacao.application;

import br.com.vilareal.notificacao.api.dto.DestinatariosCanaisDto;
import br.com.vilareal.notificacao.domain.CanalNotificacao;
import br.com.vilareal.notificacao.infrastructure.persistence.entity.NotificacaoDestinatarioEntity;
import br.com.vilareal.notificacao.infrastructure.persistence.repository.NotificacaoDestinatarioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Set;

@Service
public class NotificacaoDestinatarioService {

    private final NotificacaoDestinatarioRepository notificacaoDestinatarioRepository;

    public NotificacaoDestinatarioService(NotificacaoDestinatarioRepository notificacaoDestinatarioRepository) {
        this.notificacaoDestinatarioRepository = notificacaoDestinatarioRepository;
    }

    /**
     * Resolve destinatários efetivos por canal: união dos padrões globais com os adicionais do processo,
     * deduplicados (ordem: padrão primeiro, depois adicionais).
     */
    @Transactional(readOnly = true)
    public DestinatariosCanaisDto resolver(Long processoId) {
        List<NotificacaoDestinatarioEntity> padrao =
                notificacaoDestinatarioRepository.findByProcessoIdIsNullAndAtivoTrue();
        if (processoId == null) {
            return agruparPorCanal(padrao);
        }

        List<NotificacaoDestinatarioEntity> adicionais =
                notificacaoDestinatarioRepository.findByProcessoIdAndAtivoTrue(processoId);
        return new DestinatariosCanaisDto(
                unirCanal(padrao, adicionais, CanalNotificacao.WHATSAPP),
                unirCanal(padrao, adicionais, CanalNotificacao.EMAIL));
    }

    static List<String> unirCanal(
            List<NotificacaoDestinatarioEntity> padrao,
            List<NotificacaoDestinatarioEntity> adicionais,
            CanalNotificacao canal) {
        Set<String> vistos = new LinkedHashSet<>();
        for (String valor : valoresCanal(padrao, canal)) {
            vistos.add(valor);
        }
        for (String valor : valoresCanal(adicionais, canal)) {
            vistos.add(valor);
        }
        return List.copyOf(vistos);
    }

    @Transactional(readOnly = true)
    public boolean processoTemOverride(Long processoId) {
        return notificacaoDestinatarioRepository.existsByProcessoId(processoId);
    }

    @Transactional(readOnly = true)
    public DestinatariosCanaisDto listarOverrideAtivo(Long processoId) {
        return agruparPorCanal(notificacaoDestinatarioRepository.findByProcessoIdAndAtivoTrue(processoId));
    }

    @Transactional(readOnly = true)
    public DestinatariosCanaisDto listarPadrao() {
        return agruparPorCanal(notificacaoDestinatarioRepository.findByProcessoIdIsNullAndAtivoTrue());
    }

    static DestinatariosCanaisDto agruparPorCanal(List<NotificacaoDestinatarioEntity> linhas) {
        return new DestinatariosCanaisDto(
                valoresCanal(linhas, CanalNotificacao.WHATSAPP),
                valoresCanal(linhas, CanalNotificacao.EMAIL));
    }

    static List<String> valoresCanal(List<NotificacaoDestinatarioEntity> linhas, CanalNotificacao canal) {
        return linhas.stream()
                .filter(e -> e.getCanal() == canal)
                .sorted(Comparator.comparing(NotificacaoDestinatarioEntity::getId))
                .map(NotificacaoDestinatarioEntity::getValor)
                .toList();
    }

    static List<NotificacaoDestinatarioEntity> montarEntidades(
            List<String> whatsapp,
            List<String> email,
            br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity processo) {
        List<NotificacaoDestinatarioEntity> entidades = new ArrayList<>();
        if (whatsapp != null) {
            for (String numero : whatsapp) {
                if (numero == null || numero.isBlank()) {
                    continue;
                }
                NotificacaoDestinatarioEntity e = new NotificacaoDestinatarioEntity();
                e.setProcesso(processo);
                e.setCanal(CanalNotificacao.WHATSAPP);
                e.setValor(NotificacaoDestinatarioValorValidator.normalizarWhatsapp(numero));
                e.setAtivo(true);
                entidades.add(e);
            }
        }
        if (email != null) {
            for (String endereco : email) {
                if (endereco == null || endereco.isBlank()) {
                    continue;
                }
                NotificacaoDestinatarioEntity e = new NotificacaoDestinatarioEntity();
                e.setProcesso(processo);
                e.setCanal(CanalNotificacao.EMAIL);
                e.setValor(NotificacaoDestinatarioValorValidator.normalizarEmail(endereco));
                e.setAtivo(true);
                entidades.add(e);
            }
        }
        return entidades;
    }
}
