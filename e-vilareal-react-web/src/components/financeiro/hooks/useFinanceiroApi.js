import { useCallback, useRef, useState } from 'react';
import { request } from '../../../api/httpClient.js';

const CACHE_TTL_MS = 30_000;

export function useFinanceiroApi() {
  const cacheRef = useRef(new Map());
  const [isLoading, setIsLoading] = useState(false);

  const invalidate = useCallback((prefix) => {
    if (!prefix) {
      cacheRef.current.clear();
      return;
    }
    for (const key of cacheRef.current.keys()) {
      if (key.startsWith(prefix)) cacheRef.current.delete(key);
    }
  }, []);

  const fetchJson = useCallback(
    async (path, { query, method = 'GET', body, signal, cacheKey } = {}) => {
      const key = cacheKey ?? `${method}:${path}:${JSON.stringify(query ?? {})}`;
      if (method === 'GET') {
        const hit = cacheRef.current.get(key);
        if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.data;
      }

      setIsLoading(true);
      try {
        const data = await request(path, { method, query, body, signal });
        if (method === 'GET') {
          cacheRef.current.set(key, { at: Date.now(), data });
        } else {
          invalidate('/api/financeiro');
        }
        return data;
      } finally {
        setIsLoading(false);
      }
    },
    [invalidate],
  );

  return { fetchJson, isLoading, invalidate };
}
