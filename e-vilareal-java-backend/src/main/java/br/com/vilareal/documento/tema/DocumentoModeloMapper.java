package br.com.vilareal.documento.tema;

import br.com.vilareal.documento.application.DocumentoRodapeHtmlConverter;
import br.com.vilareal.documento.infrastructure.persistence.entity.DocumentoModeloEntity;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;

import java.util.Base64;

@Component
public class DocumentoModeloMapper {

    public TemaDocumento toTemaDocumento(DocumentoModeloEntity entity) {
        if (entity == null) {
            return TemaDocumento.padrao();
        }
        return toTemaDocumento(
                "modelo." + entity.getId(),
                entity.getAdvogadoNome(),
                entity.getAdvogadoOab(),
                entity.getRodapeTexto(),
                entity.getCabecalhoImagem(),
                entity.getCabecalhoContentType());
    }

    public TemaDocumento toTemaDocumento(
            String id,
            String advogadoNome,
            String advogadoOab,
            String rodapeTexto,
            byte[] cabecalhoImagem,
            String cabecalhoContentType) {
        String logoBase64 = null;
        if (cabecalhoImagem != null && cabecalhoImagem.length > 0) {
            String mime = StringUtils.hasText(cabecalhoContentType)
                    ? cabecalhoContentType.trim()
                    : "image/jpeg";
            logoBase64 = "data:" + mime + ";base64," + Base64.getEncoder().encodeToString(cabecalhoImagem);
        }
        return TemaDocumento.personalizado(
                id,
                null,
                logoBase64,
                DocumentoRodapeHtmlConverter.primeiraPagina(rodapeTexto),
                DocumentoRodapeHtmlConverter.paginasSeguintes(rodapeTexto),
                advogadoNome,
                advogadoOab);
    }
}
