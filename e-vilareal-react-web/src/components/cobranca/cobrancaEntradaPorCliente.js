import { padCliente8Cadastro } from '../../data/cadastroClientesStorage.js';

/** Clientes cuja cobrança automática usa PDF Condo Id (não planilha .xls). */
export const CLIENTES_COBRANCA_ENTRADA_PDF = Object.freeze(['00000928']);

export function clienteUsaEntradaPdfCobranca(codigoClienteRaw) {
  const cod = padCliente8Cadastro(codigoClienteRaw);
  return CLIENTES_COBRANCA_ENTRADA_PDF.includes(cod);
}
