package br.com.vilareal.orgaojulgador.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.datajud.DatajudProxyService;
import br.com.vilareal.localidade.domain.MunicipioTextoUtil;
import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import br.com.vilareal.localidade.infrastructure.persistence.repository.MunicipioRepository;
import br.com.vilareal.orgaojulgador.api.dto.OrgaoJulgadorSyncResponse;
import br.com.vilareal.orgaojulgador.domain.DatajudOrgaoAggregationParser;
import br.com.vilareal.orgaojulgador.domain.OrgaoJulgadorTipoUtil;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.OrgaoJulgadorEntity;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.entity.TribunalEntity;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.repository.OrgaoJulgadorRepository;
import br.com.vilareal.orgaojulgador.infrastructure.persistence.repository.TribunalRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.core.io.ClassPathResource;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.io.IOException;
import java.io.InputStream;
import java.net.http.HttpResponse;
import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

@Service
public class OrgaoJulgadorSyncService {

    private static final Logger log = LoggerFactory.getLogger(OrgaoJulgadorSyncService.class);
    private static final double MINIMO_FRACAO_ORGAOS_ATIVOS = 0.90;
    private static final String FALLBACK_TJGO = "seeds/orgaos-julgadores-tjgo.json";
    private static final String FONTE_DATAJUD = "DATAJUD";
    private static final String FONTE_FALLBACK_JSON = "FALLBACK_JSON";

    private final DatajudProxyService datajudProxyService;
    private final TribunalApplicationService tribunalApplicationService;
    private final OrgaoJulgadorRepository orgaoJulgadorRepository;
    private final MunicipioRepository municipioRepository;
    private final TribunalRepository tribunalRepository;

    public OrgaoJulgadorSyncService(
            DatajudProxyService datajudProxyService,
            TribunalApplicationService tribunalApplicationService,
            OrgaoJulgadorRepository orgaoJulgadorRepository,
            MunicipioRepository municipioRepository,
            TribunalRepository tribunalRepository) {
        this.datajudProxyService = datajudProxyService;
        this.tribunalApplicationService = tribunalApplicationService;
        this.orgaoJulgadorRepository = orgaoJulgadorRepository;
        this.municipioRepository = municipioRepository;
        this.tribunalRepository = tribunalRepository;
    }

