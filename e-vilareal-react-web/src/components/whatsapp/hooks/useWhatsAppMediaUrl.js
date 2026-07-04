import { useEffect, useState } from 'react';
import { resolverMediaProxyUrl } from '../utils/whatsappMediaUtils.js';
import {
  acquireWhatsAppMediaObjectUrl,
  releaseWhatsAppMediaObjectUrl,
} from '../utils/whatsappMediaUrlCache.js';

/**
 * Carrega mídia WhatsApp via proxy autenticado e expõe blob URL cacheada por messageId.
 *
 * @param {{ id?: number|string, mediaProxyUrl?: string|null, messageType?: string, mediaId?: string }} message
 * @returns {{ url: string|null, blob: Blob|null, loading: boolean, error: string|null }}
 */
export function useWhatsAppMediaUrl(message) {
  const messageId = message?.id;
  const mediaProxyUrl = resolverMediaProxyUrl(message);

  const [state, setState] = useState(() => ({
    url: null,
    blob: null,
    loading: Boolean(mediaProxyUrl && messageId != null),
    error: null,
  }));

  useEffect(() => {
    if (message?.localPreviewUrl) {
      setState({ url: null, blob: null, loading: false, error: null });
      return undefined;
    }
    if (!mediaProxyUrl || messageId == null) {
      setState({ url: null, blob: null, loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    setState({
      url: null,
      blob: null,
      loading: true,
      error: null,
    });

    acquireWhatsAppMediaObjectUrl(messageId, mediaProxyUrl)
      .then(({ url, blob }) => {
        if (cancelled) return;
        setState({ url, blob, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === 'AbortError') return;
        setState({
          url: null,
          blob: null,
          loading: false,
          error: err?.message || 'Não foi possível carregar a mídia.',
        });
      });

    return () => {
      cancelled = true;
      releaseWhatsAppMediaObjectUrl(messageId);
    };
  }, [messageId, mediaProxyUrl]);

  return state;
}
