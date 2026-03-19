const MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024;

export function validarArquivoDocumento(file) {
  const avisos = [];
  if (!file) {
    throw new Error('Nenhum arquivo de documento foi fornecido.');
  }
  const { name = 'documento', size = 0, type = '' } = file;
  if (size <= 0) {
    throw new Error('Arquivo vazio ou inválido.');
  }
  if (size > MAX_FILE_SIZE_BYTES) {
    avisos.push('Arquivo muito grande; o processamento pode ser lento.');
  }
  const mime = String(type || '').split(';')[0].trim().toLowerCase();
  const extensao = String(name.split('.').pop() || '').toLowerCase();
  const suportado =
    mime === 'application/pdf' ||
    mime.startsWith('image/') ||
    ['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(extensao);
  if (!suportado) {
    throw new Error('Tipo de arquivo não suportado. Use PDF, JPG, JPEG, PNG ou WEBP.');
  }
  if (name.includes('..') || name.includes('/') || name.includes('\\')) {
    avisos.push('Nome de arquivo contém caracteres potencialmente inseguros; será tratado apenas como rótulo.');
  }
  return {
    mime,
    extensao,
    tamanhoBytes: size,
    nomeSeguro: name,
    avisos,
  };
}

export async function lerArquivoComoArrayBuffer(file) {
  if (!file) throw new Error('Nenhum arquivo para leitura.');
  return file.arrayBuffer();
}

