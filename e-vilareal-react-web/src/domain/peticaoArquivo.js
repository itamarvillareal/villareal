/** Arquivo assinado digitalmente — sempre extensão .p7s (ex.: documento.pdf.p7s). Nunca é PDF. */
export function isArquivoP7s(file) {
  if (!file) return false;
  return /\.p7s$/i.test(file.name) || file.type === 'application/pkcs7-signature';
}

/** PDF bruto, ainda sem assinatura digital. */
export function isArquivoPdfSemAssinatura(file) {
  if (!file || isArquivoP7s(file)) return false;
  return /\.pdf$/i.test(file.name) || file.type === 'application/pdf';
}

/** PDF, JPG/JPEG ou MP4 enviados para assinatura no token (antes do .p7s). */
export function isArquivoAssinavel(file) {
  if (!file || isArquivoP7s(file)) return false;
  return /\.(pdf|jpe?g|mp4)$/i.test(file.name);
}

/** @param {File[]} files @returns {{ validos: File[], invalidos: File[] }} */
export function separarArquivosAssinaveis(files) {
  const validos = [];
  const invalidos = [];
  for (const f of files) {
    if (isArquivoAssinavel(f)) validos.push(f);
    else invalidos.push(f);
  }
  return { validos, invalidos };
}

/** @param {File[]} files @returns {{ validos: File[], invalidos: File[] }} */
export function separarArquivosP7s(files) {
  const validos = [];
  const invalidos = [];
  for (const f of files) {
    if (isArquivoP7s(f)) validos.push(f);
    else invalidos.push(f);
  }
  return { validos, invalidos };
}
