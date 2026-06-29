import { useCallback, useEffect, useState } from 'react';
import { WHATSAPP_TEMPLATES } from '../../../data/whatsappTemplates.js';
import { getWhatsAppTemplates } from '../../../repositories/whatsappRepository.js';
import { mapApiTemplateToLocal } from '../../../utils/whatsappTemplateUtils.js';

/**
 * Carrega templates da Meta via API; usa array fixo local como fallback.
 * @param {{ approvedOnly?: boolean, autoRefreshMs?: number }} options
 */
export function useWhatsAppTemplates(options = {}) {
  const { approvedOnly = false, autoRefreshMs = 0 } = options;
  const [templates, setTemplates] = useState(WHATSAPP_TEMPLATES);
  const [allTemplates, setAllTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromApi, setFromApi] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async (signal) => {
    setLoading(true);
    setError('');
    try {
      const list = await getWhatsAppTemplates(signal);
      const mapped = (Array.isArray(list) ? list : []).map(mapApiTemplateToLocal);
      setAllTemplates(mapped);
      const filtered = approvedOnly
        ? mapped.filter((t) => String(t.status).toUpperCase() === 'APPROVED')
        : mapped;
      if (filtered.length > 0) {
        setTemplates(filtered);
        setFromApi(true);
      } else if (approvedOnly && mapped.length === 0) {
        setTemplates(WHATSAPP_TEMPLATES);
        setFromApi(false);
      } else {
        setTemplates(filtered);
        setFromApi(true);
      }
    } catch (err) {
      setError(err?.message || 'Falha ao carregar templates.');
      setTemplates(WHATSAPP_TEMPLATES);
      setAllTemplates([]);
      setFromApi(false);
    } finally {
      setLoading(false);
    }
  }, [approvedOnly]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!autoRefreshMs || autoRefreshMs <= 0) return undefined;
    const interval = window.setInterval(() => load(), autoRefreshMs);
    return () => window.clearInterval(interval);
  }, [autoRefreshMs, load]);

  return { templates, allTemplates, loading, fromApi, error, reload: load };
}
