/** Defaults e normalização compartilhados (sem dependência de storage/API). */

export const DEFAULT_CONFIG_CALCULO_CLIENTE = {
  honorariosTipo: 'fixos',
  honorariosValor: '0 %',
  honorariosVariaveisTexto: '> 30 = 0%\n< 30 < 60 = 10%\n< 60 = 20%',
  juros: '1 %',
  multa: '0 %',
  indice: 'INPC',
  periodicidade: 'mensal',
  modeloListaDebitos: '01',
  regraInicioCobrancaDias: 1,
  /** Origem da cobrança automática: planilha .xls ou PDF Condo Id. */
  entradaCobranca: 'XLS_INADIMPLENCIA',
};

/** Honorários «fixos» são percentual (20 %), nunca valor em R$. */
export function normalizarHonorariosValorFixo(val) {
  const raw = String(val ?? '').trim();
  if (!raw) return '0 %';
  if (/%/.test(raw)) {
    const n = raw.replace(/%/g, '').trim().replace(',', '.');
    const num = Number(n);
    if (Number.isFinite(num)) {
      const fmt = Number.isInteger(num) ? String(num) : String(num).replace('.', ',');
      return `${fmt} %`;
    }
    return raw;
  }
  const semMoeda = raw.replace(/^R\$\s*/i, '').trim();
  const num = Number(semMoeda.replace(',', '.'));
  if (Number.isFinite(num)) {
    const fmt = Number.isInteger(num) ? String(num) : String(num).replace('.', ',');
    return `${fmt} %`;
  }
  return raw;
}

export function normalizarRowConfigCalculo(row) {
  const out = { ...row };
  if (out.honorariosTipo !== 'variaveis') {
    out.honorariosValor = normalizarHonorariosValorFixo(out.honorariosValor);
  }
  return out;
}

/** Campos do painel Cálculos propagados entre dimensões. */
export const CAMPOS_PANEL_CONFIG_CALCULO = [
  'honorariosTipo',
  'honorariosValor',
  'honorariosVariaveisTexto',
  'juros',
  'multa',
  'indice',
  'periodicidade',
  'modeloListaDebitos',
];

export function extrairPanelConfig(obj) {
  const src = obj && typeof obj === 'object' ? obj : {};
  const out = {};
  for (const k of CAMPOS_PANEL_CONFIG_CALCULO) {
    if (src[k] !== undefined && src[k] !== null) out[k] = src[k];
  }
  return normalizarRowConfigCalculo({ ...DEFAULT_CONFIG_CALCULO_CLIENTE, ...out });
}
