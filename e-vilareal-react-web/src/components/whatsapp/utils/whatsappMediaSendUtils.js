/** Limites Meta (espelham backend WhatsAppMediaProperties). */
export const WHATSAPP_MEDIA_LIMITS_BYTES = {
  image: 5 * 1024 * 1024,
  document: 100 * 1024 * 1024,
  audio: 16 * 1024 * 1024,
  video: 16 * 1024 * 1024,
};

export const WHATSAPP_MEDIA_ACCEPT =
  'image/jpeg,image/png,' +
  'video/mp4,video/3gpp,' +
  'audio/aac,audio/mp4,audio/mpeg,audio/amr,audio/ogg,' +
  'application/pdf,application/msword,' +
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document,' +
  'application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,' +
  'application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation,' +
  'text/plain,text/csv,application/zip';

const IMAGE_MIMES = new Set(['image/jpeg', 'image/png']);
const AUDIO_MIMES = new Set(['audio/aac', 'audio/mp4', 'audio/mpeg', 'audio/amr', 'audio/ogg']);
const VIDEO_MIMES = new Set(['video/mp4', 'video/3gpp']);

function normalizarMime(mime) {
  return String(mime ?? '')
    .trim()
    .toLowerCase()
    .split(';')[0]
    .trim();
}

function resolverCategoria(mime) {
  const m = normalizarMime(mime);
  if (IMAGE_MIMES.has(m)) return 'image';
  if (AUDIO_MIMES.has(m)) return 'audio';
  if (VIDEO_MIMES.has(m)) return 'video';
  return 'document';
}

function inferirMimeDoNome(nome) {
  const lower = String(nome ?? '').toLowerCase();
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.mp4')) return 'video/mp4';
  if (lower.endsWith('.3gp') || lower.endsWith('.3gpp')) return 'video/3gpp';
  if (lower.endsWith('.aac')) return 'audio/aac';
  if (lower.endsWith('.mp3')) return 'audio/mpeg';
  if (lower.endsWith('.amr')) return 'audio/amr';
  if (lower.endsWith('.ogg')) return 'audio/ogg';
  if (lower.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

/** Validação rápida no front (backend é fonte da verdade). */
export function validarArquivoWhatsAppMedia(file) {
  if (!file) return { ok: false, erro: 'Selecione um arquivo.' };
  const mime = normalizarMime(file.type) || inferirMimeDoNome(file.name);
  const categoria = resolverCategoria(mime);
  const limite = WHATSAPP_MEDIA_LIMITS_BYTES[categoria];
  if (file.size > limite) {
    const mb = (limite / (1024 * 1024)).toFixed(0);
    const atual = (file.size / (1024 * 1024)).toFixed(1);
    return {
      ok: false,
      erro: `Arquivo excede o limite de ${categoria} (${mb} MB). Tamanho: ${atual} MB.`,
    };
  }
  return { ok: true, categoria, mime };
}

export function categoriaAceitaCaption(categoria) {
  return categoria === 'image' || categoria === 'video' || categoria === 'document';
}

export function categoriaParaMessageType(categoria) {
  switch (categoria) {
    case 'image':
      return 'IMAGE';
    case 'audio':
      return 'AUDIO';
    case 'video':
      return 'VIDEO';
    default:
      return 'DOCUMENT';
  }
}

export function placeholderConteudoMidia(messageType, filename, caption) {
  if (String(caption ?? '').trim()) return String(caption).trim();
  const type = String(messageType ?? '').toUpperCase();
  if (type === 'IMAGE') return '📷 Imagem';
  if (type === 'AUDIO') return '🎵 Áudio';
  if (type === 'VIDEO') return '🎥 Vídeo';
  if (type === 'DOCUMENT' && filename) return `📄 ${filename}`;
  return '📄 Documento';
}

function extensaoImagemDeMime(mime) {
  const m = normalizarMime(mime);
  if (m === 'image/jpeg') return 'jpg';
  if (m === 'image/png') return 'png';
  return 'png';
}

/** Nome vazio ou genérico de clipboard / screenshot. */
function nomeArquivoMidiaGenerico(name) {
  const n = String(name ?? '').trim();
  if (!n) return true;
  const lower = n.toLowerCase();
  if (lower === 'blob' || lower === 'arquivo') return true;
  return /^image\.(png|jpe?g)$/i.test(lower);
}

/** Garante nome legível para preview/envio (ex.: colado-1717500000000.png). */
export function prepararArquivoMidiaWhatsApp(file) {
  if (!file) return null;
  if (!nomeArquivoMidiaGenerico(file.name)) return file;
  const mime = normalizarMime(file.type) || inferirMimeDoNome(file.name) || 'image/png';
  const ext = extensaoImagemDeMime(mime);
  return new File([file], `colado-${Date.now()}.${ext}`, { type: file.type || mime });
}

/**
 * Ponto único de seleção de anexo (file input, paste): normaliza nome, valida, retorna file ou erro.
 */
export function handleAttachSelect(file) {
  if (!file) return { ok: false, erro: 'Selecione um arquivo.' };
  const prepared = prepararArquivoMidiaWhatsApp(file);
  const validation = validarArquivoWhatsAppMedia(prepared);
  if (!validation.ok) return { ok: false, erro: validation.erro };
  return { ok: true, file: prepared, categoria: validation.categoria, mime: validation.mime };
}

/** Primeira imagem do clipboard (screenshot / copiar imagem). */
export function extrairImagemDoClipboard(event) {
  const items = event?.clipboardData?.items;
  if (!items) return null;
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (item.kind === 'file' && String(item.type ?? '').startsWith('image/')) {
      const file = item.getAsFile();
      if (file) return file;
    }
  }
  return null;
}

/**
 * Handler onPaste para o campo de digitação — só intercepta imagem; texto cola normalmente.
 * @param {{ conversaAtiva: boolean, onAttachFile: (file: File) => void, disabled?: boolean }} opts
 */
export function criarOnPasteCompositor({ conversaAtiva, onAttachFile, disabled = false }) {
  return (event) => {
    if (!conversaAtiva || disabled) return;
    const file = extrairImagemDoClipboard(event);
    if (!file) return;
    event.preventDefault();
    onAttachFile(file);
  };
}

export { resolverCategoria, normalizarMime, inferirMimeDoNome };
