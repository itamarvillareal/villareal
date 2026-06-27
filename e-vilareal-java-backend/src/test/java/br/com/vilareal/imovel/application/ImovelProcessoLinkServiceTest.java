package br.com.vilareal.imovel.application;

import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelEntity;
import br.com.vilareal.imovel.infrastructure.persistence.entity.ImovelProcessoEntity;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelProcessoRepository;
import br.com.vilareal.imovel.infrastructure.persistence.repository.ImovelRepository;
import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.processo.infrastructure.persistence.repository.ProcessoRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Item 4 (fonte única): {@code desativarTodosVinculos} fecha o bug "escalar NULL + N:N ativo" —
 * desativa a(s) linha(s) ativa(s) e ressincroniza o escalar p/ NULL. É o que o
 * {@code atualizarImovel(processoId=null)} passa a chamar.
 */
@ExtendWith(MockitoExtension.class)
class ImovelProcessoLinkServiceTest {

    @Mock
    private ImovelRepository imovelRepository;
    @Mock
    private ImovelProcessoRepository imovelProcessoRepository;
    @Mock
    private ProcessoRepository processoRepository;

    @InjectMocks
    private ImovelProcessoLinkService service;

    @Test
    void desativarTodosVinculos_desativaLinhaAtivaEZeraEscalar() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(77L);
        ProcessoEntity proc = new ProcessoEntity();
        proc.setId(500L);
        imovel.setProcesso(proc); // escalar populado antes

        ImovelProcessoEntity ativo = new ImovelProcessoEntity();
        ativo.setId(10L);
        ativo.setImovel(imovel);
        ativo.setProcesso(proc);
        ativo.setAtivo(true);

        when(imovelProcessoRepository.findByImovel_IdAndAtivoTrueOrderByIdDesc(77L))
                .thenReturn(List.of(ativo));
        // após desativar, não há mais ativa → sync zera o escalar
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(77L))
                .thenReturn(Optional.empty());

        service.desativarTodosVinculos(imovel);

        assertThat(ativo.getAtivo()).isFalse();
        assertThat(ativo.getDataFim()).isNotNull();
        assertThat(imovel.getProcesso()).isNull(); // escalar ressincronizado p/ NULL
        verify(imovelProcessoRepository).save(ativo);
        verify(imovelRepository).save(imovel);
    }

    @Test
    void desativarTodosVinculos_semLinhaAtiva_ehNoOpEmEscalarJaNulo() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(88L);
        when(imovelProcessoRepository.findByImovel_IdAndAtivoTrueOrderByIdDesc(88L)).thenReturn(List.of());
        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(88L))
                .thenReturn(Optional.empty());

        service.desativarTodosVinculos(imovel);

        assertThat(imovel.getProcesso()).isNull();
        verify(imovelRepository).save(imovel);
    }

    @Test
    void sincronizarPrazoLocacaoComContrato_atualizaVinculoAtivo() {
        ImovelEntity imovel = new ImovelEntity();
        imovel.setId(24L);
        ImovelProcessoEntity row = new ImovelProcessoEntity();
        row.setId(3L);
        row.setImovel(imovel);
        row.setAtivo(true);
        row.setDataInicio(java.time.LocalDate.of(2025, 1, 1));
        row.setDataFim(java.time.LocalDate.of(2025, 12, 31));

        when(imovelProcessoRepository.findFirstByImovel_IdAndAtivoTrueOrderByIdDesc(24L))
                .thenReturn(Optional.of(row));

        service.sincronizarPrazoLocacaoComContrato(
                24L, java.time.LocalDate.of(2026, 6, 29), java.time.LocalDate.of(2026, 12, 29));

        assertThat(row.getDataInicio()).isEqualTo(java.time.LocalDate.of(2026, 6, 29));
        assertThat(row.getDataFim()).isEqualTo(java.time.LocalDate.of(2026, 12, 29));
        verify(imovelProcessoRepository).save(row);
    }
}
