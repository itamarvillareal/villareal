/**
 * Resolve tribunal a partir do número CNJ (campos J e TR) e nome do índice DataJud.
 * Formato: NNNNNNN-DD.AAAA.J.TR.OOOO (TR = 2 dígitos, órgão de origem).
 */

/** J = segmento de justiça (Res. CNJ); TR = código do tribunal dentro do segmento. */
export function parseSegmentosCnj(cnjNormalizado) {
  const s = String(cnjNormalizado ?? '').trim().toUpperCase();
  const m = s.match(/^(\d{7})-(\d{2})\.(\d{4})\.(\d)\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  return {
    sequencial: m[1],
    dv: m[2],
    ano: m[3],
    segmentoJ: m[4],
    tribunalTR: m[5],
    origem: m[6],
    chaveJT: `${m[4]}.${m[5]}`,
  };
}

/**
 * Mapeamento TR (2 dígitos) → sufixo API DataJud para Justiça Estadual (J=8).
 * Referência: padrão api_publica_tj{uf} — cobertura parcial; expandir conforme necessidade.
 */
const TJ_TR_PARA_API = {
  '8.07': { sigla: 'TJDFT', nome: 'Tribunal de Justiça do DF e Territórios', apiIndex: 'api_publica_tjdft' },
  '8.09': { sigla: 'TJGO', nome: 'Tribunal de Justiça de Goiás', apiIndex: 'api_publica_tjgo' },
  '8.26': { sigla: 'TJSP', nome: 'Tribunal de Justiça de São Paulo', apiIndex: 'api_publica_tjsp' },
  '8.13': { sigla: 'TJMG', nome: 'Tribunal de Justiça de Minas Gerais', apiIndex: 'api_publica_tjmg' },
  '8.19': { sigla: 'TJRJ', nome: 'Tribunal de Justiça do Rio de Janeiro', apiIndex: 'api_publica_tjrj' },
  '8.05': { sigla: 'TJBA', nome: 'Tribunal de Justiça da Bahia', apiIndex: 'api_publica_tjba' },
  '8.24': { sigla: 'TJSC', nome: 'Tribunal de Justiça de Santa Catarina', apiIndex: 'api_publica_tjsc' },
  '8.43': { sigla: 'TJRS', nome: 'Tribunal de Justiça do Rio Grande do Sul', apiIndex: 'api_publica_tjrs' },
};

/** J=5 — TRT: TR = número do regional (01 a 24). */
function resolverTrt(j, tr) {
  if (j !== '5') return null;
  const n = parseInt(tr, 10);
  if (!Number.isFinite(n) || n < 1 || n > 24) return null;
  const num = String(n).padStart(2, '0');
  return {
    sigla: `TRT${num}`,
    nome: `Tribunal Regional do Trabalho da ${num}ª Região`,
    apiIndex: `api_publica_trt${n}`,
  };
}

/**
 * @returns {{ sigla: string, nome: string, apiIndex: string, tribunalPdf?: string } | null}
 */
export function resolverTribunalDatajudPorCnj(cnjNormalizado) {
  const p = parseSegmentosCnj(cnjNormalizado);
  if (!p) return null;
  const { segmentoJ, tribunalTR } = p;
  const k = `${segmentoJ}.${tribunalTR}`;
  if (segmentoJ === '8') {
    const tj = TJ_TR_PARA_API[k];
    if (tj) return { ...tj, tribunalPdf: tj.sigla };
    return {
      sigla: `TJ?(${tribunalTR})`,
      nome: 'Tribunal de Justiça (código não mapeado na API local)',
      apiIndex: null,
      tribunalPdf: null,
    };
  }
  const trt = resolverTrt(segmentoJ, tribunalTR);
  if (trt) return { ...trt, tribunalPdf: trt.sigla };
  return {
    sigla: `J${segmentoJ}.TR${tribunalTR}`,
    nome: 'Tribunal não mapeado para API pública',
    apiIndex: null,
    tribunalPdf: null,
  };
}

/** Extrai sigla tipo TJGO/TRT18 do campo Diário do PDF (texto livre). */
export function extrairTribunalTextualDoDiario(diarioStr) {
  const s = String(diarioStr ?? '').toUpperCase();
  const m = s.match(/\b(TRT\s*\d{1,2}|TJ[A-Z]{2,4}|TRF\s*\d|TST|STJ|STF|STM)\b/);
  if (m) return m[1].replace(/\s+/g, '');
  return null;
}
