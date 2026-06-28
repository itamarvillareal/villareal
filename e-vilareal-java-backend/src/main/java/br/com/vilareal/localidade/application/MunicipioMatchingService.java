package br.com.vilareal.localidade.application;

import br.com.vilareal.localidade.domain.MunicipioTextoUtil;
import br.com.vilareal.localidade.infrastructure.persistence.entity.MunicipioEntity;
import br.com.vilareal.localidade.infrastructure.persistence.repository.MunicipioRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;
import java.util.Optional;

@Service
public class MunicipioMatchingService {

    public enum ResultadoMatch {
        EXATO,
        AMBIGUO,
        NENHUM
    }

    public record MatchMunicipio(ResultadoMatch resultado, MunicipioEntity municipio, List<MunicipioEntity> candidatos) {}

    private final MunicipioRepository municipioRepository;

    public MunicipioMatchingService(MunicipioRepository municipioRepository) {
        this.municipioRepository = municipioRepository;
    }

    @Transactional(readOnly = true)
    public Optional<MunicipioEntity> buscarPorCodigoIbge(Integer codigoIbge) {
        if (codigoIbge == null || codigoIbge <= 0) {
            return Optional.empty();
        }
        return municipioRepository.findById(codigoIbge);
    }

    @Transactional(readOnly = true)
    public MatchMunicipio casarPorNomeEUf(String cidadeTexto, String ufTexto) {
        if (cidadeTexto == null || cidadeTexto.isBlank()) {
            return new MatchMunicipio(ResultadoMatch.NENHUM, null, List.of());
        }
        String nomeNorm = MunicipioTextoUtil.normalizarNome(cidadeTexto);
        if (nomeNorm.isEmpty()) {
            return new MatchMunicipio(ResultadoMatch.NENHUM, null, List.of());
        }
        String uf = MunicipioTextoUtil.normalizarUf(ufTexto);
        List<MunicipioEntity> candidatos = municipioRepository.findByNomeNormalizadoAndUf(nomeNorm, uf);
        if (candidatos.isEmpty() && uf != null) {
            candidatos = municipioRepository.findByNomeNormalizadoAndUf(nomeNorm, null);
        }
        if (candidatos.size() == 1) {
            return new MatchMunicipio(ResultadoMatch.EXATO, candidatos.get(0), candidatos);
        }
        if (candidatos.size() > 1) {
            return new MatchMunicipio(ResultadoMatch.AMBIGUO, null, candidatos);
        }
        return new MatchMunicipio(ResultadoMatch.NENHUM, null, List.of());
    }
}
