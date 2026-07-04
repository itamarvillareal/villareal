package br.com.vilareal.whatsapp.service;

import br.com.vilareal.pessoa.infrastructure.persistence.projection.PessoaTelefoneIndiceBatchRow;
import br.com.vilareal.pessoa.infrastructure.persistence.repository.PessoaRepository;
import br.com.vilareal.whatsapp.config.WhatsAppNomeExibicaoCacheConfig;
import com.github.benmanes.caffeine.cache.Caffeine;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class WhatsAppNomeExibicaoServiceTest {

    private static final String PHONE_JULIANO = "5562983452868";

    @Mock
    private PessoaRepository pessoaRepository;

    private WhatsAppNomeExibicaoService service;

    @BeforeEach
    void setUp() {
        var cache = Caffeine.newBuilder()
                .expireAfterWrite(WhatsAppNomeExibicaoCacheConfig.CACHE_TTL)
                .maximumSize(100)
                .<String, Optional<String>>build();
        service = new WhatsAppNomeExibicaoService(pessoaRepository, cache);
    }

    @Test
    void resolverNomesPorTelefone_casoJuliano7007_porSufixo8() {
        when(pessoaRepository.findTelefoneIndiceBatch(anyList(), anyList()))
                .thenReturn(List.of(rowJuliano()));

        Map<String, String> map = service.resolverNomesPorTelefone(List.of(PHONE_JULIANO));

        assertThat(map).containsEntry(PHONE_JULIANO, "JULIANO CESAR MENDONÇA");
    }

    @Test
    void resolverNomeExibido_cadastroTemPrioridadeSobreMeta() {
        when(pessoaRepository.findTelefoneIndiceBatch(anyList(), anyList()))
                .thenReturn(List.of(rowJuliano()));

        String nome = service.resolverNomeExibido(PHONE_JULIANO, "Nome WhatsApp");

        assertThat(nome).isEqualTo("JULIANO CESAR MENDONÇA");
    }

    @Test
    void resolverNomeExibido_usaMetaQuandoSemCadastro() {
        when(pessoaRepository.findTelefoneIndiceBatch(anyList(), anyList())).thenReturn(List.of());

        String nome = service.resolverNomeExibido("5562999999999", "Contato Meta");

        assertThat(nome).isEqualTo("Contato Meta");
    }

    @Test
    void resolverNomeExibido_ignoraMetaPlaceholder() {
        when(pessoaRepository.findTelefoneIndiceBatch(anyList(), anyList())).thenReturn(List.of());

        assertThat(service.resolverNomeExibido(PHONE_JULIANO, ".")).isNull();
        assertThat(service.resolverNomeExibido(PHONE_JULIANO, null)).isNull();
    }

    private static PessoaTelefoneIndiceBatchRow rowJuliano() {
        return new PessoaTelefoneIndiceBatchRow() {
            @Override
            public Long getPessoaId() {
                return 7007L;
            }

            @Override
            public String getNome() {
                return "JULIANO CESAR MENDONÇA";
            }

            @Override
            public String getTelefoneDigitos() {
                return "62984352818";
            }

            @Override
            public String getTelefoneSufixo8() {
                return "84352818";
            }

            @Override
            public String getContatoDigitos() {
                return "6283452868";
            }

            @Override
            public String getContatoSufixo8() {
                return "83452868";
            }
        };
    }
}
