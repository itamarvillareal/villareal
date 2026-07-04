import { useEffect, useState } from 'react';
import { normalizePhoneForApi } from '../../../utils/whatsappFormat.js';
import {
  acquireWhatsAppContactPhotoObjectUrl,
  releaseWhatsAppContactPhotoObjectUrl,
} from '../utils/whatsappContactPhotoUrlCache.js';

/**
 * Carrega foto de contato via proxy autenticado e expõe blob URL cacheada por telefone.
 *
 * @param {string|null|undefined} telefone
 * @param {string|null|undefined} contactPhotoUrl
 * @returns {{ url: string|null, loading: boolean, error: string|null }}
 */
export function useWhatsAppContactPhotoUrl(telefone, contactPhotoUrl) {
  const phone = normalizePhoneForApi(telefone) || String(telefone ?? '').trim();
  const proxyUrl = String(contactPhotoUrl ?? '').trim() || null;

  const [state, setState] = useState(() => ({
    url: null,
    loading: Boolean(proxyUrl && phone),
    error: null,
  }));

  useEffect(() => {
    if (!proxyUrl || !phone) {
      setState({ url: null, loading: false, error: null });
      return undefined;
    }

    let cancelled = false;
    setState({ url: null, loading: true, error: null });

    acquireWhatsAppContactPhotoObjectUrl(phone, proxyUrl)
      .then(({ url }) => {
        if (cancelled) return;
        setState({ url, loading: false, error: null });
      })
      .catch((err) => {
        if (cancelled) return;
        if (err?.name === 'AbortError') return;
        setState({
          url: null,
          loading: false,
          error: err?.message || 'Não foi possível carregar a foto.',
        });
      });

    return () => {
      cancelled = true;
      releaseWhatsAppContactPhotoObjectUrl(phone);
    };
  }, [phone, proxyUrl]);

  return state;
}
