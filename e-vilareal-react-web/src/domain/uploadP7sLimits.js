/** Alinhado a spring.servlet.multipart.max-request-size e nginx client_max_body_size (250 MB). */
export const UPLOAD_P7S_LIMITE_BYTES = 250 * 1024 * 1024;

export function somaBytesArquivos(arquivos) {
  return (Array.isArray(arquivos) ? arquivos : []).reduce((acc, f) => acc + (f?.size || 0), 0);
}

export function formatBytesCompact(bytes) {
  const n = Number(bytes) || 0;
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** @returns {string} mensagem de erro ou '' se dentro do limite */
export function validarTamanhoLoteP7s(arquivos) {
  const total = somaBytesArquivos(arquivos);
  if (total <= UPLOAD_P7S_LIMITE_BYTES) return '';
  return (
    `O lote selecionado (${formatBytesCompact(total)}) excede o limite de ` +
    `${formatBytesCompact(UPLOAD_P7S_LIMITE_BYTES)} por envio. Divida em partes menores.`
  );
}
