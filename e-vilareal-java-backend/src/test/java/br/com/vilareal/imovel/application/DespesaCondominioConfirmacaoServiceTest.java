package br.com.vilareal.imovel.application;

import br.com.vilareal.financeiro.domain.ConfiancaSugestao;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse.GrupoDespesaCondominio;
import br.com.vilareal.imovel.api.dto.DespesaCondominioCandidatosResponse.SerieExtratoItem;
import br.com.vilareal.imovel.domain.ResponsavelPagamentoCondominio;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pagamento.infrastructure.persistence.entity.PagamentoRecorrenciaConfigEntity;
import br.com.vilareal.pagamento.infrastructure.persistence.repository.PagamentoRecorrenciaConfigRepository;
import br.com.vilareal.usuario.infrastructure.persistence.entity.UsuarioEntity;
import br.com.vilareal.usuario.infrastructure.persistence.repository.UsuarioRepository;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;

import java.math.BigDecimal;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class DespesaCondominioConfirmacaoServiceTest {

    @Mock
    private DespesaCondominioCandidatoService candidatoService;
    @Mock
    private ImovelRepository imovelRepository;
    @Mock
    private PagamentoRecorrenciaConfigRepository recorrenciaConfigRepository;
    @Mock
    private UsuarioRepository usuarioRepository;

    @InjectMocks
    private DespesaCondominioConfirmacaoService service;

    @AfterEach
    void limparSecurity() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void confirmarCriaFlagERecorrencia() {
        SecurityContextHolder.getContext()
                .setAuthentication(new UsernamePasswordAuthenticationToken(
                        "itamar", "x", List.of(new SimpleGrantedAuthority("ROLE_USER"))));
        when(usuarioRepository.findWithPerfilByLoginIgnoreCase("itamar"))
                .thenReturn(Optional.of(new UsuarioEntity()));

        GrupoDespesaCondominio grupo = grupoAlta(new BigDecimal("780.00"));
        when(candidatoService.buscarGrupoPorObrigacaoChave("imovel:71")).thenReturn(Optional.of(grupo));

        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(71L);
        imovel.setAtivo(true);
        imovel.setNumeroPlanilha(41);
        imovel.setUnidade("101");
        imovel.setCondominio("Executive Privé");
        when(imovelRepository.findById(71L)).thenReturn(Optional.of(imovel));
        when(recorrenciaConfigRepository.findFirstByImovel_IdAndCategoriaAndAtivoTrue(71L, "CONDOMINIO"))
                .thenReturn(Optional.empty());
        when(recorrenciaConfigRepository.save(any())).thenAnswer(inv -> {
            PagamentoRecorrenciaConfigEntity e = inv.getArgument(0);
            e.setId(99L);
            return e;
        });

        var resp = service.confirmarDespesaCondominio("imovel:71", 71L);

        assertThat(resp.recorrenciaCriadaAgora()).isTrue();
        assertThat(resp.valorEstimado()).isEqualByComparingTo("780.00");

        ArgumentCaptor<PagamentoRecorrenciaConfigEntity> cap = ArgumentCaptor.forClass(PagamentoRecorrenciaConfigEntity.class);
        verify(recorrenciaConfigRepository).save(cap.capture());
        assertThat(cap.getValue().getValorEstimado()).isEqualByComparingTo("780.00");
    }

    @Test
    void confirmarDuasVezesNaoDuplicaConfig() {
        GrupoDespesaCondominio grupo = grupoAlta(new BigDecimal("780.00"));
        when(candidatoService.buscarGrupoPorObrigacaoChave("imovel:71")).thenReturn(Optional.of(grupo));

        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(71L);
        imovel.setAtivo(true);
        imovel.setResponsavelPagamentoCondominio(ResponsavelPagamentoCondominio.ESCRITORIO);
        when(imovelRepository.findById(71L)).thenReturn(Optional.of(imovel));

        PagamentoRecorrenciaConfigEntity existente = new PagamentoRecorrenciaConfigEntity();
        existente.setId(5L);
        existente.setDescricaoPadrao("Condomínio");
        existente.setDiaVencimento(10);
        existente.setValorEstimado(new BigDecimal("780.00"));
        when(recorrenciaConfigRepository.findFirstByImovel_IdAndCategoriaAndAtivoTrue(71L, "CONDOMINIO"))
                .thenReturn(Optional.of(existente));
        when(recorrenciaConfigRepository.save(existente)).thenReturn(existente);

        var resp = service.confirmarDespesaCondominio("imovel:71", 71L);

        assertThat(resp.idempotente()).isTrue();
        assertThat(resp.valorEstimado()).isEqualByComparingTo("780.00");
        verify(recorrenciaConfigRepository).save(existente);
    }

    private static GrupoDespesaCondominio grupoAlta(BigDecimal valor) {
        return new GrupoDespesaCondominio(
                "imovel:71",
                "Executive Privé",
                List.of("GRAFIA A", "GRAFIA B"),
                "Condominio Executive",
                valor,
                10,
                4,
                List.of("2026-05"),
                List.of(new SerieExtratoItem("2026-05", valor, "GRAFIA B")),
                true,
                ConfiancaSugestao.ALTA,
                71L,
                41,
                "#41",
                List.of(),
                false);
    }
}
