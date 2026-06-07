package br.com.vilareal.agendamento.api;

import br.com.vilareal.agendamento.api.dto.RelatorioImportacaoConsultaPeriodica;
import br.com.vilareal.agendamento.application.ConsultaPeriodicaBackupService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/processos/consultas-periodicas")
@Tag(name = "Consultas periódicas — backup", description = "Exportar/importar CSV de monitoramento por CNJ")
public class ConsultaPeriodicaBackupController {

    private final ConsultaPeriodicaBackupService consultaPeriodicaBackupService;

    public ConsultaPeriodicaBackupController(ConsultaPeriodicaBackupService consultaPeriodicaBackupService) {
        this.consultaPeriodicaBackupService = consultaPeriodicaBackupService;
    }

    @GetMapping(value = "/export", produces = "text/csv")
    @Operation(summary = "Exportar CSV com toda a configuração de monitoramento por CNJ")
    public ResponseEntity<byte[]> exportar() {
        ConsultaPeriodicaBackupService.ExportacaoCsv exportacao = consultaPeriodicaBackupService.exportar();
        return ResponseEntity.ok()
                .header(
                        HttpHeaders.CONTENT_DISPOSITION,
                        "attachment; filename=\"" + exportacao.nomeArquivo() + "\"")
                .contentType(MediaType.parseMediaType("text/csv;charset=UTF-8"))
                .body(exportacao.conteudo());
    }

    @PostMapping(value = "/import", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @Operation(summary = "Importar CSV de backup/restore de monitoramento por CNJ")
    public RelatorioImportacaoConsultaPeriodica importar(@RequestParam("file") MultipartFile file) {
        return consultaPeriodicaBackupService.importar(file);
    }
}
