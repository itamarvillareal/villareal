/**
 * Parser e classificador de blocos zerados da aba "LANÇ MANUAIS (2)" (Etapa 5e).
 */

import XLSX from 'xlsx';
import { requireExtratoBancosPlanilhaXlsPath } from './resolve-extrato-bancos-planilha-xls.mjs';
import { excelSerialParaISO, normalizarRefTipo } from './extrato-bancos-planilha-parse.mjs';

export const ABA_LANC_MANUAIS = 'LANÇ MANUAIS (2)';

/** Blocos multi-cliente — revisão manual (728). */
export const BLOCOS_PULAR_GLOBAL = new Set([7783]);

export function normalizarRef01(v) {
  const s = String(v ?? '').trim();
  if (!s) return '';
  if (/^\d+\.0$/.test(s)) return s.slice(0, -2);
  return s;
}

export function isCodigoNumerico(ref01) {
  return Boolean(ref01 && /^\d+$/.test(ref01));
}

export function prefixoGrupoCard(codigo) {
  return `CZ-B${String(codigo).trim()}`;
}

export function nomeGrupoCard(codigo, startRowId) {
  return `${prefixoGrupoCard(codigo)}-${startRowId}`;
}

export function validarSomaAcumuladaZero(linhas) {
  const soma = linhas.reduce((s, l) => s + l.cents, 0);
  if (soma !== 0) {
    throw new Error(
      `Recorte da planilha não soma zero (soma=${(soma / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`,
    );
  }
}

/** Garante que o recorte não termina com bloco parcial (soma acumulada ≠ 0). */
export function assertBlocosCompletosNoRecorte({ blocos, foraDeBloco }, { ateLinhaExcel = null } = {}) {
  if (ateLinhaExcel != null && foraDeBloco > 0) {
    throw new Error(
      `Recorte até linha Excel ${ateLinhaExcel} termina com bloco parcial (${foraDeBloco} linha(s) fora de bloco)`,
    );
  }
  return blocos;
}

