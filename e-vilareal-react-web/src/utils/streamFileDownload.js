/**
 * Download de arquivos grandes sem materializar o corpo inteiro na RAM (Chrome erro 5 / OOM).
 * Preferência: File System Access API (`showSaveFilePicker` + `pipeTo`).
 * Fallback: blob + âncora (arquivos pequenos ou navegadores sem a API).
 */

export function extrairFilenameDaResponse(response, fallback = 'download.bin') {
  const disposition = response.headers.get('Content-Disposition') || '';
  const match = /filename="([^"]+)"/i.exec(disposition);
  return match?.[1] || fallback;
}

export function podeSalvarStreamDiretoNoDisco() {
  return typeof window !== 'undefined' && typeof window.showSaveFilePicker === 'function';
}

export function dispararDownloadBlob(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.rel = 'noopener';
  a.style.display = 'none';
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * @param {Response} response — resposta OK de fetch (corpo ainda não lido)
 * @returns {Promise<{ filename: string, streamed: boolean }>}
 */
export async function salvarResponseComoArquivo(response, { fallbackFilename = 'download.bin' } = {}) {
  if (!response?.ok) {
    throw new Error(`Erro ${response?.status ?? '?'} ao baixar arquivo.`);
  }

  const filename = extrairFilenameDaResponse(response, fallbackFilename);
  const contentLength = Number(response.headers.get('Content-Length') || '0');
  const limiteBlobMb = 48;
  const grande = Number.isFinite(contentLength) && contentLength > limiteBlobMb * 1024 * 1024;

  if (response.body && podeSalvarStreamDiretoNoDisco()) {
    try {
      const ext = filename.includes('.') ? filename.slice(filename.lastIndexOf('.')) : '';
      const handle = await window.showSaveFilePicker({
        suggestedName: filename,
        ...(ext
          ? {
              types: [
                {
                  description: 'Arquivo',
                  accept: { 'application/octet-stream': [ext] },
                },
              ],
            }
          : {}),
      });
      const writable = await handle.createWritable();
      await response.body.pipeTo(writable);
      return { filename, streamed: true };
    } catch (err) {
      if (err?.name === 'AbortError') throw err;
      if (grande) {
        throw new Error(
          'Arquivo muito grande para download automático. Escolha onde salvar no diálogo do navegador ou feche abas extras e tente de novo.',
        );
      }
      // corpo pode ter sido parcialmente consumido — nova requisição fica a cargo do chamador
    }
  }

  if (grande && !podeSalvarStreamDiretoNoDisco()) {
    throw new Error(
      'Arquivo grande demais para este navegador. Use Chrome ou Edge e aceite o diálogo «Salvar como».',
    );
  }

  const blob = await response.blob();
  dispararDownloadBlob(blob, filename);
  return { filename, streamed: false };
}
