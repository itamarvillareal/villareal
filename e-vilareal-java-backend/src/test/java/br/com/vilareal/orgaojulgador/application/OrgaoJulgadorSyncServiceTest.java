package br.com.vilareal.orgaojulgador.application;

import br.com.vilareal.datajud.DatajudProxyService;
import br.com.vilareal.localidade.infrastructure.persistence.entity.EstadoEntity;
import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import br.com.vilareal.localidade.infrastructure.persistence.repository.MunicipioRepository;
import br.com.vilareal.orgaojulgador.api.dto.OrgaoJulgadorSyncResponse;
import br.com.vilareal.orgaojulgador.domain.OrgaoJulgadorTipo;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.OrgaoJulgadorEntity;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.TribunalEntity;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.repository.OrgaoJulgadorRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.core.io.ClassPathResource;

import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.atLeastOnce;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class OrgaoJulgadorSyncServiceTest {

    @Mock
    private DatajudProxyService datajudProxyService;
    @Mock
    private TribunalApplicationService tribunalApplicationService;
    @Mock
    private OrgaoJulgadorRepository orgaoJulgadorRepository;
    @Mock
    private MunicipioRepository municipioRepository;
    @Mock
    private HttpResponse<byte[]> httpResponse;

    private OrgaoJulgadorSyncService service;

    @BeforeEach
    void setUp() {
        service = new OrgaoJulgadorSyncService(
                datajudProxyService, tribunalApplicationService, orgaoJulgadorRepository, municipioRepository);
    }

    @Test
    void sincronizar_idempotenteComJsonMockado() throws Exception {
        TribunalEntity tribunal = tribunalAtivo();
        byte[] payload = new ClassPathResource("seeds/orgaos-julgadores-tjgo.json")
                .getInputStream()
                .readAllBytes();

        when(tribunalApplicationService.carregar(9)).thenReturn(tribunal);
        when(datajudProxyService.proxySearch(eq("api_publica_tjgo"), any())).thenReturn(httpResponse);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(payload);
        when(orgaoJulgadorRepository.countByTribunal_IdAndAtivoTrue(9)).thenReturn(0L);
        when(orgaoJulgadorRepository.findByTribunal_IdAndCodigoCnj(anyInt(), anyInt()))
                .thenReturn(Optional.empty());
        when(municipioRepository.findById(5208707)).thenReturn(Optional.of(municipio(5208707, "Goiânia")));
        when(municipioRepository.findById(5201108)).thenReturn(Optional.of(municipio(5201108, "Anápolis")));
        when(orgaoJulgadorRepository.findByTribunal_IdAndAtivoTrue(9)).thenReturn(List.of());
        when(orgaoJulgadorRepository.save(any())).thenAnswer(inv -> {
            OrgaoJulgadorEntity e = inv.getArgument(0);
            if (e.getId() == null) {
                e.setId(1L);
            }
            return e;
        });

        OrgaoJulgadorSyncResponse primeira = service.sincronizar(9);
        assertThat(primeira.getOrgaosRecebidos()).isEqualTo(4);
        assertThat(primeira.getOrgaosInseridos()).isEqualTo(4);
        assertThat(primeira.getOrgaosDesativados()).isZero();

        OrgaoJulgadorEntity existente = new OrgaoJulgadorEntity();
        existente.setId(10L);
        existente.setCodigoCnj(11447);
        existente.setTribunal(tribunal);
        existente.setNome("Antigo");
        existente.setTipo(OrgaoJulgadorTipo.OUTRO);
        existente.setAtivo(true);
        when(orgaoJulgadorRepository.findByTribunal_IdAndCodigoCnj(eq(9), eq(11447)))
                .thenReturn(Optional.of(existente));
        when(orgaoJulgadorRepository.countByTribunal_IdAndAtivoTrue(9)).thenReturn(4L);

        OrgaoJulgadorSyncResponse segunda = service.sincronizar(9);
        assertThat(segunda.getOrgaosRecebidos()).isEqualTo(4);
        assertThat(segunda.getOrgaosAtualizados()).isGreaterThanOrEqualTo(1);
        verify(orgaoJulgadorRepository, atLeastOnce()).save(any());
    }

    @Test
    void sincronizar_naoDesativaQuandoSumOtherDocCountPositivo() throws Exception {
        TribunalEntity tribunal = tribunalAtivo();
        String json =
                """
                {"aggregations":{"orgaos":{"sum_other_doc_count":5,"buckets":[]}}}
                """;
        when(tribunalApplicationService.carregar(9)).thenReturn(tribunal);
        when(datajudProxyService.proxySearch(eq("api_publica_tjgo"), any())).thenReturn(httpResponse);
        when(httpResponse.statusCode()).thenReturn(200);
        when(httpResponse.body()).thenReturn(json.getBytes(StandardCharsets.UTF_8));
        when(orgaoJulgadorRepository.countByTribunal_IdAndAtivoTrue(9)).thenReturn(10L);

        OrgaoJulgadorSyncResponse resp = service.sincronizar(9);
        assertThat(resp.isDesativacaoExecutada()).isFalse();
        assertThat(resp.getOrgaosDesativados()).isZero();
        verify(orgaoJulgadorRepository, times(0)).findByTribunal_IdAndAtivoTrue(9);
    }

    private static TribunalEntity tribunalAtivo() {
        TribunalEntity t = new TribunalEntity();
        t.setId(9);
        t.setSigla("TJGO");
        t.setNome("Tribunal de Justiça de Goiás");
        t.setDatajudAlias("api_publica_tjgo");
        t.setAtivo(true);
        return t;
    }

    private static MunicipioEntity municipio(int id, String nome) {
        EstadoEntity uf = new EstadoEntity();
        uf.setId(52);
        uf.setSigla("GO");
        MunicipioEntity m = new MunicipioEntity();
        m.setId(id);
        m.setNome(nome);
        m.setEstado(uf);
        return m;
    }
}
