package br.com.vilareal.documento.importacao.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.documento.ContratoHonorariosWhatsAppCobrancaConfig;
import br.com.vilareal.documento.importacao.api.dto.ContratoHonorariosArmarCobrancaRequest;
import br.com.vilareal.documento.importacao.infrastructure.persistence.entity.ContratoHonorariosCobrancaArmadaEntity;
import br.com.vilareal.documento.importacao.infrastructure.persistence.repository.ContratoHonorariosCobrancaArmadaRepository;
import br.com.vilareal.documento.infrastructure.persistence.entity.ContratoHonorariosEntity;
import br.com.vilareal.documento.infrastructure.persistence.repository.ContratoHonorariosRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.Clock;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Service
public class ContratoHonorariosCobrancaGateService {

    private final ContratoHonorariosRepository contratoRepository;
    private final ContratoHonorariosCobrancaArmadaRepository armadaRepository;
    private final UsuarioRepository usuarioRepository;
    private final Clock clock;

    public ContratoHonorariosCobrancaGateService(
            ContratoHonorariosRepository contratoRepository,
            ContratoHonorariosCobrancaArmadaRepository armadaRepository,
            UsuarioRepository usuarioRepository,
            Clock clock) {
        this.contratoRepository = contratoRepository;
        this.armadaRepository = armadaRepository;
        this.usuarioRepository = usuarioRepository;
        this.clock = clock;
    }

    @Transactional
    public List<Long> armar(ContratoHonorariosArmarCobrancaRequest req) {
        if (req == null || req.contratoHonorariosIds() == null || req.contratoHonorariosIds().isEmpty()) {
            throw new BusinessRuleException("Informe ao menos um contrato.");
        }
        UsuarioEntity usuario = usuarioAtualOrNull();
        if (usuario == null) {
            throw new BusinessRuleException("Usuário não autenticado.");
        }
        String horario = StringUtils.hasText(req.whatsappHorario()) ? req.whatsappHorario().trim() : "09:00";
        String antecedencia =
                StringUtils.hasText(req.whatsappAntecedencia()) ? req.whatsappAntecedencia().trim() : "VENCIMENTO_DIA";
        List<Long> armados = new ArrayList<>();
        for (Long cid : req.contratoHonorariosIds()) {
            ContratoHonorariosEntity c = contratoRepository
                    .findById(cid)
                    .orElseThrow(() -> new BusinessRuleException("Contrato não encontrado: " + cid));
            c.setWhatsappCobrancaAtivo(true);
            c.setWhatsappCobrancaHorario(horario);
            c.setWhatsappCobrancaAntecedencia(antecedencia);
            contratoRepository.save(c);
            ContratoHonorariosCobrancaArmadaEntity arm = armadaRepository
                    .findByContratoHonorarios_Id(cid)
                    .orElseGet(ContratoHonorariosCobrancaArmadaEntity::new);
            arm.setContratoHonorarios(c);
            arm.setArmadoPorUsuario(usuario);
            arm.setArmadoEm(Instant.now(clock));
            armadaRepository.save(arm);
            armados.add(cid);
        }
        return armados;
    }

    @Transactional
    public void desarmar(List<Long> contratoHonorariosIds) {
        if (contratoHonorariosIds == null) {
            return;
        }
        for (Long cid : contratoHonorariosIds) {
            contratoRepository.findById(cid).ifPresent(c -> {
                c.setWhatsappCobrancaAtivo(false);
                contratoRepository.save(c);
            });
            armadaRepository.findByContratoHonorarios_Id(cid).ifPresent(armadaRepository::delete);
        }
    }

    private UsuarioEntity usuarioAtualOrNull() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated() || "anonymousUser".equals(a.getPrincipal())) {
            return null;
        }
        String login = a.getName();
        return usuarioRepository.findWithPerfilByLoginIgnoreCase(login).orElse(null);
    }
}
