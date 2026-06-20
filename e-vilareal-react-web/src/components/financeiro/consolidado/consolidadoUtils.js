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
  return ultimosNMeses(12);
}

/** Últimos N meses calendário (do mais antigo ao mais recente). */
export function ultimosNMeses(qtd) {
  const n = Math.max(1, Math.min(Number(qtd) || 12, 24));
  const out = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i -= 1) {
    const x = new Date(d.getFullYear(), d.getMonth() - i, 1);
    const mes = x.getMonth() + 1;
    const ano = x.getFullYear();
    out.push({
      mesKey: `${ano}-${String(mes).padStart(2, '0')}`,
      ano,
      mes,
      label: `${MESES_CURTOS[mes - 1]}`,
      labelAno: `${MESES_CURTOS[mes - 1]}/${String(ano).slice(-2)}`,
    });
  }
  return out;
}

/** Monta série do gráfico de evolução (conta única ou comparativo). */
export function buildPontosGraficoConsolidado({
  resumo,
  codigoAtivo,
  qtdMeses = 12,
  serie = 'saldo',
  comparar = false,
}) {
  const mesesRef = ultimosNMeses(qtdMeses);
  const labelMes = (m) => (qtdMeses > 12 ? m.labelAno : m.label);
  const rows = Array.isArray(resumo?.meses) ? resumo.meses : [];
  const valorDe = (hit) =>
    hit != null
      ? Number(serie === 'saldo' ? hit.saldoMes : hit.quantidadeLancamentos) || 0
      : 0;

  if (!comparar) {
    const cod = String(codigoAtivo ?? 'A').trim().toUpperCase();
    const porMes = new Map(
      rows
        .filter((r) => String(r.contaCodigo ?? '').trim().toUpperCase() === cod)
        .map((r) => [`${r.ano}-${r.mes}`, r]),
    );
    return {
      pontos: mesesRef.map((m) => {
        const hit = porMes.get(`${m.ano}-${m.mes}`);
        return {
          ...m,
          label: labelMes(m),
          valor: valorDe(hit),
          saldo: hit != null ? Number(hit.saldoMes) || 0 : 0,
          total: hit != null ? Number(hit.quantidadeLancamentos) || 0 : 0,
        };
      }),
      seriesKeys: ['valor'],
    };
  }

  const contas = [
    ...new Set(
      rows
        .map((r) => String(r.contaCodigo ?? '').trim().toUpperCase())
        .filter(Boolean),
    ),
  ].sort();
  const idx = new Map(rows.map((r) => [`${r.contaCodigo}|${r.ano}-${r.mes}`, r]));
  return {
    pontos: mesesRef.map((m) => {
      const ponto = { ...m, label: labelMes(m) };
      for (const cod of contas) {
        const hit = idx.get(`${cod}|${m.ano}-${m.mes}`);
        ponto[cod] = valorDe(hit);
      }
      return ponto;
    }),
    seriesKeys: contas,
  };
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
