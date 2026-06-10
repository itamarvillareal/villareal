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
