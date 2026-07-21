import { useCallback, useEffect, useState } from 'react';
import { getWhatsAppStats } from '../../../repositories/whatsappRepository.js';

const DEFAULT_POLL_MS = 30_000;

/**
 * Estado da integração WhatsApp (token/phone configurados e API acessível).
 * Usado no cabeçalho global e no dashboard.
 */
export function useWhatsAppIntegrationStatus({ pollMs = DEFAULT_POLL_MS, enabled = true } = {}) {
  const [stats, setStats] = useState(null);
  const [loadOk, setLoadOk] = useState(false);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async (signal) => {
    try {
      const res = await getWhatsAppStats(signal);
      setStats(res);
      setLoadOk(true);
    } catch (err) {
      if (err?.name !== 'AbortError') {
        setLoadOk(false);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return undefined;

    const ac = new AbortController();
    void refresh(ac.signal);
    const interval = window.setInterval(() => void refresh(undefined), pollMs);

    return () => {
      ac.abort();
      window.clearInterval(interval);
    };
  }, [enabled, pollMs, refresh]);

  return {
    configured: Boolean(stats?.integrationConfigured),
    fetchedAt: stats?.fetchedAt ?? null,
    loadOk,
    loading: loading && !stats,
    stats,
    refresh,
  };
}
