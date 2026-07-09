/**
 * Extração heurística de contratos de honorários Villa Real (sem IA).
 * Funciona bem para PDFs gerados pelo modelo padrão do escritório.
 */

const MESES_PT = {
  janeiro: 1,
  fevereiro: 2,
  março: 3,
  marco: 3,
  abril: 4,
  maio: 5,
  junho: 6,
  julho: 7,
  agosto: 8,
  setembro: 9,
  outubro: 10,
  novembro: 11,
  dezembro: 12,
};

const RE_CNJ = /\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}/;
const RE_CLAUSULA_3 = /Cl[aá]usula\s*3[ªa]\.?\s*(.+?)(?=Cl[aá]usula\s*4|$)/is;
const RE_OBJETO = /OBJETO\s+a\s+presta[cç][aã]o\s+de\s+servi[cç]os\s+advocat[ií]cios,\s*(.+?)\s+at[eé]\s+Senten[cç]a/is;
const RE_CONTRATANTE = /como\s+CONTRATANTE,\s*([^,]+)/i;
const RE_DATA_CONTRATO =
  /An[aá]polis,\s*estado\s+de\s+Goi[aá]s,\s*(\d{1,2}\s+de\s+\w+\s+de\s+\d{4}|\d{1,2}\/\d{1,2}\/\d{4})/i;

