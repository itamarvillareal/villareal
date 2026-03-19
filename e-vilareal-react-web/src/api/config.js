/**
 * Base URL da API (backend Java).
 * Em desenvolvimento com Vite proxy, use '' para relativo.
 * Ou defina VITE_API_URL no .env (ex: http://localhost:8080).
 */
export const API_BASE_URL =
  import.meta.env.VITE_API_URL != null && import.meta.env.VITE_API_URL !== ''
    ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
    : '';
