package br.com.vilareal.email;

import com.google.api.services.gmail.Gmail;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.context.ApplicationContext;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class GmailApiProviderTest {

    @Mock
    private ApplicationContext applicationContext;

    @Test
    void resolver_semBean_retornaVazio() {
        when(applicationContext.containsBean(GmailApiProvider.BEAN_NAME)).thenReturn(false);
        GmailApiProvider provider = new GmailApiProvider(applicationContext);

        assertThat(provider.isDisponivel()).isFalse();
        assertThat(provider.resolver()).isEmpty();
    }

    @Test
    void resolver_comBean_registrado_retornaInstancia() {
        Gmail gmail = mock(Gmail.class);
        when(applicationContext.containsBean(GmailApiProvider.BEAN_NAME)).thenReturn(true);
        when(applicationContext.getBean(GmailApiProvider.BEAN_NAME, Gmail.class)).thenReturn(gmail);

        GmailApiProvider provider = new GmailApiProvider(applicationContext);

        assertThat(provider.isDisponivel()).isTrue();
        assertThat(provider.resolver()).containsSame(gmail);
    }
}
