import { useCallback, useEffect, useRef } from 'react';
import {
  categoriaParaMessageType,
  placeholderConteudoMidia,
  validarArquivoWhatsAppMedia,
} from '../utils/whatsappMediaSendUtils.js';
import {
  marcarEnvioMidiaFalhou,
  reconciliarEnvioMidia,
  revogarPreviewsLocaisEmLista,
  removerBolhaOtimista,
} from '../utils/whatsappMediaUtils.js';

function criarBolhaOtimistaMidia({ tempId, phone, file, caption, validation }) {
  const messageType = categoriaParaMessageType(validation.categoria);
  return {
    id: tempId,
    tempId,
    phoneNumber: phone,
    direction: 'OUTBOUND',
    status: 'SENT',
    messageType,
    mediaFilename: file.name,
    mediaMimeType: validation.mime,
    content: placeholderConteudoMidia(messageType, file.name, caption),
    mediaStatus: 'PENDING',
    createdAt: new Date().toISOString(),
    localPreviewUrl: URL.createObjectURL(file),
    pendingMediaFile: file,
  };
}

/**
 * Envio outbound de mídia com bolha otimista (preview local → proxy via SSE).
 */
export function useOptimisticMediaSend({ setMessages, sendMediaApi }) {
  const messagesRef = useRef([]);

  const trackMessages = useCallback(
    (updater) => {
      setMessages((prev) => {
        const next = typeof updater === 'function' ? updater(prev) : updater;
        messagesRef.current = next;
        return next;
      });
    },
    [setMessages],
  );

  useEffect(() => {
    return () => {
      revogarPreviewsLocaisEmLista(messagesRef.current);
    };
  }, []);

  const sendOptimisticMedia = useCallback(
    async ({ phone, file, caption }) => {
      const validation = validarArquivoWhatsAppMedia(file);
      if (!validation.ok) {
        return { ok: false, error: validation.erro };
      }

      const tempId = `local-${Date.now()}`;
      const optimistic = criarBolhaOtimistaMidia({
        tempId,
        phone,
        file,
        caption,
        validation,
      });

      trackMessages((prev) => [...prev, optimistic]);

      try {
        const res = await sendMediaApi(phone, file, caption?.trim() || undefined);
        if (res?.success === false) {
          trackMessages((prev) =>
            marcarEnvioMidiaFalhou(prev, tempId, res.error || 'Falha ao enviar mídia.', file),
          );
          return { ok: false, error: res.error || 'Falha ao enviar mídia.' };
        }

        trackMessages((prev) => reconciliarEnvioMidia(prev, tempId, res));
        return { ok: true, ...res };
      } catch (err) {
        const msg = err?.message || 'Falha ao enviar mídia.';
        trackMessages((prev) => marcarEnvioMidiaFalhou(prev, tempId, msg, file));
        return { ok: false, error: msg };
      }
    },
    [sendMediaApi, trackMessages],
  );

  const retryOptimisticMedia = useCallback(
    async (failedMessage) => {
      const file = failedMessage?.pendingMediaFile;
      const phone = failedMessage?.phoneNumber;
      if (!file || !phone) {
        return { ok: false, error: 'Arquivo indisponível para reenvio.' };
      }

      const tempId = failedMessage.tempId || failedMessage.id;
      trackMessages((prev) => removerBolhaOtimista(prev, tempId));

      const content = String(failedMessage.content ?? '').trim();
      const isPlaceholder =
        content.startsWith('📷') ||
        content.startsWith('📄') ||
        content.startsWith('🎵') ||
        content.startsWith('🎥');
      const caption = content && !isPlaceholder ? content : undefined;

      return sendOptimisticMedia({ phone, file, caption });
    },
    [sendOptimisticMedia, trackMessages],
  );

  return {
    sendOptimisticMedia,
    retryOptimisticMedia,
  };
}
