import { normalizarMediaStatus } from './whatsappMediaUtils.js';

const TIPOS_MIDIA = new Set(['IMAGE', 'DOCUMENT', 'AUDIO', 'VIDEO']);

/**
 * Indica se a mensagem pode ser encaminhada.
 * @param {object|null|undefined} message
 * @returns {boolean}
 */
export function podeEncaminharMensagem(message) {
  if (!message?.id || message.id <= 0) return false;

  const type = String(message.messageType ?? '').toUpperCase();
  if (type === 'UNSUPPORTED' || type === 'UNKNOWN') return false;

  if (!TIPOS_MIDIA.has(type)) return true;

  const direction = String(message.direction ?? '').toUpperCase();
  if (direction === 'OUTBOUND') return true;

  const status = normalizarMediaStatus(message);
  if (status === 'DONE') return true;
  if (message.mediaDriveFileId || message.mediaDriveUrl) return true;

  return status !== 'PENDING' && status !== 'FAILED';
}

/**
 * Motivo quando o encaminhamento não está disponível.
 * @param {object|null|undefined} message
 * @returns {string|null}
 */
export function motivoEncaminharIndisponivel(message) {
  if (podeEncaminharMensagem(message)) return null;

  const type = String(message?.messageType ?? '').toUpperCase();
  if (type === 'UNSUPPORTED' || type === 'UNKNOWN') {
    return 'Este tipo de conteúdo não pode ser encaminhado.';
  }
  if (TIPOS_MIDIA.has(type)) {
    const status = normalizarMediaStatus(message);
    if (status === 'PENDING') {
      return 'Aguarde o download da mídia antes de encaminhar.';
    }
    if (status === 'FAILED') {
      return 'A mídia falhou no download. Use «Tentar novamente» antes de encaminhar.';
    }
    return 'Arquivo de mídia indisponível.';
  }
  return 'Mensagem indisponível para encaminhar.';
}
