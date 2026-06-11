package br.com.vilareal.totp.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.totp.domain.TotpAlgoritmo;
import br.com.vilareal.totp.domain.TribunalIntegracao;
import br.com.vilareal.totp.infrastructure.persistence.entity.CredencialTotpEntity;
import br.com.vilareal.totp.infrastructure.persistence.repository.CredencialTotpRepository;
import br.com.vilareal.totp.security.SegredoCipherService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Base64;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class CredencialTotpServiceSenhaTest {

    private static final String CHAVE_TESTE =
            Base64.getEncoder().encodeToString(new byte[32]);

    @Mock
    private CredencialTotpRepository repository;

    private SegredoCipherService cipherService;
    private CredencialTotpService service;

    @BeforeEach
    void setUp() {
        cipherService = new SegredoCipherService(CHAVE_TESTE, "");
        ReflectionTestUtils.invokeMethod(cipherService, "inicializar");
        service = new CredencialTotpService(repository, cipherService);
    }

    @Test
    void roundTripSenhaPrimeiroFator() {
        String senhaClara = "SenhaPje#2026";
        CredencialTotpEntity entity = new CredencialTotpEntity();
        entity.setTribunal(TribunalIntegracao.PJE_TRT18);
        entity.setLogin("12345678901");
        entity.setAtivo(true);
        entity.setSenhaCriptografada(cipherService.cifrar(senhaClara));

        when(repository.findByTribunalAndLoginAndAtivoTrue(TribunalIntegracao.PJE_TRT18, "12345678901"))
                .thenReturn(Optional.of(entity));

        assertThat(service.obterSenhaPrimeiroFator(TribunalIntegracao.PJE_TRT18, "12345678901"))
                .contains(senhaClara);
    }

    @Test
    void cadastroPersisteSenhaCifradaSemAlterarSecret() {
        when(repository.findByTribunalAndLogin(any(), any())).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CredencialTotpEntity salva = service.cadastrarOuAtualizar(
                TribunalIntegracao.PJE_TRT18,
                "00733235190",
                "JBSWY3DPEHPK3PXP",
                "minha-senha-pje",
                true);

        assertThat(salva.getSenhaCriptografada()).isNotBlank();
        assertThat(salva.getSenhaCriptografada()).isNotEqualTo("minha-senha-pje");
        assertThat(cipherService.decifrar(salva.getSenhaCriptografada())).isEqualTo("minha-senha-pje");
        verify(repository).save(any());
    }

    @Test
    void definirSenhaPrimeiroFator_atualizaSomenteSenha() {
        String secretOriginal = cipherService.cifrar("JBSWY3DPEHPK3PXP");
        CredencialTotpEntity entity = new CredencialTotpEntity();
        entity.setId(42L);
        entity.setTribunal(TribunalIntegracao.PJE_TRT18);
        entity.setLogin("00733235190");
        entity.setSecretCriptografado(secretOriginal);
        entity.setAlgoritmo(TotpAlgoritmo.SHA1);
        entity.setDigitos(6);
        entity.setPeriodoSegundos(30);
        entity.setAtivo(true);

        when(repository.findById(42L)).thenReturn(Optional.of(entity));
        when(repository.save(any())).thenAnswer(inv -> inv.getArgument(0));

        CredencialTotpEntity salva = service.definirSenhaPrimeiroFator(42L, "nova-senha-pje");

        assertThat(salva.getSecretCriptografado()).isEqualTo(secretOriginal);
        assertThat(cipherService.decifrar(salva.getSenhaCriptografada())).isEqualTo("nova-senha-pje");
        verify(repository).save(entity);
    }

    @Test
    void definirSenhaPrimeiroFator_idInexistente_404() {
        when(repository.findById(99L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.definirSenhaPrimeiroFator(99L, "x"))
                .isInstanceOf(ResourceNotFoundException.class)
                .hasMessageContaining("Credencial TOTP não encontrada: 99");
    }

    @Test
    void definirSenhaPrimeiroFator_senhaVazia_400() {
        assertThatThrownBy(() -> service.definirSenhaPrimeiroFator(1L, "  "))
                .isInstanceOf(BusinessRuleException.class)
                .hasMessageContaining("Senha do 1º fator é obrigatória");
    }
}
