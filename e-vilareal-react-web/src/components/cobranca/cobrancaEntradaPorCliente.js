import { loadConfigCalculoCliente } from '../../data/clienteConfigCalculoStorage.js';

/** Valores alinhados a {@code calculo_cliente_config.payload_json.entradaCobranca} (backend). */
export const ENTRADA_COBRANCA_XLS = 'XLS_INADIMPLENCIA';
export const ENTRADA_COBRANCA_PDF = 'PDF_CONDO_ID';

/**
 * Origem da cobrança automática do cliente (config por cliente, não lista hardcoded).
 * @param {string} codigoClienteRaw
 * @returns {'XLS_INADIMPLENCIA' | 'PDF_CONDO_ID'}
 */
export function entradaCobrancaDoCliente(codigoClienteRaw) {
  const cfg = loadConfigCalculoCliente(codigoClienteRaw);
  return cfg.entradaCobranca === ENTRADA_COBRANCA_PDF ? ENTRADA_COBRANCA_PDF : ENTRADA_COBRANCA_XLS;
}

/** @param {string} codigoClienteRaw */
export function clienteUsaEntradaPdfCobranca(codigoClienteRaw) {
  return entradaCobrancaDoCliente(codigoClienteRaw) === ENTRADA_COBRANCA_PDF;
}
