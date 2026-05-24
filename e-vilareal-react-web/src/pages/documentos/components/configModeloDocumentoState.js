import { CIDADE_ESTADO_PADRAO } from '../constants.js';

export function pad8(cod) {
  const d = String(cod ?? '').replace(/\D/g, '');
  const n = Number(d || '1');
  const safe = Number.isFinite(n) && n > 0 ? Math.floor(n) : 1;
  return String(safe).padStart(8, '0');
}

export const estadoInicialConfigModelo = () => ({
  codigoCliente: '',
  numeroInterno: '',
  enderecamentoSelect: '',
  enderecamentoOutro: '',
  numeroProcesso: '',
  valorCausa: '',
  dataDocumento: new Date().toISOString().split('T')[0],
  cidadeEstado: CIDADE_ESTADO_PADRAO,
});