    @Transactional
    public OrgaoJulgadorSyncResponse sincronizar(Integer tribunalId) {
        TribunalEntity tribunal = tribunalApplicationService.carregar(tribunalId);
        if (!Boolean.TRUE.equals(tribunal.getAtivo())) {
            throw new BusinessRuleException("Tribunal inativo para sincronização: " + tribunal.getSigla());
        }
        if (tribunal.getDatajudAlias() == null || tribunal.getDatajudAlias().isBlank()) {
            throw new BusinessRuleException("Tribunal sem índice DataJud configurado: " + tribunal.getSigla());
        }

        OrgaoJulgadorSyncResponse resp = new OrgaoJulgadorSyncResponse();
        resp.setTribunalId(tribunal.getId());
        resp.setTribunalSigla(tribunal.getSigla());

        byte[] payload = null;
        boolean fallbackJson = false;
        try {
            HttpResponse<byte[]> httpRes =
                    datajudProxyService.proxySearch(tribunal.getDatajudAlias(), DatajudOrgaoAggregationParser.corpoAgregacaoOrgaos());
            if (httpRes.statusCode() >= 200 && httpRes.statusCode() < 300) {
                payload = httpRes.body();
            } else {
                log.warn(
                        "DataJud retornou HTTP {} para tribunal {} — tentando fallback JSON",
                        httpRes.statusCode(),
                        tribunal.getSigla());
            }
        } catch (IOException | InterruptedException e) {
            if (e instanceof InterruptedException) {
                Thread.currentThread().interrupt();
            }
            log.warn("Falha ao consultar DataJud para {} — tentando fallback JSON", tribunal.getSigla(), e);
        }

        if (payload == null || payload.length == 0) {
            payload = carregarFallbackJson(tribunal.getSigla());
            fallbackJson = payload != null;
        }
        if (payload == null || payload.length == 0) {
            throw new BusinessRuleException("Não foi possível obter catálogo de órgãos para " + tribunal.getSigla());
        }
        resp.setFallbackJson(fallbackJson);

        DatajudOrgaoAggregationParser.Resultado parsed;
        try {
            parsed = DatajudOrgaoAggregationParser.parse(payload);
        } catch (IOException e) {
            throw new BusinessRuleException("Resposta DataJud inválida para " + tribunal.getSigla());
        }

        List<DatajudOrgaoAggregationParser.OrgaoAgregado> orgaos = parsed.orgaos();
        resp.setOrgaosRecebidos(orgaos.size());

        long ativosAntes = orgaoJulgadorRepository.countByTribunal_IdAndAtivoTrue(tribunal.getId());
        boolean respostaIntegra = parsed.sumOtherDocCount() == 0;
        boolean contagemOk =
                ativosAntes == 0
                        || orgaos.size() >= Math.floor(ativosAntes * MINIMO_FRACAO_ORGAOS_ATIVOS);
        boolean podeDesativar = respostaIntegra && contagemOk;

        if (!respostaIntegra) {
            log.warn(
                    "Sync {} abortou desativação: sum_other_doc_count={} (esperado 0)",
                    tribunal.getSigla(),
                    parsed.sumOtherDocCount());
        } else if (!contagemOk) {
            log.warn(
                    "Sync {} abortou desativação: recebidos {} < 90% de {} ativos",
                    tribunal.getSigla(),
                    orgaos.size(),
                    ativosAntes);
        }

        Map<Integer, MunicipioEntity> municipiosPorIbge = new HashMap<>();
        Set<Integer> codigosRecebidos = new HashSet<>();
        Instant agora = Instant.now();
        int inseridos = 0;
        int atualizados = 0;
        int semMunicipio = 0;

        for (DatajudOrgaoAggregationParser.OrgaoAgregado item : orgaos) {
            codigosRecebidos.add(item.codigoCnj());
            OrgaoJulgadorEntity ent = orgaoJulgadorRepository
                    .findByTribunal_IdAndCodigoCnj(tribunal.getId(), item.codigoCnj())
                    .orElse(null);
            boolean novo = ent == null;
            if (novo) {
                ent = new OrgaoJulgadorEntity();
                ent.setTribunal(tribunal);
                ent.setCodigoCnj(item.codigoCnj());
                inseridos++;
            } else {
                atualizados++;
            }
            ent.setNome(item.nome());
            ent.setNomeNormalizado(MunicipioTextoUtil.normalizarNome(item.nome()));
            ent.setGrau(item.grau());
            ent.setTipo(OrgaoJulgadorTipoUtil.classificar(item.nome(), item.grau()));
            ent.setAtivo(true);
            ent.setFonte(fallbackJson ? FONTE_FALLBACK_JSON : FONTE_DATAJUD);
            ent.setSyncedAt(agora);

            MunicipioEntity municipio = resolverMunicipio(item.codigoMunicipioIbge(), municipiosPorIbge);
            ent.setMunicipio(municipio);
            if (municipio == null && item.codigoMunicipioIbge() != null) {
                semMunicipio++;
            }
            orgaoJulgadorRepository.save(ent);
        }

        int desativados = 0;
        if (podeDesativar) {
            for (OrgaoJulgadorEntity existente : orgaoJulgadorRepository.findByTribunal_IdAndAtivoTrue(tribunal.getId())) {
                if (!codigosRecebidos.contains(existente.getCodigoCnj())) {
                    existente.setAtivo(false);
                    existente.setSyncedAt(agora);
                    orgaoJulgadorRepository.save(existente);
                    desativados++;
                }
            }
        }

        // Carimba a sincronização do tribunal apenas quando a resposta veio íntegra
        // (não em sync abortada pela trava de sanidade).
        if (podeDesativar) {
            tribunal.setUltimaSincronizacao(agora);
            tribunalRepository.save(tribunal);
        }

        resp.setOrgaosInseridos(inseridos);
        resp.setOrgaosAtualizados(atualizados);
        resp.setOrgaosDesativados(desativados);
        resp.setOrgaosSemMunicipio(semMunicipio);
        resp.setDesativacaoExecutada(podeDesativar && desativados > 0);

        StringBuilder msg = new StringBuilder();
        msg.append("Sincronizados ")
                .append(orgaos.size())
                .append(" órgãos (")
                .append(inseridos)
                .append(" novos, ")
                .append(atualizados)
                .append(" atualizados).");
        if (!podeDesativar) {
            msg.append(" Desativação preservada (resposta não íntegra ou contagem abaixo do limiar).");
        } else if (desativados > 0) {
            msg.append(" Desativados: ").append(desativados).append(".");
        }
        if (fallbackJson) {
            msg.append(" Fonte: JSON fallback.");
        }
        resp.setMensagem(msg.toString());
        return resp;
    }

    private MunicipioEntity resolverMunicipio(Integer ibge, Map<Integer, MunicipioEntity> cache) {
        if (ibge == null) {
            return null;
        }
        return cache.computeIfAbsent(
                ibge,
                id -> municipioRepository.findById(id).orElse(null));
    }

    private byte[] carregarFallbackJson(String siglaTribunal) {
        if (!"TJGO".equalsIgnoreCase(siglaTribunal)) {
            return null;
        }
        ClassPathResource resource = new ClassPathResource(FALLBACK_TJGO);
        if (!resource.exists()) {
            return null;
        }
        try (InputStream in = resource.getInputStream()) {
            return in.readAllBytes();
        } catch (IOException e) {
            log.warn("Falha ao ler fallback {}", FALLBACK_TJGO, e);
            return null;
        }
    }
}
