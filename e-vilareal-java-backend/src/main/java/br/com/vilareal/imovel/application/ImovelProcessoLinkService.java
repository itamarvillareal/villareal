package br.com.vilareal.imovel.application;

import br.com.vilareal.common.exception.BusinessRuleException;
import br.com.vilareal.common.exception.ResourceNotFoundException;
import br.com.vilareal.imovel.api.dto.ImovelProcessoPatchRequest;
import br.com.vilareal.imovel.api.dto.ImovelProcessoResponse;
import br.com.vilareal.imovel.api.dto.ImovelProcessoWriteRequest;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.pessoa.infrastructure.persistence.entity.ClienteEntity;
import br.com.vilareal.processo.application.CodigoClienteUtil;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.time.LocalDate;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class ImovelProcessoLinkService {

    private final ImovelRepository imovelRepository;
    private final ImovelProcessoRepository imovelProcessoRepository;
    private final ProcessoRepository processoRepository;

    public ImovelProcessoLinkService(
            ImovelRepository imovelRepository,
            ImovelProcessoRepository imovelProcessoRepository,
            ProcessoRepository processoRepository) {
        this.imovelRepository = imovelRepository;
        this.imovelProcessoRepository = imovelProcessoRepository;
        this.processoRepository = processoRepository;
    }

    @Transactional(readOnly = true)
    public List<ImovelProcessoResponse> listarPorImovel(Long imovelId) {
        requireImovel(imovelId);
        return imovelProcessoRepository.findByImovel_IdOrderByCreatedAtDescIdDesc(imovelId).stream()
                .map(this::toResponse)
                .collect(Collectors.toList());
    }

    @Transactional
    public ImovelProcessoResponse vincular(Long imovelId, ImovelProcessoWriteRequest req) {
        ImovelEntity imovel = requireImovel(imovelId);
        ProcessoEntity processo = processoRepository
                .findById(req.getProcessoId())
                .orElseThrow(() -> new ResourceNotFoundException("Processo não encontrado: " + req.getProcessoId()));

        validarClienteImovelProcesso(imovel, processo);

        var existente = imovelProcessoRepository.findByImovel_IdAndProcesso_Id(imovelId, processo.getId());
        if (existente.isPresent()) {
            ImovelProcessoEntity row = existente.get();
            if (Boolean.TRUE.equals(row.getAtivo())) {
                sincronizarProcessoAtivoNoImovel(imovel);
                return toResponse(row);
            }
            row.setAtivo(true);
            if (req.getDataInicio() != null) {
                row.setDataInicio(req.getDataInicio());
            }
            row.setDataFim(req.getDataFim());
            if (StringUtils.hasText(req.getObservacao())) {
                row.setObservacao(trimToNull(req.getObservacao()));
            }
            desativarOutrosVinculosAtivos(imovelId, row.getId());
            imovelProcessoRepository.save(row);
            sincronizarProcessoAtivoNoImovel(imovel);
            return toResponse(row);
        }

        desativarOutrosVinculosAtivos(imovelId, null);
        ImovelProcessoEntity row = new ImovelProcessoEntity();
        row.setImovel(imovel);
        row.setProcesso(processo);
        row.setDataInicio(req.getDataInicio() != null ? req.getDataInicio() : LocalDate.now());
        row.setDataFim(req.getDataFim());
        row.setAtivo(true);
        row.setObservacao(trimToNull(req.getObservacao()));
        row = imovelProcessoRepository.save(row);
        sincronizarProcessoAtivoNoImovel(imovel);
        return toResponse(row);
    }

    @Transactional
    public ImovelProcessoResponse desativar(Long imovelId, Long processoId, ImovelProcessoPatchRequest req) {
        ImovelEntity imovel = requireImovel(imovelId);
        ImovelProcessoEntity row = imovelProcessoRepository
                .findByImovel_IdAndProcesso_Id(imovelId, processoId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Vínculo imóvel-processo não encontrado: imóvel " + imovelId + ", processo " + processoId));

        row.setAtivo(req.getAtivo() != null ? req.getAtivo() : false);
        if (req.getDataFim() != null) {
            row.setDataFim(req.getDataFim());
        } else if (!Boolean.TRUE.equals(row.getAtivo())) {
            row.setDataFim(LocalDate.now());
        }
        if (StringUtils.hasText(req.getObservacao())) {
            row.setObservacao(trimToNull(req.getObservacao()));
        }
        imovelProcessoRepository.save(row);
        sincronizarProcessoAtivoNoImovel(imovel);
        return toResponse(row);
    }

    @Transactional
    public void vincularSeProcessoInformado(ImovelEntity imovel, Long processoId) {
        if (processoId == null || imovel.getId() == null) {
            return;
        }
        ImovelProcessoWriteRequest req = new ImovelProcessoWriteRequest();
        req.setProcessoId(processoId);
        vincular(imovel.getId(), req);
    }

    /**
     * Desativa TODAS as linhas N:N ativas do imóvel e ressincroniza o escalar (que fica NULL).
     * Usado quando o imóvel é salvo sem processo: mantém escalar e N:N consistentes (fecha o bug
     * "escalar NULL + N:N ativo" que cegava a reconciliação). NO-OP se já não houver linha ativa.
     */
    /**
     * Alinha o prazo do vínculo N:N ativo ({@code imovel_processo}) com a vigência do contrato de locação.
     */
    @Transactional
    public void sincronizarPrazoLocacaoComContrato(Long imovelId, LocalDate dataInicio, LocalDate dataFim) {
        if (imovelId == null) {
            return;
        }
        imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(imovelId).ifPresent(row -> {
            if (dataInicio != null) {
                row.setDataInicio(dataInicio);
            }
            row.setDataFim(dataFim);
            imovelProcessoRepository.save(row);
        });
    }

    @Transactional
    public void desativarTodosVinculos(ImovelEntity imovel) {
        if (imovel.getId() == null) {
            return;
        }
        desativarOutrosVinculosAtivos(imovel.getId(), null);
        sincronizarProcessoAtivoNoImovel(imovel);
    }

    private void validarClienteImovelProcesso(ImovelEntity imovel, ProcessoEntity processo) {
        ClienteEntity clienteImovel = imovel.getCliente();
        ClienteEntity clienteProcesso = processo.getCliente();
        if (clienteImovel != null && clienteProcesso != null && !clienteImovel.getId().equals(clienteProcesso.getId())) {
            throw new BusinessRuleException(
                    "Processo pertence a outro cliente (processo.cliente_id="
                            + clienteProcesso.getId()
                            + ", imóvel.cliente_id="
                            + clienteImovel.getId()
                            + ").");
        }
    }

    private void desativarOutrosVinculosAtivos(Long imovelId, Long excetoId) {
        for (ImovelProcessoEntity ativo : imovelProcessoRepository.findByImovel_IdAndAtivoTrueOrderByIdDesc(imovelId)) {
            if (excetoId != null && ativo.getId().equals(excetoId)) {
                continue;
            }
            ativo.setAtivo(false);
            if (ativo.getDataFim() == null) {
                ativo.setDataFim(LocalDate.now());
            }
            imovelProcessoRepository.save(ativo);
        }
    }

    private void sincronizarProcessoAtivoNoImovel(ImovelEntity imovel) {
        imovelProcessoRepository
                .findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(imovel.getId())
                .ifPresentOrElse(ip -> imovel.setProcesso(ip.getProcesso()), () -> imovel.setProcesso(null));
        imovelRepository.save(imovel);
    }

    private ImovelEntity requireImovel(Long id) {
        return imovelRepository.findById(id).orElseThrow(() -> new ResourceNotFoundException("Imóvel não encontrado: " + id));
    }

    private ImovelProcessoResponse toResponse(ImovelProcessoEntity row) {
        row.getImovel().getId();
        ProcessoEntity proc = row.getProcesso();
        proc.getId();

        ImovelProcessoResponse r = new ImovelProcessoResponse();
        r.setId(row.getId());
        r.setImovelId(row.getImovel().getId());
        r.setProcessoId(proc.getId());
        r.setNumeroInternoProcesso(proc.getNumeroInterno());
        if (proc.getCliente() != null) {
            r.setCodigoCliente(CodigoClienteUtil.normalizarCodigoClienteOitoDigitos(
                    proc.getCliente().getCodigoCliente()));
        }
        r.setDataInicio(row.getDataInicio());
        r.setDataFim(row.getDataFim());
        r.setAtivo(row.getAtivo());
        r.setObservacao(row.getObservacao());
        r.setCreatedAt(row.getCreatedAt());
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
