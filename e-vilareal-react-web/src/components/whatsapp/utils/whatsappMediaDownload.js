import { buscarWhatsAppMediaBlob } from '../../../repositories/whatsappRepository.js';
import { resolverMediaProxyUrl } from './whatsappMediaUtils.js';
import { dispararDownloadBlob } from '../../../utils/streamFileDownload.js';

function extensaoFromMime(mimeType) {
  if (!mimeType) return 'bin';
  const lower = String(mimeType).toLowerCase().split(';')[0].trim();
  if (lower.includes('jpeg') || lower.includes('jpg')) return 'jpg';
  if (lower.includes('png')) return 'png';
  if (lower.includes('webp')) return 'webp';
  if (lower.includes('gif')) return 'gif';
  if (lower.includes('pdf')) return 'pdf';
  if (lower.includes('ogg')) return 'ogg';
  if (lower.includes('mp4')) return 'mp4';
  if (lower.includes('mpeg') || lower.includes('mp3')) return 'mp3';
  if (lower.includes('m4a') || lower.includes('mp4a')) return 'm4a';
  if (lower.includes('webm')) return 'webm';
  if (lower.includes('word') || lower.includes('docx')) return 'docx';
  if (lower.includes('sheet') || lower.includes('xlsx')) return 'xlsx';
  if (lower.includes('presentation') || lower.includes('pptx')) return 'pptx';
  if (lower.includes('text/plain') || lower === 'text/plain') return 'txt';
  if (lower.includes('csv')) return 'csv';
  if (lower.includes('zip')) return 'zip';
  return 'bin';
}

function prefixoTipo(message) {
  const type = String(message?.messageType ?? '').toUpperCase();
  const fn = String(message?.mediaFilename ?? '').toLowerCase();
  if (fn.startsWith('sticker.')) return 'sticker';
  if (type === 'IMAGE') return 'imagem';
  if (type === 'VIDEO') return 'video';
  if (type === 'AUDIO') return 'audio';
  if (type === 'DOCUMENT') return 'documento';
  return 'midia';
}

/** Nome de arquivo para download — media_filename ou tipo+id+extensão do mime. */
export function resolverNomeArquivoMidia(message) {
  const nome = String(message?.mediaFilename ?? '').trim();
  if (nome) return nome.replace(/[\\/:*?"<>|]/g, '_');
  const id = message?.id ?? 'arquivo';
  const ext = extensaoFromMime(message?.mediaMimeType);
  return `${prefixoTipo(message)}-${id}.${ext}`;
}

/**
 * Download autenticado fresco via proxy (não depende de objectURL em cache).
 */
export async function baixarWhatsAppMediaViaProxy(message, mediaProxyUrl) {
  const proxy = mediaProxyUrl ?? resolverMediaProxyUrl(message);
  if (!proxy) {
    throw new Error('Mídia ainda não disponível para download.');
  }
  const blob = await buscarWhatsAppMediaBlob(proxy);
  dispararDownloadBlob(blob, resolverNomeArquivoMidia(message));
}

/** Safari/iOS frequentemente não reproduz audio/ogg; codecs=opus inline. */
export function navegadorReproduzAudioInline(mimeType) {
  if (typeof document === 'undefined') return true;
  const raw = String(mimeType ?? '').trim();
  const el = document.createElement('audio');
  const candidates = [];
  if (raw) candidates.push(raw);
  if (raw && !raw.includes('codecs=')) {
    const base = raw.split(';')[0].trim();
    if (base === 'audio/ogg') candidates.push('audio/ogg; codecs=opus');
    candidates.push(base);
  }
  if (!raw) candidates.push('audio/ogg; codecs=opus', 'audio/ogg');
  return candidates.some((m) => {
    const r = el.canPlayType(m);
    return r === 'probably' || r === 'maybe';
  });
}
