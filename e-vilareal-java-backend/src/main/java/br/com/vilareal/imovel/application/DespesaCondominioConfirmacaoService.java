package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse.GrupoDespesaCondominio;
import br.com.vilareal.imovel.api.dto.DespesaCondominioConfirmarResponse;
import br.com.vilareal.imovel.domain.ResponsavelPagamentoCondominio;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoRecorrenciaConfigEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRecorrenciaConfigRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.Locale;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
public class DespesaCondominioConfirmacaoService {

    private static final String CATEGORIA_CONDOMINIO = "CONDOMINIO";
    private static final String FORMA_PAGAMENTO_PADRAO = "BOLETO";

    private final DespesaCondominioCandidatoService candidatoService;
    private final ImovelRepository imovelRepository;
    private final PagamentoRecorrenciaConfigRepository recorrenciaConfigRepository;
    private final UsuarioRepository usuarioRepository;

    public DespesaCondominioConfirmacaoService(
            DespesaCondominioCandidatoService candidatoService,
            ImovelRepository imovelRepository,
            PagamentoRecorrenciaConfigRepository recorrenciaConfigRepository,
            UsuarioRepository usuarioRepository) {
        this.candidatoService = candidatoService;
        this.imovelRepository = imovelRepository;
        this.recorrenciaConfigRepository = recorrenciaConfigRepository;
        this.usuarioRepository = usuarioRepository;
    }

    @Transactional
    public DespesaCondominioConfirmarResponse confirmarDespesaCondominio(String obrigacaoChave, Long imovelId) {
        if (!StringUtils.hasText(obrigacaoChave)) {
            throw new BusinessRuleException("Informe a obrigação detectada (obrigacaoChave).");
        }
        String chave = obrigacaoChave.trim();

        GrupoDespesaCondominio grupo = candidatoService
                .buscarGrupoPorObrigacaoChave(chave)
                .orElseThrow(() -> new ResourceNotFoundException("Obrigação de condomínio não encontrada no extrato."));

        ImovelEntity imovel = imovelRepository
                .findById(imovelId)
                .orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado."));
        if (!Boolean.TRUE.equals(imovel.getAtivo())) {
            throw new BusinessRuleException("Imóvel inativo.");
        }
        validarImovelNoGrupo(grupo, imovelId);

        Optional<PagamentoRecorrenciaConfigEntity> existente =
                recorrenciaConfigRepository.findFirstByImovel_IdAndCategoriaAndAtivoTrue(imovelId, CATEGORIA_CONDOMINIO);

        if (ResponsavelPagamentoCondominio.ESCRITORIO.equals(imovel.getResponsavelPagamentoCondominio())
                && existente.isPresent()) {
            PagamentoRecorrenciaConfigEntity cfg = sincronizarConfig(existente.get(), grupo, imovel);
            return resposta(imovel, cfg, false, true);
        }

        imovel.setResponsavelPagamentoCondominio(ResponsavelPagamentoCondominio.ESCRITORIO);
        imovelRepository.save(imovel);

        if (existente.isPresent()) {
            PagamentoRecorrenciaConfigEntity cfg = sincronizarConfig(existente.get(), grupo, imovel);
            return resposta(imovel, cfg, false, true);
        }

        PagamentoRecorrenciaConfigEntity cfg = new PagamentoRecorrenciaConfigEntity();
        cfg.setImovel(imovel);
        if (imovel.getCliente() != null) {
            cfg.setCliente(imovel.getCliente());
        }
        cfg.setCategoria(CATEGORIA_CONDOMINIO);
        cfg.setDescricaoPadrao(montarDescricaoPadrao(grupo, imovel));
        cfg.setDiaVencimento(diaVencimentoEfetivo(grupo.diaTipico()));
        cfg.setValorEstimado(grupo.valorEstimado());
        cfg.setFormaPagamento(FORMA_PAGAMENTO_PADRAO);
        cfg.setPrioridade("NORMAL");
        cfg.setAtivo(true);
        cfg.setGrafiasExtratoJson(DespesaCondominioGrafiasUtil.serializarGrafias(grupo.grafias()));
        cfg.setCriadoPorUsuario(usuarioAtual());
        cfg = recorrenciaConfigRepository.save(cfg);

        return resposta(imovel, cfg, true, false);
    }

    private static void validarImovelNoGrupo(GrupoDespesaCondominio grupo, Long imovelId) {
        if (grupo.confianca() == ConfiancaSugestao.BAIXA) {
            throw new BusinessRuleException("Obrigação sem imóvel identificado — confirmação manual ainda não disponível.");
        }
        if (Objects.equals(grupo.imovelSugeridoId(), imovelId)) {
            return;
        }
        boolean candidato = grupo.unidadesCandidatas().stream().anyMatch(u -> Objects.equals(u.imovelId(), imovelId));
        if (!candidato) {
            throw new BusinessRuleException("Imóvel não pertence à obrigação detectada.");
        }
    }

    private PagamentoRecorrenciaConfigEntity sincronizarConfig(
            PagamentoRecorrenciaConfigEntity cfg, GrupoDespesaCondominio grupo, ImovelEntity imovel) {
        cfg.setValorEstimado(grupo.valorEstimado());
        cfg.setDiaVencimento(diaVencimentoEfetivo(grupo.diaTipico()));
        cfg.setDescricaoPadrao(montarDescricaoPadrao(grupo, imovel));
        List<String> grafias = DespesaCondominioGrafiasUtil.mesclarGrafias(
                DespesaCondominioGrafiasUtil.deserializarGrafias(cfg.getGrafiasExtratoJson()), grupo.grafias());
        cfg.setGrafiasExtratoJson(DespesaCondominioGrafiasUtil.serializarGrafias(grafias));
        return recorrenciaConfigRepository.save(cfg);
    }

    static String montarDescricaoPadrao(GrupoDespesaCondominio grupo, ImovelEntity imovel) {
        String base = StringUtils.hasText(grupo.condominioNome())
                ? grupo.condominioNome().trim()
                : StringUtils.hasText(grupo.descricaoExemplo()) ? grupo.descricaoExemplo().trim() : "Condomínio";
        if (!base.toLowerCase(Locale.ROOT).startsWith("condom")) {
            base = "Condomínio " + base;
        }
        if (StringUtils.hasText(imovel.getUnidade())) {
            base = base + " — " + imovel.getUnidade().trim();
        }
        return base.length() > 500 ? base.substring(0, 500) : base;
    }

    static int diaVencimentoEfetivo(int diaTipico) {
        if (diaTipico >= 1 && diaTipico <= 31) {
            return diaTipico;
        }
        return 10;
    }

    private DespesaCondominioConfirmarResponse resposta(
            ImovelEntity imovel, PagamentoRecorrenciaConfigEntity cfg, boolean criadaAgora, boolean idempotente) {
        return new DespesaCondominioConfirmarResponse(
                imovel.getId(),
                imovel.getNumeroPlanilha(),
                ResponsavelPagamentoCondominio.ESCRITORIO.name(),
                cfg.getId(),
                criadaAgora,
                idempotente,
                cfg.getValorEstimado(),
                cfg.getDiaVencimento(),
                cfg.getDescricaoPadrao());
    }

    private UsuarioEntity usuarioAtual() {
        Authentication a = SecurityContextHolder.getContext().getAuthentication();
        if (a == null || !a.isAuthenticated()) {
            throw new BusinessRuleException("Usuário não autenticado.");
        }
        return usuarioRepository
                .findWithPerfilByLoginIgnoreCase(a.getName())
                .orElseThrow(() -> new BusinessRuleException("Usuário não encontrado."));
    }
}
