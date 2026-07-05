import { ETAPAS } from '../constants/financeiroConstants.js';
import {
  LETRAS_MODO_INCLUIR,
  letrasFiltroAtivo,
  normalizarLetrasFiltro,
} from './extratoLetrasFiltro.js';

/** Conta E sem par de compensação concluído (etapa ≠ COMPENSADO). */
export function linhaSemParCompensacao(row) {
  const conta = String(row?.contaCodigo ?? 'N').trim().toUpperCase() || 'N';
  if (conta !== 'E') return false;
  return String(row?.etapa ?? ETAPAS.IMPORTADO).trim().toUpperCase() !== ETAPAS.COMPENSADO;
}

/**
 * Somente E + Pendente = lançamentos na conta E aguardando par (não compensados).
 * Usado em Extrato e Total.
 */
export function filtroCompensacaoSemParAtivo({ letras, letrasModo, etapa } = {}) {
  if (String(etapa ?? '').trim().toUpperCase() !== ETAPAS.IMPORTADO) return false;
  if (letrasModo !== LETRAS_MODO_INCLUIR) return false;
  if (!letrasFiltroAtivo({ letras })) return false;
  const norm = normalizarLetrasFiltro(letras);
  return norm.length === 1 && norm[0] === 'E';
}
