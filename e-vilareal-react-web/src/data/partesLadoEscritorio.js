/**
 * Parte cliente × parte oposta (lado do escritório × contrário).
 *
 * - Não confundir com «polo AUTOR» / «polo cliente» de negócio.
 * - {@code papel_cliente}: REQUERENTE → parte cliente no polo jurídico AUTOR;
 *   REQUERIDO → parte cliente no polo jurídico REU (ex.: Lana é parte cliente e, no processo, é ré).
 */

import { getRegistroProcesso } from './processosHistoricoData.js';
import { parseProjudiMeta } from './manifestacoesProjudiDisplay.js';

function normPolo(polo) {
  return String(polo ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function normNome(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normQualificacao(q) {
  return String(q ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

function temMarcadorParteClienteImport(p) {
  const q = normQualificacao(p.qualificacao);
  return q.includes('ENDERECO') || q.includes('PARTE CLIENTE');
}

/** Polo jurídico autor/requerente é o lado do escritório. */
export function poloJuridicoEscritorioEhAutor(papelParteOrApi, partes = null) {
  const p = String(papelParteOrApi ?? '')
    .trim()
    .toUpperCase();
  if (p === 'REQUERIDO' || p === 'requerido') return false;
  if (p === 'REQUERENTE' || p === 'requerente') return true;
  for (const row of partes || []) {
    const q = normQualificacao(row.qualificacao);
    if (!q.includes('PARTE CLIENTE')) continue;
    const polo = normPolo(row.polo);
    if (polo.includes('REU') || polo.includes('REQUERIDO')) return false;
    if (polo.includes('AUTOR') || polo.includes('REQUERENTE') || polo.includes('CLIENTE')) return true;
  }
  return true;
}

export function poloEhLadoEscritorio(polo, poloJuridicoEscritorioAutor) {
  const poloNorm = normPolo(polo);
  if (!poloNorm) return false;
  const poloAutor =
    poloNorm.includes('AUTOR') || poloNorm.includes('REQUERENTE') || poloNorm.includes('CLIENTE');
  const poloReu = poloNorm.includes('REU') || poloNorm.includes('REQUERIDO');
  if (poloJuridicoEscritorioAutor) return poloAutor && !poloReu;
  return poloReu;
}

export function formatarListaComConjuncaoE(itens) {
  const lista = (itens || []).map((s) => String(s ?? '').trim()).filter(Boolean);
  if (lista.length === 0) return '';
  if (lista.length === 1) return lista[0];
  if (lista.length === 2) return `${lista[0]} e ${lista[1]}`;
  return `${lista.slice(0, -1).join(', ')} e ${lista[lista.length - 1]}`;
}

function importPoloJuridicoInvertidoParteCliente(papelParte, partes) {
  const papel = String(papelParte ?? '')
    .trim()
    .toUpperCase();
  if (papel !== 'REQUERIDO' && papel !== 'requerido') return false;
  let marcadorAutor = false;
  let marcadorReu = false;
  for (const p of partes || []) {
    if (!temMarcadorParteClienteImport(p)) continue;
    const polo = normPolo(p.polo);
    if (polo.includes('REU') || polo.includes('REQUERIDO')) marcadorReu = true;
    if (polo.includes('AUTOR') || polo.includes('REQUERENTE') || polo.includes('CLIENTE')) marcadorAutor = true;
  }
  return marcadorAutor && !marcadorReu;
}

function montarTextosPorMarcadorParteCliente(partes) {
  const nomesCliente = [];
  const nomesOposta = [];
  for (const p of partes || []) {
    const nome = String(p.nomeExibicao || p.nomeLivre || '').trim();
    if (!nome) continue;
    if (temMarcadorParteClienteImport(p)) nomesCliente.push(nome);
    else nomesOposta.push(nome);
  }
  return {
    parteCliente: formatarListaComConjuncaoE(nomesCliente),
    parteOposta: formatarListaComConjuncaoE(nomesOposta),
  };
}

function montarPorPapelJuridico(partes, papelParte) {
  const poloAutor = poloJuridicoEscritorioEhAutor(papelParte, partes);
  const nomesCliente = [];
  const nomesOposta = [];
  for (const p of partes || []) {
    const nome = String(p.nomeExibicao || p.nomeLivre || '').trim();
    if (!nome) continue;
    if (poloEhLadoEscritorio(p.polo, poloAutor)) nomesCliente.push(nome);
    else nomesOposta.push(nome);
  }
  return {
    parteCliente: formatarListaComConjuncaoE(nomesCliente),
    parteOposta: formatarListaComConjuncaoE(nomesOposta),
  };
}

/**
 * @param {string} [papelParte] requerente | requerido
 */
export function textosPartesFromListaPartesApi(partes, papelParte = 'requerente') {
  const porQualCliente = [];
  const porQualOposta = [];
  for (const p of partes || []) {
    const nome = String(p.nomeExibicao || p.nomeLivre || '').trim();
    if (!nome) continue;
    const q = normQualificacao(p.qualificacao);
    if (q.includes('PARTE CLIENTE')) porQualCliente.push(nome);
    else if (q.includes('PARTE OPOSTA')) porQualOposta.push(nome);
  }
  if (porQualCliente.length) {
    const po =
      porQualOposta.length > 0
        ? formatarListaComConjuncaoE(porQualOposta)
        : montarPorPapelJuridico(partes, papelParte).parteOposta;
    return { parteCliente: formatarListaComConjuncaoE(porQualCliente), parteOposta: po };
  }
  if (importPoloJuridicoInvertidoParteCliente(papelParte, partes)) {
    return montarTextosPorMarcadorParteCliente(partes);
  }
  return montarPorPapelJuridico(partes, papelParte);
}

function resolverPapelParteHistorico(codCliente, procInterno) {
  const cod = String(codCliente ?? '').trim();
  const proc = Number(procInterno);
  if (!cod || !Number.isFinite(proc) || proc < 1) return '';
  const reg = getRegistroProcesso(cod, proc);
  return String(reg?.papelParte ?? '').trim().toLowerCase();
}

/** Corrige exibição quando API ainda reflete polos jurídicos invertidos no import. */
export function ajustarPartesPublicacaoUi(ui) {
  if (!ui || ui.statusVinculo !== 'vinculado') return ui;
  let papel = String(ui.papelCliente ?? ui.papelParte ?? '')
    .trim()
    .toLowerCase();
  if (!papel) papel = resolverPapelParteHistorico(ui.codCliente, ui.procInterno);
  if (papel !== 'requerido') {
    return papel ? { ...ui, papelParte: papel } : ui;
  }

  const pc = String(ui.parteCliente ?? '').trim();
  const po = String(ui.parteOposta ?? ui.reu ?? '').trim();
  if (!pc || !po) return { ...ui, papelParte: 'requerido' };

  const meta = parseProjudiMeta(ui);
  const autor = normNome(meta.parteAutor);
  const reu = normNome(meta.parteReu);
  const pcN = normNome(pc);
  const poN = normNome(po);

  // API agregou pelo polo REU (Randerson), mas parte cliente (Lana) está no outro lado
  if (autor && reu && pcN.includes(reu.slice(0, 12)) && poN.includes(autor.slice(0, 12))) {
    return {
      ...ui,
      papelParte: 'requerido',
      parteCliente: po,
      parteOposta: pc,
      reu: pc,
    };
  }

  return { ...ui, papelParte: 'requerido' };
}