export function normalizarTextoContrato(texto) {
  return String(texto ?? '')
    .replace(/\r/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

export function extrairClausula3(texto) {
  const m = normalizarTextoContrato(texto).match(RE_CLAUSULA_3);
  return m ? m[1].trim() : '';
}

export function extrairCnj(texto) {
  const m = normalizarTextoContrato(texto).match(RE_CNJ);
  return m ? m[0] : null;
}

export function parseDataBr(dataStr) {
  if (!dataStr) return null;
  const s = dataStr.trim();
  const slash = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (slash) {
    const [, d, m, y] = slash;
    return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  const extenso = s.match(/^(\d{1,2})\s+de\s+(\w+)\s+de\s+(\d{4})$/i);
  if (extenso) {
    const mes = MESES_PT[extenso[2].toLowerCase()];
    if (!mes) return null;
    return `${extenso[3]}-${String(mes).padStart(2, '0')}-${extenso[1].padStart(2, '0')}`;
  }
  return null;
}

function parseMoedaBr(raw) {
  if (!raw) return null;
  const n = Number(raw.replace(/\./g, '').replace(',', '.').replace(/[^\d.]/g, ''));
  return Number.isFinite(n) ? n : null;
}

function detectarFormaPagamento(clausula3) {
  const t = clausula3.toLowerCase();
  if (/\bboletos?\b/.test(t)) return 'BOLETO';
  if (/\bpix\b/.test(t)) return 'PIX';
  return null;
}

function detectarFormaAssinatura(texto) {
  if (/via\s+digital|assinatura\s+digital/i.test(texto)) return 'via_digital';
  return 'duas_vias';
}

function extrairRemuneracaoClausula3(clausula3) {
  const out = {
    tipoRemuneracao: null,
    percentualProveito: null,
    valorFixo: null,
    temParcelamento: false,
    gerarRecebiveis: false,
    quantidadeParcelas: null,
    valorTotalParcelas: null,
    primeiroVencimento: null,
    intervaloParcelas: null,
    formaPagamento: detectarFormaPagamento(clausula3),
  };

  const pctMatch =
    clausula3.match(/import[aâ]ncia\s+de\s+(\d{1,3})\s*%/i) ||
    clausula3.match(/(\d{1,3})\s*%\s*\(/);
  if (pctMatch) out.percentualProveito = Number(pctMatch[1]);

  const valorRs = clausula3.match(/R\$\s*([\d.,]+)/i);
  const valor = valorRs ? parseMoedaBr(valorRs[1]) : null;

  const mensalMatch = clausula3.match(
    /R\$\s*([\d.,]+)[^;]{0,120}?mensais?,\s*com\s+dura[cç][aã]o\s+de\s+(\d+)\s+meses/i,
  );
  if (mensalMatch) {
    const parcela = parseMoedaBr(mensalMatch[1]);
    const meses = Number(mensalMatch[2]);
    out.tipoRemuneracao = 'VALOR_FIXO';
    out.valorFixo = parcela;
    out.temParcelamento = true;
    out.gerarRecebiveis = true;
    out.quantidadeParcelas = meses;
    out.valorTotalParcelas = parcela != null ? parcela * meses : null;
    out.intervaloParcelas = 'MENSAL';
    const ini = clausula3.match(/iniciando\s+em\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (ini) out.primeiroVencimento = parseDataBr(ini[1]);
    return out;
  }

  const parcelasNovas = clausula3.match(
    /(\d+)\s+parcelas?\s+mensais?\s+de\s+R\$\s*([\d.,]+)/i,
  );
  if (parcelasNovas) {
    const qtd = Number(parcelasNovas[1]);
    const parcela = parseMoedaBr(parcelasNovas[2]);
    out.tipoRemuneracao = out.percentualProveito != null ? 'MISTO' : 'VALOR_FIXO';
    if (out.valorFixo == null) out.valorFixo = parcela;
    out.temParcelamento = true;
    out.gerarRecebiveis = true;
    out.quantidadeParcelas = qtd;
    out.valorTotalParcelas = parcela != null ? parcela * qtd : null;
    out.intervaloParcelas = 'MENSAL';
    const venc = clausula3.match(/vencendo\s+a\s+primeira\s+em\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (venc) out.primeiroVencimento = parseDataBr(venc[1]);
    return out;
  }

  const parcelaUnica = clausula3.match(/parcela\s+[uú]nica\s+de\s+R\$\s*([\d.,]+)/i);
  if (parcelaUnica) {
    const parcela = parseMoedaBr(parcelaUnica[1]);
    out.tipoRemuneracao = out.percentualProveito != null ? 'MISTO' : 'VALOR_FIXO';
    if (out.valorFixo == null) out.valorFixo = parcela;
    out.temParcelamento = true;
    out.gerarRecebiveis = true;
    out.quantidadeParcelas = 1;
    out.valorTotalParcelas = parcela;
    out.intervaloParcelas = 'UNICA';
    const venc = clausula3.match(/vencimento\s+em\s+(\d{1,2}\/\d{1,2}\/\d{4})/i);
    if (venc) out.primeiroVencimento = parseDataBr(venc[1]);
    return out;
  }

  if (out.percentualProveito != null && valor != null) {
    out.tipoRemuneracao = 'MISTO';
    out.valorFixo = valor;
    return out;
  }
  if (out.percentualProveito != null) {
    out.tipoRemuneracao = 'PERCENTUAL_PROVEITO';
    return out;
  }
  if (valor != null) {
    out.tipoRemuneracao = 'VALOR_FIXO';
    out.valorFixo = valor;
    return out;
  }
  return out;
}

export function calcularScore(dados, alertas = []) {
  if (!dados?.tipoRemuneracao) return 0;
  let pts = 40;
  pts += 20;
  if (dados.percentualProveito != null || dados.valorFixo != null) pts += 20;
  if (dados.dataContrato) pts += 10;
  if (dados.numeroCnjExtraido) pts += 5;
  if (dados.objetoContrato) pts += 5;
  if (alertas.some((a) => /falha|não foi possível|não localizada/i.test(a))) pts -= 25;
  return Math.max(0, Math.min(100, pts));
}

/**
 * @param {string} texto Texto completo do PDF
 * @returns {{ dados: object, clausulaExtraida: string, alertas: string[], scoreConfianca: number }}
 */
export function extrairContratoHonorariosHeuristico(texto) {
  const alertas = [];
  const norm = normalizarTextoContrato(texto);
  if (!norm) {
    alertas.push('Não foi possível extrair texto do PDF.');
    return { dados: null, clausulaExtraida: '', alertas, scoreConfianca: 0 };
  }

  const clausulaExtraida = extrairClausula3(norm);
  if (!clausulaExtraida) {
    alertas.push('Cláusula 3 não localizada — modelo fora do padrão Villa Real.');
  }

  const remuneracao = extrairRemuneracaoClausula3(clausulaExtraida || norm);
  const objetoMatch = norm.match(RE_OBJETO);
  const contratanteMatch = norm.match(RE_CONTRATANTE);
  const dataMatch = norm.match(RE_DATA_CONTRATO);
  const cnj = extrairCnj(norm);

  const dados = {
    ...remuneracao,
    dataContrato: dataMatch ? parseDataBr(dataMatch[1]) : null,
    objetoContrato: objetoMatch ? objetoMatch[1].replace(/\s+/g, ' ').trim() : null,
    formaAssinatura: detectarFormaAssinatura(norm),
    numeroCnjExtraido: cnj,
    partesExtraidas: contratanteMatch ? contratanteMatch[1].replace(/\s+/g, ' ').trim() : null,
    temCasoVinculado: Boolean(cnj || /processo|embargos|execu[cç][aã]o|demanda/i.test(objetoMatch?.[1] ?? '')),
  };

  if (!dados.tipoRemuneracao) {
    alertas.push('Tipo de remuneração não identificado na cláusula 3.');
  }
  if (!dados.dataContrato) {
    alertas.push('Data do contrato não encontrada (padrão Anápolis, estado de Goiás, …).');
  }

  return {
    dados,
    clausulaExtraida,
    alertas,
    scoreConfianca: calcularScore(dados, alertas),
  };
}
