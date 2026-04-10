import { useEffect } from 'react';

/**
 * useEffect com AbortController: ao mudar `deps` ou desmontar, `signal` é abortado.
 * O efeito pode retornar uma função de cleanup adicional.
 *
 * @param {(signal: AbortSignal) => void | (() => void)} effect
 * @param {import('react').DependencyList} deps
 */
export function useAbortableEffect(effect, deps) {
  useEffect(() => {
    const c = new AbortController();
    const extra = effect(c.signal);
    return () => {
      c.abort();
      if (typeof extra === 'function') extra();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- repassa deps do chamador
  }, deps);
}
