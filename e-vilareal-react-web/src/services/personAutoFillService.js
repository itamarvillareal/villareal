import { validarArquivoDocumento } from './documentReaderService.js';
import { extrairTextoComOcr } from './ocrService.js';
import { parseBrazilianDocument } from './brazilianDocumentParserService.js';

export async function analisarDocumentoPessoa(file) {
  const logs = [];
  const inicio = performance.now();
  try {
    const infoArquivo = validarArquivoDocumento(file);
    logs.push({ etapa: 'validacaoArquivo', infoArquivo });

    const ocr = await extrairTextoComOcr(file);
    logs.push({
      etapa: 'ocr',
      duracaoMs: ocr.duracaoMs,
      confidence: ocr.confidence,
      avisos: ocr.avisos,
    });

    const parsed = parseBrazilianDocument(ocr.texto, {
      mime: infoArquivo.mime,
      extensao: infoArquivo.extensao,
      tamanhoBytes: infoArquivo.tamanhoBytes,
      nomeSeguro: infoArquivo.nomeSeguro,
    });
    logs.push({
      etapa: 'parser',
      tipoDocumentoDetectado: parsed.tipoDocumentoDetectado,
      confiancaPorCampo: parsed.confiancaPorCampo,
      avisos: parsed.avisos,
    });

    const sucesso = parsed.sucesso;
    const fim = performance.now();
    return {
      ...parsed,
      sucesso,
      avisos: [...infoArquivo.avisos, ...ocr.avisos, ...parsed.avisos],
      logs,
      duracaoTotalMs: fim - inicio,
    };
  } catch (err) {
    const fim = performance.now();
    const mensagem = err?.message || String(err);
    logs.push({ etapa: 'erro', mensagem });
    return {
      nomeCompleto: null,
      cpf: null,
      rg: null,
      dataNascimento: null,
      tipoDocumentoDetectado: 'DESCONHECIDO',
      confiancaPorCampo: {
        nomeCompleto: 0,
        cpf: 0,
        rg: 0,
        dataNascimento: 0,
      },
      textoExtraidoBruto: '',
      avisos: [mensagem],
      sucesso: false,
      logs,
      duracaoTotalMs: fim - inicio,
    };
  }
}

