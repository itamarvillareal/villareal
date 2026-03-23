/**
 * Publicações importadas (localStorage) filtradas pelo processo atual (código cliente × proc. interno e/ou CNJ).
 */

import { loadPublicacoesImportadas } from './publicacoesStorage.js';
import { normalizarCnjParaChave } from './publicacoesPdfParser.js';
import { obterNumeroProcessoNovoUnificado } from './processosHistoricoData.js';
import { getDadosProcessoClienteUnificado } from './processoClienteProcUnificado.js';

function padCodCliente(cod) {
  const n = String(cod ?? '').replace(/\D/g, '');
  if (!n) return '';
  return n.padStart(8, '0').slice(-8);
}

function normProcInterno(proc) {
  const n = Number(String(proc ?? '').replace(/\D/g, ''));
  if (!Number.isFinite(n) || n < 1) return '1';
  return String(Math.floor(n));
}

function cnjDoProcessoNaTela(codigoCliente, processo, numeroProcessoNovoTela) {
  const u = getDadosProcessoClienteUnificado(codigoCliente, processo);
  const fallback = String(u?.processoNovo ?? '').trim();
  return obterNumeroProcessoNovoUnificado(codigoCliente, processo, numeroProcessoNovoTela || fallback);
}

/**
 * @param {string|number} codigoCliente
 * @param {string|number} processo — nº interno do processo no cliente
 * @param {string} [numeroProcessoNovoTela] — valor atual do campo «Nº Processo Novo» na tela Processos
 * @returns {Array<object>} cópias referenciadas dos itens gravados, ordenados por data de publicação (mais recente primeiro)
 */
export function listarPublicacoesDoProcesso(codigoCliente, processo, numeroProcessoNovoTela = '') {
  const cod = padCodCliente(codigoCliente);
  const proc = normProcInterno(processo);
  const cnjUnificado = cnjDoProcessoNaTela(codigoCliente, processo, numeroProcessoNovoTela);
  const cnjKey = normalizarCnjParaChave(cnjUnificado);

  const todos = loadPublicacoesImportadas();
  const filtrados = todos.filter((item) => {
    const itemCod = padCodCliente(item.codCliente);
    const itemProc = normProcInterno(item.procInterno);
    const byVinculo = cod && itemCod === cod && itemProc === proc;

    const itemCnj = normalizarCnjParaChave(
      item.processoCnjNormalizado || item.numero_processo_cnj || item.numeroCnj || ''
    );
    const byCnj = Boolean(cnjKey && itemCnj && itemCnj === cnjKey);

    return byVinculo || byCnj;
  });

  function pesoData(s) {
    const t = String(s ?? '').trim();
    const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(t);
    if (!m) return 0;
    const ts = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return Number.isFinite(ts) ? ts : 0;
  }

  return [...filtrados].sort((a, b) => pesoData(b.dataPublicacao) - pesoData(a.dataPublicacao));
}
