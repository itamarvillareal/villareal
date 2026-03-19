import { rodarOcrDocumento } from './documentOcrService.js';

export async function extrairTextoComOcr(file) {
  const inicio = performance.now();
  const { texto, confidence } = await rodarOcrDocumento(file);
  const fim = performance.now();
  const duracaoMs = fim - inicio;
  const avisos = [];
  if (confidence != null && confidence < 60) {
    avisos.push('Confiança média baixa no OCR; revise os dados com atenção.');
  }
  return {
    texto,
    confidence,
    duracaoMs,
    avisos,
  };
}

