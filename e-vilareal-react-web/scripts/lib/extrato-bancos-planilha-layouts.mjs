import * as XLSX from 'xlsx';

import {
  gerarNumeroLancamento,
  interpretarColunaCliente,
  montarDescricaoDetalhada,
  normalizarLetraPlanilha,
  normalizarRefTipo,
  parseDataPlanilha,
  parseGrupoCompensacaoPlanilha,
  parseNumeroInternoProcesso,
  parseValorPlanilha,
  textoCelula,
} from './extrato-bancos-planilha-parse.mjs';
import { NUMERO_PARA_CARTAO } from './extrato-bancos-planilha-constantes.mjs';

/**
 * Colunas fixas (área do usuário) — iguais nas abas de banco no padrão Itaú.
 * Índices 0-based.
 */
export const COL_USUARIO = {
  letra: 1, // B
  data: 3, // D
  extraE: 4, // E
  extraF: 5, // F
  descricao: 6, // G — Itaú PF; outro layout pode sobrescrever
  valor: 7, // H
  observacao: 9, // J
  codCliente: 11, // L
  proc: 12, // M
  refRepasse: 13, // N → refTipo (só letra A)
};

/**
 * @typedef {object} LayoutExtratoBanco
 * @property {string} id
 * @property {number} primeiraLinhaExcel 1-based
 * @property {number} [colDescricao] default COL_USUARIO.descricao
 */

/** @type {Record<string, LayoutExtratoBanco>} */
export const LAYOUTS_EXTRATO_BANCO = {
  'itau-pf': {
    id: 'itau-pf',
    primeiraLinhaExcel: 7,
    colDescricao: 6,
  },
  'cartao-f': {
    id: 'cartao-f',
    primeiraLinhaExcel: 7,
    colDescricao: 5,
  },
};

const CARTOES_SET = new Set(Object.values(NUMERO_PARA_CARTAO));

/** Layout automático por nome da aba (banco ou cartão). */
export function layoutExtratoPorNomeInstituicao(nome) {
  const n = String(nome ?? '').trim();
  if (CARTOES_SET.has(n)) return LAYOUTS_EXTRATO_BANCO['cartao-f'];
  return LAYOUTS_EXTRATO_BANCO['itau-pf'];
}

/**
 * @param {import('xlsx').WorkSheet} ws
 * @param {LayoutExtratoBanco} layout
 * @param {string} bancoNome
 */
export function extrairLancamentosDaAba(ws, layout, bancoNome) {
  if (!ws || !ws['!ref']) return [];

  const { e } = XLSX.utils.decode_range(ws['!ref']);
  const startRow = Math.max(0, (layout.primeiraLinhaExcel || 7) - 1);
  const colDesc = layout.colDescricao ?? COL_USUARIO.descricao;
  const U = COL_USUARIO;
  /** @type {Array<Record<string, unknown>>} */
  const out = [];

  for (let r = startRow; r <= e.r; r += 1) {
    const cell = (c) => ws[XLSX.utils.encode_cell({ r, c })]?.v;

    const dataIso = parseDataPlanilha(cell(U.data));
    const valor = parseValorPlanilha(cell(U.valor));
    const descricao = textoCelula(cell(colDesc));

    if (!dataIso && (valor == null || valor === 0) && !descricao) continue;
    if (!dataIso && valor == null) continue;
    if (/^SALDO\s+INICIAL$/i.test(descricao)) continue;

    const letraRaw = cell(U.letra);
    const letraNorm = normalizarLetraPlanilha(letraRaw);
    const letra = letraNorm ?? 'N';
    const letraDesconhecida = letraRaw != null && String(letraRaw).trim() !== '' && !letraNorm;

    const clienteCol = interpretarColunaCliente(cell(U.codCliente));
    const procPlanilha = parseNumeroInternoProcesso(cell(U.proc));
    const grupoCompensacao =
      letra === 'E' ? parseGrupoCompensacaoPlanilha(cell(U.proc)) : null;
    const refTipo =
      letra === 'A' ? normalizarRefTipo(cell(U.refRepasse)) : null;

    const descricaoDetalhada = montarDescricaoDetalhada({
      e: textoCelula(cell(U.extraE)),
      f: textoCelula(cell(U.extraF)),
      j: textoCelula(cell(U.observacao)),
      labelCliente: clienteCol?.kind === 'label' ? clienteCol.text : '',
      procPlanilha:
        letra === 'A' && clienteCol?.kind !== 'codigo' && procPlanilha != null ? procPlanilha : null,
    });

    const dataFinal = dataIso || '1900-01-01';
    const valorFinal = valor ?? 0;

    out.push({
      linhaExcel: r + 1,
      letra,
      letraDesconhecida,
      letraRaw: textoCelula(letraRaw),
      dataIso: dataFinal,
      valor: valorFinal,
      descricao: descricao || 'Lançamento extrato',
      descricaoDetalhada,
      refTipo,
      codigoCliente: letra === 'A' && clienteCol?.kind === 'codigo' ? clienteCol.codigo : null,
      numeroInterno: letra === 'A' && clienteCol?.kind === 'codigo' ? procPlanilha : null,
      grupoCompensacao,
      numeroLancamento: gerarNumeroLancamento({
        bancoNome,
        dataIso: dataFinal,
        valor: valorFinal,
        descricao: descricao || '',
        linhaExcel: r + 1,
      }),
    });
  }

  return out;
}
