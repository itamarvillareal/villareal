/**
 * Tribunal PJe a partir do CNJ (segmentos J e TR).
 * Espelha {@code PjeTribunalCnjResolver} no backend.
 */

export const PJE_GRAU_OPCOES = [
  { codigo: 'PRIMEIRO_GRAU', rotulo: '1º grau' },
  { codigo: 'SEGUNDO_GRAU', rotulo: '2º grau' },
];

/** @typedef {{ codigo: string, rotulo: string, automacaoDisponivel: boolean }} PjeTribunalOpcao */

/** @type {ReadonlyArray<PjeTribunalOpcao>} */
export const PJE_TRIBUNAL_OPCOES = [
  { codigo: 'PJE_TRT1', rotulo: 'TRT 1ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT2', rotulo: 'TRT 2ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT3', rotulo: 'TRT 3ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT4', rotulo: 'TRT 4ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT5', rotulo: 'TRT 5ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT6', rotulo: 'TRT 6ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT7', rotulo: 'TRT 7ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT8', rotulo: 'TRT 8ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT9', rotulo: 'TRT 9ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT10', rotulo: 'TRT 10ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT11', rotulo: 'TRT 11ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT12', rotulo: 'TRT 12ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT13', rotulo: 'TRT 13ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT14', rotulo: 'TRT 14ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT15', rotulo: 'TRT 15ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT16', rotulo: 'TRT 16ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT17', rotulo: 'TRT 17ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT18', rotulo: 'TRT 18ª Região', automacaoDisponivel: true },
  { codigo: 'PJE_TRT19', rotulo: 'TRT 19ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT20', rotulo: 'TRT 20ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT21', rotulo: 'TRT 21ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT22', rotulo: 'TRT 22ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT23', rotulo: 'TRT 23ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRT24', rotulo: 'TRT 24ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRF1', rotulo: 'TRF 1ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRF2', rotulo: 'TRF 2ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRF3', rotulo: 'TRF 3ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRF4', rotulo: 'TRF 4ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRF5', rotulo: 'TRF 5ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TRF6', rotulo: 'TRF 6ª Região', automacaoDisponivel: false },
  { codigo: 'PJE_TJDFT', rotulo: 'TJDFT', automacaoDisponivel: false },
  { codigo: 'PJE_TJGO', rotulo: 'TJGO', automacaoDisponivel: false },
  { codigo: 'PJE_TJMG', rotulo: 'TJMG', automacaoDisponivel: false },
  { codigo: 'PJE_TJRJ', rotulo: 'TJRJ', automacaoDisponivel: false },
  { codigo: 'PJE_TJSP', rotulo: 'TJSP', automacaoDisponivel: false },
  { codigo: 'PJE_TJPR', rotulo: 'TJPR', automacaoDisponivel: false },
  { codigo: 'PJE_TJSC', rotulo: 'TJSC', automacaoDisponivel: false },
  { codigo: 'PJE_TJRS', rotulo: 'TJRS', automacaoDisponivel: false },
  { codigo: 'PJE_TJBA', rotulo: 'TJBA', automacaoDisponivel: false },
];

const CNJ_J_TR_MAP = Object.fromEntries(
  PJE_TRIBUNAL_OPCOES.map((o) => {
    const m = o.codigo.match(/^PJE_TRT(\d+)$/);
    if (m) return [`5.${String(m[1]).padStart(2, '0')}`, o.codigo];
    const trf = o.codigo.match(/^PJE_TRF(\d+)$/);
    if (trf) return [`4.${String(trf[1]).padStart(2, '0')}`, o.codigo];
    const tj = {
      PJE_TJDFT: '8.07',
      PJE_TJGO: '8.09',
      PJE_TJMG: '8.13',
      PJE_TJRJ: '8.19',
      PJE_TJSP: '8.26',
      PJE_TJPR: '8.16',
      PJE_TJSC: '8.24',
      PJE_TJRS: '8.21',
      PJE_TJBA: '8.05',
    }[o.codigo];
    return tj ? [tj, o.codigo] : null;
  }).filter(Boolean)
);

/**
 * @param {string} cnjRaw
 * @returns {{ codigo: string|null, rotulo: string, mapeado: boolean }}
 */
export function detectarPjeTribunalPorCnj(cnjRaw) {
  const cnj = String(cnjRaw ?? '').trim().toUpperCase();
  const m = cnj.match(/^\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}$/);
  let chave = null;
  if (m) {
    chave = `${m[1]}.${m[2]}`;
  } else if (cnj.includes('.')) {
    const partes = cnj.split('.');
    if (partes.length >= 4 && partes[1]?.length === 1 && partes[2]?.length === 2) {
      chave = `${partes[1]}.${partes[2]}`;
    }
  }
  if (!chave) {
    return { codigo: null, rotulo: 'PJe (tribunal não mapeado)', mapeado: false };
  }
  const codigo = CNJ_J_TR_MAP[chave] ?? null;
  if (!codigo) {
    return { codigo: null, rotulo: 'PJe (tribunal não mapeado)', mapeado: false };
  }
  const op = PJE_TRIBUNAL_OPCOES.find((t) => t.codigo === codigo);
  return { codigo, rotulo: op?.rotulo ?? codigo, mapeado: true };
}

export function rotuloPjeTribunal(codigo) {
  if (!codigo) return 'PJe (tribunal não mapeado)';
  const op = PJE_TRIBUNAL_OPCOES.find((t) => t.codigo === codigo);
  return op?.rotulo ?? codigo;
}

export function tribunalPjeAutomacaoDisponivel(codigo) {
  const op = PJE_TRIBUNAL_OPCOES.find((t) => t.codigo === codigo);
  return op?.automacaoDisponivel === true;
}
