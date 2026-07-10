/**
 * Converte débitos/taxas (legado txt 100–108) para a grade de Títulos da UI (como Excel).
 */

import { parseValorMonetarioBr } from '../utils/parseValorMonetarioBr.js';
import { linhaTituloVaziaCalculos } from './calculosTitulosParcelasSync.js';
import { entradaModoAtivo, parseQuantidadeParcelasNumero } from './parcelamentoEntrada.js';

function trunc2(n) {
  const v = Number(n);
  if (!Number.isFinite(v)) return 0;
  return Math.trunc(v * 100) / 100;
}

/** Soma monetária em centavos (evita 57,989999 → 57,98 em vez de 57,99). */
function somaMonetariaTrunc2(...valores) {
  const centavos = valores.reduce((acc, v) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return acc;
    return acc + Math.round(n * 100);
  }, 0);
  return trunc2(centavos / 100);
}

/** @param {number} n */
export function formatBRLTitulo(n) {
  const v = Number(n) || 0;
  return `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/** Normaliza valor vindo do txt (com ou sem «R$») para exibição na grade. */
export function formatCampoMonetarioTxt(val) {
  if (val == null || String(val).trim() === '') return '';
  const s = String(val).trim();
  if (/^R\$\s*/i.test(s)) return s;
  const n = parseValorMonetarioBr(s);
  if (n == null) return s;
  return formatBRLTitulo(n);
}

/**
 * Total da linha (VBA Somar_Taxas): principal + encargos (crédito negativo permanece negativo no total).
 * @param {{ valorInicial?: string, atualizacaoMonetaria?: string, juros?: string, multa?: string, honorarios?: string }} t
 */
export function calcularTotalTituloGrade(t) {
  const vi = parseValorMonetarioBr(t.valorInicial) ?? 0;
  const am = parseValorMonetarioBr(t.atualizacaoMonetaria) ?? 0;
  const ju = parseValorMonetarioBr(t.juros) ?? 0;
  const mu = parseValorMonetarioBr(t.multa) ?? 0;
  const ho = parseValorMonetarioBr(t.honorarios) ?? 0;
  return formatBRLTitulo(somaMonetariaTrunc2(vi, am, ju, mu, ho));
}

/**
 * @param {{
 *   dataVencimento?: string|null,
 *   valor?: string|null,
 *   atualizacaoMonetaria?: string|null,
 *   diasAtraso?: string|null,
 *   juros?: string|null,
 *   multa?: string|null,
 *   honorarios?: string|null,
 *   chaveDescricao?: string|null,
 * }} campos
 */
export function tituloFromCamposTaxa(campos) {
  const base = linhaTituloVaziaCalculos();
  const venc = campos.dataVencimento != null ? String(campos.dataVencimento).trim() : '';
  const valorRaw = campos.valor != null ? String(campos.valor).trim() : '';
  if (!venc && !valorRaw) return null;

  const titulo = {
    ...base,
    dataVencimento: venc,
    valorInicial: formatCampoMonetarioTxt(valorRaw),
    atualizacaoMonetaria: formatCampoMonetarioTxt(campos.atualizacaoMonetaria),
    diasAtraso: campos.diasAtraso != null && String(campos.diasAtraso).trim() !== '' ? String(campos.diasAtraso).trim() : '',
    juros: formatCampoMonetarioTxt(campos.juros),
    multa: formatCampoMonetarioTxt(campos.multa),
    honorarios: formatCampoMonetarioTxt(campos.honorarios),
    descricaoValor: campos.chaveDescricao != null ? String(campos.chaveDescricao).trim() : '',
  };
  titulo.total = calcularTotalTituloGrade(titulo);
  return titulo;
}

/** @param {Record<string, unknown>} debito */
export function tituloFromDebitoPayload(debito) {
  if (!debito || typeof debito !== 'object') return null;
  return tituloFromCamposTaxa({
    dataVencimento: debito.dataVencimento,
    valor: debito.valor,
    atualizacaoMonetaria: debito.atualizacaoMonetaria,
    juros: debito.juros,
    multa: debito.multa,
    honorarios: debito.honorarios,
    diasAtraso: debito.diasAtraso,
    chaveDescricao: debito.chaveDescricao,
  });
}

/** @param {unknown[]} titulos */
export function titulosGradeTemValor(titulos) {
  if (!Array.isArray(titulos)) return false;
  return titulos.some((t) => String(t?.valorInicial ?? '').trim() !== '');
}

/** Linha com encargos gravados no txt (106–108, 104, dias 105 por linha). */
export function tituloGravadoTemCalculoSnapshot(t) {
  if (!t || typeof t !== 'object') return false;
  if (String(t.valorInicial ?? '').trim() === '') return false;
  return (
    String(t.juros ?? '').trim() !== '' ||
    String(t.atualizacaoMonetaria ?? '').trim() !== '' ||
    String(t.multa ?? '').trim() !== '' ||
    String(t.honorarios ?? '').trim() !== '' ||
    String(t.diasAtraso ?? '').trim() !== ''
  );
}

/** True se todas as linhas com valor têm snapshot completo no txt. */
export function titulosGravadosSnapshotUtilizavel(gravados) {
  if (!Array.isArray(gravados) || !gravados.length) return false;
  const comValor = gravados.filter((t) => String(t?.valorInicial ?? '').trim() !== '');
  if (!comValor.length) return false;
  return comValor.every((t) => tituloGravadoTemCalculoSnapshot(t));
}

/**
 * Congela o plano de pagamento exibido (entrada + parcelas) para homologatória/execução.
 * @param {Record<string, unknown>} rodada
 * @param {unknown[]} [parcelasExibidas]
 */
export function snapshotPlanoPagamentoAceito(rodada, parcelasExibidas) {
  const cur = rodada && typeof rodada === 'object' ? rodada : {};
  const qtd = String(cur.quantidadeParcelasInformada ?? '00');
  const plano = {
    quantidadeParcelasInformada: qtd,
    entradaParcelamentoModo: cur.entradaParcelamentoModo ?? 'nenhuma',
    entradaParcelamentoValor: cur.entradaParcelamentoValor ?? '',
    entradaParcelamentoPercentual: cur.entradaParcelamentoPercentual ?? '',
    entradaParcelamentoDataVenc: cur.entradaParcelamentoDataVenc ?? '',
    taxaJurosParcelamento: cur.taxaJurosParcelamento ?? '0,00',
  };
  const n = parseQuantidadeParcelasNumero(qtd);
  const temEnt = entradaModoAtivo(plano);
  const limite = Math.max(temEnt ? n + 1 : n, 0);
  const fonte = Array.isArray(parcelasExibidas)
    ? parcelasExibidas
    : Array.isArray(cur.parcelas)
      ? cur.parcelas
      : [];
  const parcelasGravadasAceito = fonte.slice(0, limite).map((p) => ({ ...(p && typeof p === 'object' ? p : {}) }));
  return { parcelasGravadasAceito, parcelamentoPlanoAceito: plano };
}

/**
 * Rodada efetiva para extrair boletos da homologatória (usa snapshot congelado ao aceitar).
 * @param {Record<string, unknown>|null|undefined} rodada
 */
/** Atualiza snapshot do plano aceito a partir das parcelas atuais do payload (antes de PUT). */
export function sincronizarSnapshotPlanoPagamentoAceitoNoPayload(rodada) {
  if (!rodada || typeof rodada !== 'object' || rodada.parcelamentoAceito !== true) return rodada;
  const snap = snapshotPlanoPagamentoAceito(rodada, rodada.parcelas);
  return { ...rodada, ...snap };
}

export function rodadaPlanoPagamentoParaHomologacao(rodada) {
  if (!rodada || typeof rodada !== 'object') return rodada;
  if (rodada.parcelamentoAceito !== true) return rodada;
  const gravadas = Array.isArray(rodada.parcelasGravadasAceito) ? rodada.parcelasGravadasAceito : [];
  if (!gravadas.length) return rodada;
  const plano =
    rodada.parcelamentoPlanoAceito && typeof rodada.parcelamentoPlanoAceito === 'object'
      ? rodada.parcelamentoPlanoAceito
      : {};
  return {
    ...rodada,
    ...plano,
    parcelas: gravadas.map((p) => ({ ...p })),
  };
}

/**
 * Snapshot ao marcar Aceitar Pagamento: usa títulos atuais (recalculados), não o txt importado.
 * @param {Record<string, unknown>|null|undefined} rodada
 * @param {string} dataCalculoAtual
 * @param {unknown[]} [parcelasExibidas] linhas do plano exibidas na aba Parcelamento
 */
export function patchRodadaAoAceitarPagamento(rodada, dataCalculoAtual, parcelasExibidas) {
  const cur = rodada && typeof rodada === 'object' ? rodada : {};
  const titulosEstado = Array.isArray(cur.titulos) ? cur.titulos : [];
  const gravados = Array.isArray(cur.titulosGravadosAceito) ? cur.titulosGravadosAceito : [];
  const temValorEstado = titulosEstado.some((t) => String(t?.valorInicial ?? '').trim() !== '');
  const snap = temValorEstado ? titulosEstado : gravados;
  const planoSnap = snapshotPlanoPagamentoAceito(cur, parcelasExibidas);
  const dc = String(dataCalculoAtual ?? '').trim();
  if (!snap.length) {
    return {
      parcelamentoAceito: true,
      ...planoSnap,
      ...(dc ? { dataCalculoRodada: dc } : {}),
    };
  }

  const copia = snap.map((t) => ({ ...t }));
  return {
    parcelamentoAceito: true,
    titulosGravadosAceito: copia,
    titulos: copia.map((t) => ({ ...t })),
    ...planoSnap,
    ...(dc ? { dataCalculoRodada: dc } : {}),
  };
}

/**
 * Patch ao DESMARCAR "Aceitar Pagamento" (liberar/destravar a rodada):
 * - PRESERVA os débitos já cadastrados (vencimento/valor) — materializando em `titulos`
 *   exatamente o que está exibido (fonte pode ser o estado, o snapshot congelado ou as
 *   parcelas, em rodadas legadas) — e remove o snapshot (`titulosGravadosAceito`), para que
 *   voltem a ser editáveis, aceitem novos e o recálculo automático para "hoje" refaça os
 *   encargos (vencimento/valor são mantidos);
 * - apaga APENAS o plano de pagamento (parcelas e parâmetros de parcelamento).
 * @param {Record<string, unknown>|null|undefined} rodada
 * @param {unknown[]} [titulosExibidos] títulos atualmente exibidos na grade (fonte de verdade do display)
 */
export function patchRodadaAoDesfazerAceitarPagamento(rodada, titulosExibidos) {
  const cur = rodada && typeof rodada === 'object' ? rodada : {};
  const exibidos = Array.isArray(titulosExibidos) ? titulosExibidos : [];
  const titulosEstado = Array.isArray(cur.titulos) ? cur.titulos : [];
  const gravados = Array.isArray(cur.titulosGravadosAceito) ? cur.titulosGravadosAceito : [];
  const temValor = (lista) => lista.some((t) => String(t?.valorInicial ?? '').trim() !== '');
  // Prioriza o que está exibido (já considera snapshot e enriquecimento por parcelas);
  // cai para o estado e, por fim, para o snapshot. Assim os débitos nunca somem ao apagar o plano.
  const baseDebitos = temValor(exibidos)
    ? exibidos
    : temValor(titulosEstado)
      ? titulosEstado
      : gravados;
  const titulos = baseDebitos.map((t) => ({ ...(t && typeof t === 'object' ? t : {}) }));

  const recMap =
    cur.honorariosDataRecebimento && typeof cur.honorariosDataRecebimento === 'object'
      ? cur.honorariosDataRecebimento
      : {};
  // Mantém as datas de recebimento dos honorários de TÍTULOS; descarta as de PARCELAS (plano apagado).
  const honorariosDataRecebimento = Object.fromEntries(
    Object.entries(recMap).filter(([k]) => !String(k).startsWith('parcela:'))
  );
  return {
    parcelamentoAceito: false,
    titulos,
    titulosGravadosAceito: [],
    parcelasGravadasAceito: [],
    parcelamentoPlanoAceito: null,
    parcelas: [],
    quantidadeParcelasInformada: '00',
    taxaJurosParcelamento: '0,00',
    paginaParcelamento: 1,
    honorariosDataRecebimento,
  };
}

/**
 * @param {unknown[]} gravados
 * @param {unknown[]} recalculados
 * @param {(lista: unknown[]) => unknown[]} mapTitulosAceitos
 */
export function mesclarTitulosGravadosComRecalculo(gravados, recalculados, mapTitulosAceitos) {
  const g = Array.isArray(gravados) ? gravados : [];
  const r = Array.isArray(recalculados) ? recalculados : [];
  const n = Math.max(g.length, r.length);
  /** @type {unknown[]} */
  const out = [];
  for (let i = 0; i < n; i++) {
    const gravado = g[i];
    const calc = r[i];
    const gravadoComValor =
      gravado && typeof gravado === 'object' && String(gravado.valorInicial ?? '').trim() !== ''
        ? mapTitulosAceitos([gravado])[0]
        : null;
    const calcComValor =
      calc && typeof calc === 'object' && String(calc.valorInicial ?? '').trim() !== '' ? calc : null;

    if (gravadoComValor && calcComValor) {
      out.push({
        ...calcComValor,
        dataVencimento: gravadoComValor.dataVencimento,
        valorInicial: gravadoComValor.valorInicial,
        descricaoValor: gravadoComValor.descricaoValor ?? calcComValor.descricaoValor,
        datasEspeciais: gravadoComValor.datasEspeciais ?? calcComValor.datasEspeciais,
      });
    } else if (gravadoComValor) {
      out.push(gravadoComValor);
    } else if (calcComValor) {
      out.push(calcComValor);
    } else {
      out.push(linhaTituloVaziaCalculos());
    }
  }
  return out;
}

/**
 * Preenche `titulos[]` a partir de `debitos[]` quando a grade de títulos está vazia (import legado).
 * @param {Record<string, unknown>} rodada
 */
export function enriquecerTitulosAPartirDeDebitosNaRodada(rodada) {
  if (!rodada || typeof rodada !== 'object') return rodada;
  if (titulosGradeTemValor(rodada.titulos)) return rodada;

  const debitos = Array.isArray(rodada.debitos) ? rodada.debitos : [];
  if (!debitos.length) return rodada;

  const titulos = debitos
    .map((d) => tituloFromDebitoPayload(d))
    .filter((t) => t != null);
  if (!titulos.length) return rodada;
  return { ...rodada, titulos };
}
