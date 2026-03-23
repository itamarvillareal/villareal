/**
 * Hash SHA-256 do arquivo (auditoria / dedup de importação).
 */
export async function hashArquivoSHA256(file) {
  if (!file || typeof file.arrayBuffer !== 'function') return '';
  try {
    const buf = await file.arrayBuffer();
    const hash = await crypto.subtle.digest('SHA-256', buf);
    return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
  } catch {
    return '';
  }
}
