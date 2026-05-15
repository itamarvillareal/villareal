package br.com.vilareal.datajud;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.io.IOException;
import java.net.http.HttpResponse;

@RestController
@RequestMapping("/api/integrations/datajud")
@Tag(name = "Integrações — DataJud", description = "Proxy autenticado para a API pública CNJ (Elasticsearch _search)")
public class DatajudIntegrationController {

    private final DatajudProxyService datajudProxyService;

    public DatajudIntegrationController(DatajudProxyService datajudProxyService) {
        this.datajudProxyService = datajudProxyService;
    }

    @PostMapping("/{index}/_search")
    @Operation(summary = "Encaminhar _search ao DataJud", description = "Corpo JSON idêntico ao tutorial CNJ (Query DSL).")
    public ResponseEntity<byte[]> search(@PathVariable("index") String index, @RequestBody byte[] body)
            throws IOException, InterruptedException {
        HttpResponse<byte[]> res = datajudProxyService.proxySearch(index, body);
        HttpStatus st = DatajudProxyService.mapStatus(res.statusCode());
        return ResponseEntity.status(st)
                .contentType(MediaType.APPLICATION_JSON)
                .body(res.body());
    }
}
