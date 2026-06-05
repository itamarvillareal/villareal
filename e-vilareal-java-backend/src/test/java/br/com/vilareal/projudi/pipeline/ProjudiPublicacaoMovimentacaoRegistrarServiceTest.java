package br.com.vilareal.projudi.pipeline;

import br.com.vilareal.processo.infrastructure.persistence.entity.ProcessoEntity;
import br.com.vilareal.projudi.ProjudiOrquestradorPersistenciaService;
import br.com.vilareal.projudi.ProjudiTeorService.MovimentacaoProjudi;
import br.com.vilareal.publicacao.api.dto.PublicacaoWriteRequest;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ProjudiPublicacaoMovimentacaoRegistrarServiceTest {

    private static final String CNJ = "5059346-36.2026.8.09.0007";
    private static final String HASH_CONTEUDO = "abc123hashconteudo";

    @Mock
    private ProjudiOrquestradorPersistenciaService persistenciaService;

    private ProjudiPublicacaoMovimentacaoRegistrarService service;

    @BeforeEach
    void setUp() {
        service = new ProjudiPublicacaoMovimentacaoRegistrarService(persistenciaService);
    }

    @Test
    void sucesso_gravaTodosOsCamposEDetalheGravada() {
        ProcessoEntity processo = processo(1076L);
        MovimentacaoProjudi mov = mov("42", "id-movi-1", "Petição", "Corpo da petição",
                "15/03/2026 14:30:00");
        List<String> detalhes = new ArrayList<>();
        when(persistenciaService.salvarPublicacaoMovimentacao(
                org.mockito.ArgumentMatchers.any(PublicacaoWriteRequest.class), eq(processo)))
                .thenReturn(999L);

        service.registrarMovimentacao(processo, CNJ, mov, HASH_CONTEUDO, detalhes);

        PublicacaoWriteRequest req = capturarRequest(processo);
        String teor = "Petição - Corpo da petição";
        assertThat(req.getNumeroProcessoEncontrado()).isEqualTo(CNJ);
        assertThat(req.getDataPublicacao()).isEqualTo(LocalDate.of(2026, 3, 15));
        assertThat(req.getDataDisponibilizacao()).isEqualTo(LocalDate.of(2026, 3, 15));
        assertThat(req.getFonte()).isEqualTo("PROJUDI");
        assertThat(req.getTitulo()).isEqualTo("Petição");
        assertThat(req.getTipoPublicacao()).isEqualTo("Petição");
        assertThat(req.getResumo()).isEqualTo(teor);
        assertThat(req.getTeor()).isEqualTo(teor);
        assertThat(req.getHashTeor()).isEqualTo(ProjudiMovimentacaoHashUtil.sha256Hex(teor));
        assertThat(req.getHashConteudo()).isEqualTo(HASH_CONTEUDO);
        assertThat(req.getOrigemImportacao()).isEqualTo("PROJUDI");
        assertThat(req.getArquivoOrigemNome()).isEqualTo("PROJUDI mov 42 [id-movi-1]");
        assertThat(req.getStatusTratamento()).isEqualTo("PENDENTE");
        assertThat(req.getLida()).isFalse();
        assertThat(req.getObservacao()).isEqualTo("Importado automaticamente via PROJUDI.");
        assertThat(detalhes).hasSize(1);
        assertThat(detalhes.getFirst()).isEqualTo(
                CNJ + " | mov 42 | publicação PROJUDI gravada (id=999, hash=" + HASH_CONTEUDO + ").");
    }

    @Test
    void duplicado_detalheAvisoHashDuplicado() {
        ProcessoEntity processo = processo(1L);
        MovimentacaoProjudi mov = mov("1", "x", "Tipo", "Desc", "01/01/2026 10:00:00");
        List<String> detalhes = new ArrayList<>();
        when(persistenciaService.salvarPublicacaoMovimentacao(
                org.mockito.ArgumentMatchers.any(PublicacaoWriteRequest.class), eq(processo)))
                .thenReturn(null);

        service.registrarMovimentacao(processo, CNJ, mov, HASH_CONTEUDO, detalhes);

        capturarRequest(processo);
        assertThat(detalhes).hasSize(1);
        assertThat(detalhes.getFirst()).isEqualTo(
                CNJ + " | mov 1 | AVISO publicação não gravada (hash duplicado em criarPublicacaoProjudi: "
                        + HASH_CONTEUDO + ").");
    }

    @Test
    void descricaoVazia_teorIgualTipoSemSeparador() {
        ProcessoEntity processo = processo(1L);
        MovimentacaoProjudi mov = mov("2", "id2", "Decisão", "", "01/01/2026 10:00:00");
        List<String> detalhes = new ArrayList<>();
        when(persistenciaService.salvarPublicacaoMovimentacao(
                org.mockito.ArgumentMatchers.any(PublicacaoWriteRequest.class), eq(processo)))
                .thenReturn(1L);

        service.registrarMovimentacao(processo, CNJ, mov, HASH_CONTEUDO, detalhes);

        PublicacaoWriteRequest req = capturarRequest(processo);
        assertThat(req.getTeor()).isEqualTo("Decisão");
        assertThat(req.getHashTeor()).isEqualTo(ProjudiMovimentacaoHashUtil.sha256Hex("Decisão"));
    }

    @Test
    void dataValida_parseDdMmYyyyHhMmSs() {
        ProcessoEntity processo = processo(1L);
        MovimentacaoProjudi mov = mov("3", "id3", "T", "D", "20/06/2025 08:15:30");
        List<String> detalhes = new ArrayList<>();
        when(persistenciaService.salvarPublicacaoMovimentacao(
                org.mockito.ArgumentMatchers.any(PublicacaoWriteRequest.class), eq(processo)))
                .thenReturn(1L);

        service.registrarMovimentacao(processo, CNJ, mov, HASH_CONTEUDO, detalhes);

        PublicacaoWriteRequest req = capturarRequest(processo);
        assertThat(req.getDataPublicacao()).isEqualTo(LocalDate.of(2025, 6, 20));
        assertThat(req.getDataDisponibilizacao()).isEqualTo(LocalDate.of(2025, 6, 20));
    }

    @Test
    void dataInvalida_usaHoje() {
        ProcessoEntity processo = processo(1L);
        MovimentacaoProjudi mov = mov("4", "id4", "T", "D", "data-ruim");
        List<String> detalhes = new ArrayList<>();
        when(persistenciaService.salvarPublicacaoMovimentacao(
                org.mockito.ArgumentMatchers.any(PublicacaoWriteRequest.class), eq(processo)))
                .thenReturn(1L);

        service.registrarMovimentacao(processo, CNJ, mov, HASH_CONTEUDO, detalhes);

        PublicacaoWriteRequest req = capturarRequest(processo);
        assertThat(req.getDataPublicacao()).isEqualTo(LocalDate.now());
        assertThat(req.getDataDisponibilizacao()).isEqualTo(LocalDate.now());
    }

    private PublicacaoWriteRequest capturarRequest(ProcessoEntity processo) {
        ArgumentCaptor<PublicacaoWriteRequest> captor = ArgumentCaptor.forClass(PublicacaoWriteRequest.class);
        verify(persistenciaService).salvarPublicacaoMovimentacao(captor.capture(), eq(processo));
        return captor.getValue();
    }

    private static ProcessoEntity processo(long id) {
        ProcessoEntity p = new ProcessoEntity();
        p.setId(id);
        return p;
    }

    private static MovimentacaoProjudi mov(
            String numero, String idMovi, String tipo, String descricao, String dataHora) {
        return new MovimentacaoProjudi(
                numero,
                tipo,
                descricao,
                dataHora,
                "user",
                "cod",
                idMovi,
                "token-arquivo",
                true);
    }
}
