/**
 * Hooks de pacote integrado — sem inserção de dados de demonstração (agenda/extratos).
 */

import {
  ensureHistoricoDemonstracaoDiagnostico,
  reaplicarDemonstracaoDiagnostico,
} from './processosHistoricoData.js';

export const DEMO_INTEGRADO_VERSION = 2;

const DEMO_INTEGRADO_VERSION_KEY = 'vilareal:demo-integrado:version';

export const DEMO_IMOVEL_ID = 1;

function seedAgendaDemoIntegrado() {}

function seedFinanceiroDemoIntegrado() {}

/**
 * @param {{ force?: boolean }} options
 */
export function ensureDemoIntegradoCompleto(options = {}) {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  const force = options.force === true;

  let prev = 0;
  try {
    prev = Number(window.localStorage.getItem(DEMO_INTEGRADO_VERSION_KEY) || '0');
  } catch {
    /* ignora */
  }

  if (!force && prev >= DEMO_INTEGRADO_VERSION) {
    return { ok: true, skipped: true };
  }

  try {
    ensureHistoricoDemonstracaoDiagnostico({ force: false });
  } catch {
    /* não bloqueia */
  }

  try {
    seedAgendaDemoIntegrado();
  } catch {
    /* não bloqueia */
  }

  try {
    seedFinanceiroDemoIntegrado();
  } catch {
    /* não bloqueia */
  }

  try {
    window.localStorage.setItem(DEMO_INTEGRADO_VERSION_KEY, String(DEMO_INTEGRADO_VERSION));
  } catch {
    /* ignora */
  }

  return { ok: true, force, prev };
}

export function reaplicarDemoIntegradoCompleto() {
  if (typeof window === 'undefined') return { ok: false, reason: 'no-window' };
  try {
    window.localStorage.removeItem(DEMO_INTEGRADO_VERSION_KEY);
  } catch {
    /* ignora */
  }
  const rProc = reaplicarDemonstracaoDiagnostico();
  const rInt = ensureDemoIntegradoCompleto({ force: true });
  return { ok: true, processos: rProc, integrado: rInt };
}
