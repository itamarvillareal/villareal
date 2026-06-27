package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.api.dto.ImovelVinculoLocatarioResponse;
import br.com.vilareal.imovel.api.dto.ImovelVinculoLocatarioWriteRequest;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelVinculoLocatarioEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelVinculoLocatarioRepository;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

@Service
public class ImovelVinculoLocatarioService {

    private final ImovelVinculoLocatarioRepository vinculoLocatarioRepository;
    private final ImovelRepository imovelRepository;
    private final ProcessoRepository processoRepository;

    public ImovelVinculoLocatarioService(
            ImovelVinculoLocatarioRepository vinculoLocatarioRepository,
            ImovelRepository imovelRepository,
            ProcessoRepository processoRepository) {
        this.vinculoLocatarioRepository = vinculoLocatarioRepository;
        this.imovelRepository = imovelRepository;
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public ImovelVinculoLocatarioResponse buscarPorVinculo(
            int numeroPlanilha, String codigoCliente, int numeroInterno) {
        validarChaveVinculo(numeroPlanilha, codigoCliente, numeroInterno);
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente);
        return vinculoLocatarioRepository
                .findByNumeroPlanilhaAndCodigoClienteAndNumeroInterno(numeroPlanilha, cod8, numeroInterno)
                .map(this::toResponse)
                .orElse(null);
    }

    @Transactional
    public ImovelVinculoLocatarioResponse buscarOuMigrarLegadoPorVinculo(
            int numeroPlanilha, String codigoCliente, int numeroInterno) {
        ImovelVinculoLocatarioResponse existente = buscarPorVinculo(numeroPlanilha, codigoCliente, numeroInterno);
        if (existente != null) {
            return existente;
        }
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codigoCliente);
        return migrarLegadoSePossivel(numeroPlanilha, cod8, numeroInterno);
    }

    @Transactional
    public ImovelVinculoLocatarioResponse salvarPorVinculo(
            int numeroPlanilha, ImovelVinculoLocatarioWriteRequest req) {
        if (req == null) {
            throw new IllegalArgumentException("payload é obrigatório");
        }
        validarChaveVinculo(numeroPlanilha, req.getCodigoCliente(), req.getNumeroInterno());
        String cod8 = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(req.getCodigoCliente());
        Integer proc = req.getNumeroInterno();

        ImovelVinculoLocatarioEntity row = vinculoLocatarioRepository
                .findByNumeroPlanilhaAndCodigoClienteAndNumeroInterno(numeroPlanilha, cod8, proc)
                .orElseGet(() -> {
                    ImovelVinculoLocatarioEntity novo = new ImovelVinculoLocatarioEntity();
                    novo.setNumeroPlanilha(numeroPlanilha);
                    novo.setCodigoCliente(cod8);
                    novo.setNumeroInterno(proc);
                    return novo;
                });

        row.setCamposExtrasJson(trimToNull(req.getCamposExtrasJson()));
        row.setProcesso(resolverProcesso(req.getProcessoId()));
        return toResponse(vinculoLocatarioRepository.save(row));
    }

    /** Copia extras legados do imóvel cujo par cod+proc coincide (primeira leitura). */
    private ImovelVinculoLocatarioResponse migrarLegadoSePossivel(
            int numeroPlanilha, String codigoCliente, int numeroInterno) {
        ImovelEntity candidato = imovelRepository.findAllPorNumeroPlanilhaLegado(numeroPlanilha).stream()
                .filter(im -> extrasCoincidemComVinculo(im, codigoCliente, numeroInterno))
                .findFirst()
                .orElse(null);
        if (candidato == null || !StringUtils.hasText(candidato.getCamposExtrasJson())) {
            return null;
        }
        ImovelVinculoLocatarioWriteRequest req = new ImovelVinculoLocatarioWriteRequest();
        req.setCodigoCliente(codigoCliente);
        req.setNumeroInterno(numeroInterno);
        req.setCamposExtrasJson(candidato.getCamposExtrasJson());
        if (candidato.getProcesso() != null) {
            req.setProcessoId(candidato.getProcesso().getId());
        }
        return salvarPorVinculo(numeroPlanilha, req);
    }

    private static boolean extrasCoincidemComVinculo(
            ImovelEntity im, String codigoCliente, int numeroInterno) {
        if (im.getProcesso() != null
                && im.getProcesso().getNumeroInterno() != null
                && im.getProcesso().getNumeroInterno() == numeroInterno) {
            return true;
        }
        if (!StringUtils.hasText(im.getCamposExtrasJson())) {
            return false;
        }
        try {
            var node = new com.fasterxml.jackson.databind.ObjectMapper().readTree(im.getCamposExtrasJson());
            String codExtra = node.path("codigo").asText("").trim();
            String procExtra = node.path("proc").asText("").trim();
            if (!StringUtils.hasText(codExtra) || !StringUtils.hasText(procExtra)) {
                return false;
            }
            String codNorm = CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(codExtra);
            int procNum;
            try {
                procNum = Integer.parseInt(procExtra.replaceAll("\\D", ""));
            } catch (NumberFormatException e) {
                return false;
            }
            return codigoCliente.equals(codNorm) && procNum == numeroInterno;
        } catch (Exception e) {
            return false;
        }
    }

    private ProcessoEntity resolverProcesso(Long processoId) {
        if (processoId == null) {
            return null;
        }
        return processoRepository
                .findById(processoId)
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + processoId));
    }

    private static void validarChaveVinculo(int numeroPlanilha, String codigoCliente, int numeroInterno) {
        if (numeroPlanilha < 1) {
            throw new BusinessRuleException("numeroPlanilha inválido");
        }
        if (!StringUtils.hasText(codigoCliente)) {
            throw new BusinessRuleException("Informe o código de cliente.");
        }
        if (numeroInterno < 1) {
            throw new BusinessRuleException("Informe o proc. válido.");
        }
    }

    private ImovelVinculoLocatarioResponse toResponse(ImovelVinculoLocatarioEntity e) {
        if (e == null) {
            return null;
        }
        ImovelVinculoLocatarioResponse r = new ImovelVinculoLocatarioResponse();
        r.setNumeroPlanilha(e.getNumeroPlanilha());
        r.setCodigoCliente(e.getCodigoCliente());
        r.setNumeroInterno(e.getNumeroInterno());
        r.setProcessoId(e.getProcesso() != null ? e.getProcesso().getId() : null);
        r.setCamposExtrasJson(e.getCamposExtrasJson());
        return r;
    }

    private static String trimToNull(String s) {
        if (!StringUtils.hasText(s)) {
            return null;
        }
        String t = s.trim();
        return t.isEmpty() ? null : t;
    }
}
