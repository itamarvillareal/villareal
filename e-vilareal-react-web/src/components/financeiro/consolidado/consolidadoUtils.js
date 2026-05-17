import { CONTAS_LETRAS, nomeContaPorLetra } from '../constants/financeiroConstants.js';

export { CONTAS_LETRAS };

const MESES_CURTOS = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];

/** Cores hex para Recharts (espelho de financeiro-tokens.css). */
export const CONTA_CHART_HEX = {
  A: '#3b82f6',
  B: '#8b5cf6',
  C: '#06b6d4',
  D: '#10b981',
  E: '#f59e0b',
  F: '#6366f1',
  G: '#64748b',
  I: '#d946ef',
  J: '#14b8a6',
  M: '#ea580c',
  N: '#ef4444',
  P: '#0ea5e9',
  R: '#ec4899',
};

export function contaChartColor(codigo) {
  return CONTA_CHART_HEX[String(codigo ?? 'N').toUpperCase()] ?? '#64748b';
}

export function labelContaTab(codigo) {
  return nomeContaPorLetra(codigo) ?? `Conta ${codigo}`;
}

export function mesAtualIso() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export function ultimos12Meses() {
  const out = [];
  const d = new Date();
  for (let i = 11; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const mes = x.getMonth() + 1;
    const ano = x.getFullYear();
    const mesKey = `${ano}-${String(mes).padStart(2, '0')}`;
    out.push({
      mesKey,
      ano,
      mes,
      label: `${MESES_CURTOS[mes - 1]}`,
      labelAno: `${MESES_CURTOS[mes - 1]}/${String(ano).slice(-2)}`,
    });
  }
  return out;
}

export function somaLancamentosApi(content) {
  let creditos = 0;
  let debitos = 0;
  for (const l of content ?? []) {
    const v = Math.abs(Number(l.valor ?? 0));
    if (String(l.natureza ?? '').toUpperCase() === 'DEBITO') debitos += v;
    else creditos += v;
  }
  return { creditos, debitos, saldo: creditos - debitos };
}
