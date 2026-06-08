/**
 * URL base única para scripts de importação (import-real e sub-processos).
 * Prioridade: `--base-url=` > VILAREAL_API_BASE > localhost:8080 (backend dev).
 */
export function resolverBaseUrlImport(env = process.env) {
  return (env.VILAREAL_API_BASE || 'http://localhost:8080').replace(/\/$/, '');
}

/**
 * @param {string} baseUrl
 */
export async function verificarApiImportDisponivel(baseUrl) {
  const res = await fetch(`${baseUrl}/actuator/health`, {
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) {
    throw new Error(`Backend indisponível em ${baseUrl} (health ${res.status})`);
  }
}