export function lerLinhasPlanilha(
  caminho = requireExtratoBancosPlanilhaXlsPath(),
  { ateLinhaExcel = null, validarSomaZero = false } = {},
) {
  const wb = XLSX.readFile(caminho, { cellDates: false });
  const nomeAba = wb.SheetNames.find((n) => n.trim().toUpperCase() === ABA_LANC_MANUAIS.toUpperCase());
  if (!nomeAba) throw new Error(`Aba "${ABA_LANC_MANUAIS}" não encontrada`);
  const ws = wb.Sheets[nomeAba];
  const range = XLSX.utils.decode_range(ws['!ref']);
  const cell = (r, c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

  const maxR = ateLinhaExcel != null ? ateLinhaExcel - 1 : range.e.r;
  if (ateLinhaExcel != null && maxR < 6) {
    throw new Error(`ateLinhaExcel=${ateLinhaExcel} inválido (dados começam na linha Excel 7)`);
  }

  const linhas = [];
  for (let r = 6; r <= maxR; r += 1) {
    const valor = cell(r, 7);
    const rowId = cell(r, 4);
    if (typeof valor !== 'number' || !Number.isFinite(valor) || typeof rowId !== 'number') continue;
    linhas.push({
      rowId,
      cents: Math.round(valor * 100),
      dataIso: excelSerialParaISO(cell(r, 3)),
      comentario: String(cell(r, 9) ?? '').trim(),
      procPlanilha: Number(cell(r, 12)) > 0 ? Math.trunc(Number(cell(r, 12))) : null,
      refTipo: normalizarRefTipo(cell(r, 13)),
      ref01: normalizarRef01(cell(r, 11)),
    });
  }
  if (validarSomaZero) validarSomaAcumuladaZero(linhas);
  return { caminho, linhas, ateLinhaExcel };
}

export function montarBlocosZerados(linhas) {
  const blocos = [];
  let atual = [];
  let soma = 0;
  for (const l of linhas) {
    atual.push(l);
    soma += l.cents;
    if (soma === 0) {
      blocos.push(atual);
      atual = [];
      soma = 0;
    }
  }
  return { blocos, foraDeBloco: atual.length };
}

export function listarCodigosNumericos(blocos) {
  const set = new Set();
  for (const b of blocos) {
    for (const l of b) {
      if (isCodigoNumerico(l.ref01)) set.add(l.ref01);
    }
  }
  return [...set].sort((a, b) => Number(a) - Number(b));
}

/**
 * Classifica bloco do ponto de vista de um codigo_cliente planilha.
 * OK — só linhas do cliente, soma zero
 * ESPELHO — bloco inteiro zera com espelho(s) ref vazia ou única ref não-numérica
 * MISTO — multi-cliente numérico ou bloco na fila manual
 * ERRO — soma do bloco ≠ 0 ou linhas cliente não fecham com espelhos esperados
 */
export function classificarBlocoCliente(bloco, codigo, { blocosPular = BLOCOS_PULAR_GLOBAL } = {}) {
  const linhasCliente = bloco.filter((l) => l.ref01 === codigo);
  const outras = bloco.filter((l) => l.ref01 !== codigo);
  const startRowId = linhasCliente[0]?.rowId ?? null;
  const somaCliente = linhasCliente.reduce((s, l) => s + l.cents, 0) / 100;
  const somaOutras = outras.reduce((s, l) => s + l.cents, 0) / 100;
  const somaBloco = bloco.reduce((s, l) => s + l.cents, 0) / 100;

  const base = {
    codigo,
    startRowId,
    linhasCliente,
    outras,
    linhasCard: linhasCliente,
    somaCliente,
    somaOutras,
    somaBloco,
    grupoAlvo: startRowId != null ? nomeGrupoCard(codigo, startRowId) : null,
  };

  if (linhasCliente.length === 0) return { ...base, tipo: 'VAZIO' };
  if (startRowId != null && blocosPular.has(startRowId)) {
    return { ...base, tipo: 'MISTO', motivo: 'bloco_pular_manual' };
  }

  const refsNumericasOutras = new Set(
    outras.map((l) => l.ref01).filter((r) => isCodigoNumerico(r)),
  );
  if (refsNumericasOutras.size > 0) {
    return { ...base, tipo: 'MISTO', motivo: 'multi_cliente_numerico' };
  }

  if (Math.abs(somaCliente) < 0.005 && outras.length === 0) {
    return { ...base, tipo: 'OK', linhasCard: linhasCliente };
  }

  const refsOutras = new Set(outras.map((l) => l.ref01).filter(Boolean));
  if (refsOutras.size > 1) {
    return { ...base, tipo: 'MISTO', motivo: 'multi_ref_nao_numerica' };
  }

  if (Math.abs(somaBloco) < 0.005) {
    return { ...base, tipo: 'ESPELHO', linhasCard: bloco };
  }

  return { ...base, tipo: 'ERRO', motivo: 'soma_nao_fecha' };
}

/** Gera jobs (codigo + bloco) para todos os códigos numéricos ou filtro. */
export function gerarJobsCards(blocos, { codigo = null, blocosPular = BLOCOS_PULAR_GLOBAL } = {}) {
  const codigos = codigo ? [String(codigo)] : listarCodigosNumericos(blocos);
  const jobs = [];
  for (const c of codigos) {
    for (const bloco of blocos) {
      if (!bloco.some((l) => l.ref01 === c)) continue;
      const info = classificarBlocoCliente(bloco, c, { blocosPular });
      if (info.tipo === 'VAZIO') continue;
      jobs.push({ bloco, ...info });
    }
  }
  return jobs;
}

export function primeiraRefNumericaBloco(bloco) {
  for (const l of bloco) {
    if (isCodigoNumerico(l.ref01)) return l.ref01;
  }
  return null;
}

/** Bloco exige card único forçado (multi-cliente, multi-ref ou fila manual). */
export function blocoPrecisaForcarAuto(bloco, { blocosPular = BLOCOS_PULAR_GLOBAL } = {}) {
  const startRowId = bloco[0]?.rowId;
  if (startRowId != null && blocosPular.has(startRowId)) return true;
  const codigos = [...new Set(bloco.map((l) => l.ref01).filter(isCodigoNumerico))];
  for (const c of codigos) {
    const r = classificarBlocoCliente(bloco, c, { blocosPular });
    if (r.tipo === 'MISTO') return true;
  }
  return false;
}

function montarJobForcado(bloco, codigoDom) {
  const blockStart = bloco[0].rowId;
  const linhasCliente = bloco.filter((l) => l.ref01 === codigoDom);
  const outras = bloco.filter((l) => l.ref01 !== codigoDom);
  return {
    bloco,
    codigo: codigoDom,
    startRowId: blockStart,
    linhasCliente,
    outras,
    linhasCard: bloco,
    somaCliente: linhasCliente.reduce((s, l) => s + l.cents, 0) / 100,
    somaOutras: outras.reduce((s, l) => s + l.cents, 0) / 100,
    somaBloco: 0,
    grupoAlvo: nomeGrupoCard(codigoDom, blockStart),
    tipo: 'ESPELHO',
    motivo: 'forcar_auto',
  };
}

/**
 * Com forcarAuto: ignora BLOCOS_PULAR_GLOBAL, deduplica blocos multi-cliente (1 job/bloco)
 * e inclui blocos MISTO como ESPELHO do bloco inteiro.
 */
export function gerarJobsCardsAuto(
  blocos,
  { codigo = null, codigos = null, forcarAuto = false, blocosPular = BLOCOS_PULAR_GLOBAL } = {},
) {
  if (!forcarAuto) {
    return gerarJobsCards(blocos, { codigo, blocosPular });
  }

  const blocosPularVazio = new Set();
  const codigosFiltro = codigos ?? (codigo ? [String(codigo)] : null);
  const blocosForcados = new Set();
  const jobsForcados = [];

  for (const bloco of blocos) {
    if (!blocoPrecisaForcarAuto(bloco, { blocosPular: blocosPularVazio })) continue;
    const blockStart = bloco[0].rowId;
    if (blocosForcados.has(blockStart)) continue;
    const codigoDom = primeiraRefNumericaBloco(bloco);
    if (!codigoDom) continue;
    if (codigosFiltro && !codigosFiltro.some((c) => bloco.some((l) => l.ref01 === c))) continue;
    blocosForcados.add(blockStart);
    jobsForcados.push(montarJobForcado(bloco, codigoDom));
  }

  const listaCodigos = codigosFiltro ?? listarCodigosNumericos(blocos);
  const jobsNormais = [];
  for (const c of listaCodigos) {
    for (const bloco of blocos) {
      if (blocosForcados.has(bloco[0].rowId)) continue;
      if (!bloco.some((l) => l.ref01 === c)) continue;
      const info = classificarBlocoCliente(bloco, c, { blocosPular: blocosPularVazio });
      if (info.tipo === 'VAZIO' || info.tipo === 'MISTO') continue;
      jobsNormais.push({ bloco, ...info });
    }
  }

  return [...jobsNormais, ...jobsForcados].sort(
    (a, b) => (a.startRowId ?? 0) - (b.startRowId ?? 0) || String(a.codigo).localeCompare(String(b.codigo)),
  );
}

/** Ondas de execução sugeridas no plano. */
export const ONDAS = {
  728: ['728'],
  1: ['473', '623', '692', '793', '938', '534', '596', '315', '792'],
  2: ['491'],
  3: null, // demais exceto 149
  4: ['149'],
};

export function codigosDaOnda(onda, todosCodigos) {
  if (onda === 3) {
    const excl = new Set([...ONDAS[728], ...ONDAS[1], ...ONDAS[2], ...ONDAS[4]]);
    return todosCodigos.filter((c) => !excl.has(c));
  }
  const lista = ONDAS[onda];
  if (!lista) return todosCodigos;
  return lista.filter((c) => todosCodigos.includes(c));
}
