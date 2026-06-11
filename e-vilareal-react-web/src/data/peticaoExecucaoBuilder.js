/**
 * Montagem do corpo da requisição de Petição de Execução
 * (`POST /api/documentos/peticao-execucao`).
 *
 * Centraliza a lógica usada tanto pela tela de Cálculos quanto pela tela de
 * Gerar Documento, garantindo fidelidade à tela (INV1): os valores dos títulos
 * e o total geral são enviados exatamente como exibidos, sem recomposição no backend.
 */

import { calcularTotalTituloGrade } from './calculosDebitosTitulos.js';
import { calcularResumoTitulosGrade } from './calculosRodadaTitulosPaginacao.js';

/** Converte os títulos da grade no formato esperado pelo backend (`TituloDto`). */
export function montarTitulosRequestPeticao(lista) {
  const arr = Array.isArray(lista) ? lista : [];
  return arr
    .filter((t) => String(t?.valorInicial ?? '').trim() !== '')
    .map((t) => {
      const diasNum = parseInt(String(t?.diasAtraso ?? '').replace(/\D/g, ''), 10);
      return {
        descricao: t?.descricaoValor ?? '',
        vencimento: t?.dataVencimento ?? '',
        diasAtraso: Number.isFinite(diasNum) ? diasNum : null,
        valorPrincipal: t?.valorInicial ?? '',
        atualizacaoMonetaria: t?.atualizacaoMonetaria ?? '',
        juros: t?.juros ?? '',
        multa: t?.multa ?? '',
        honorarios: t?.honorarios ?? '',
        // INV1: total do título exatamente como exibido na grade (sem recompor no backend).
        total: String(t?.total ?? '').trim() !== '' ? t.total : calcularTotalTituloGrade(t),
      };
    });
}

/** Remove "%" e espaços para enviar percentuais ao backend. */
export function normalizarPercentParaEnvio(v) {
  return String(v ?? '').replace(/%/g, '').replace(/\s/g, '').trim();
}

/** dd/mm/aaaa → yyyy-mm-dd; entradas inválidas/vazias usam a data de hoje. */
export function dataBRparaISO(br) {
  const s = String(br ?? '').trim();
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  const base = m ? new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : new Date();
  const yyyy = base.getFullYear();
  const mm = String(base.getMonth() + 1).padStart(2, '0');
  const dd = String(base.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

/**
 * Monta o corpo completo da requisição de Petição de Execução.
 * @param {object} params
 * @param {number} params.processoId
 * @param {string} params.enderecamento
 * @param {string} params.modo — 'Completo' | 'Resumido'
 * @param {string} params.dataIso — yyyy-mm-dd
 * @param {object} params.config — `{ indice, multa, juros, periodicidade }`
 * @param {Array<object>} params.titulos — títulos da grade (com valores calculados)
 */
export function montarBodyPeticaoExecucao({ processoId, enderecamento, modo, dataIso, config, titulos }) {
  const lista = Array.isArray(titulos) ? titulos : [];
  return {
    processoId: Number(processoId),
    enderecamento,
    modo: modo === 'Resumido' ? 'Resumido' : 'Completo',
    data: dataIso,
    config: {
      indice: String(config?.indice ?? ''),
      multa: normalizarPercentParaEnvio(config?.multa),
      juros: normalizarPercentParaEnvio(config?.juros),
      periodicidade: String(config?.periodicidade ?? 'mensal'),
    },
    titulos: montarTitulosRequestPeticao(lista),
    // INV1: total geral exatamente como o resumo da tela calcula para a mesma lista.
    totalGeral: calcularResumoTitulosGrade(lista).total,
  };
}
