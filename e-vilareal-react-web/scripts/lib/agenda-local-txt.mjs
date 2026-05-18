/**
 * Leitura da agenda legado (Dropbox «Banco de Dados/Agenda»).
 *
 * Dois formatos na mesma árvore:
 * 1. **Estruturado (VBA):** `{Usuario}.{dd}.{mm}.{yyyy}.{linha}.{Hora|Compromisso|Status}.Agenda.txt`
 * 2. **Dia consolidado:** `{dd}.{mm}.{yyyy}.txt` — CSV `"hora","compromisso","status"` por linha (1–23)
 *
 * A função `subpasta()` (Milhar/Centena/Unidade) **não** se aplica à Agenda.
 */

import fs from 'node:fs';
import path from 'node:path';
import { decodeHistoricoTextBuffer, readOneLineFile } from './historico-local-txt-paths.mjs';
import { normalizarTextoPlanilha } from './normalizar-texto-planilha.mjs';

export const USUARIOS_AGENDA_PASTA = ['Dr. Itamar', 'KARLA', 'Ana Luisa'];

const RE_ARQUIVO_AGENDA =
  /^(.+)\.(\d{2})\.(\d{2})\.(\d{4})\.(\d+)\.(Hora|Compromisso|Status)\.Agenda$/i;

const RE_ARQUIVO_DIA_LEGADO = /^(\d{2})\.(\d{2})\.(\d{4})$/;

export function resolverBaseAgenda() {
  const env = process.env.VILAREAL_BANCO_DADOS_BASE?.trim();
  const base = env || path.join(process.env.HOME || '', 'Dropbox', 'Banco de Dados');
  return path.join(base, 'Agenda');
}

export function normalizarStrAgenda(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

/** Alinhado ao backend: descrição vazia vira «Compromisso». */
export function descricaoComoNaApi(descricao) {
  const d = normalizarTextoPlanilha(descricao);
  return d || 'Compromisso';
}

/**
 * Compromisso com texto (tarefa do dia). Hora e status podem vir vazios:
 * - sem hora: cumprimento no dia, sem horário fixo;
 * - sem status: ainda não cumprido; `OK` indica cumprido.
 */
export function temDescricaoUtil(descricao) {
  return Boolean(normalizarTextoPlanilha(descricao));
}

/**
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null }} ev
 */
export function chaveConteudoEvento(ev) {
  const hora = normalizarHoraAgendaTxt(ev.horaEvento) ?? '';
  const desc = normalizarStrAgenda(descricaoComoNaApi(ev.descricao));
  const st = normalizarStatusAgendaTxt(ev.statusCurto) ?? '';
  return `${hora}|${desc}|${st}`;
}

/**
 * Mesmo compromisso para validação/importação (descrição manda; hora/status flexíveis).
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null }} a
 * @param {{ horaEvento?: string | null, descricao?: string | null, statusCurto?: string | null }} b
 */
export function compromissosEquivalentes(a, b) {
  const descA = normalizarStrAgenda(descricaoComoNaApi(a.descricao));
  const descB = normalizarStrAgenda(descricaoComoNaApi(b.descricao));

  if (!descA && !descB) {
    const stA = normalizarStatusAgendaTxt(a.statusCurto);
    const stB = normalizarStatusAgendaTxt(b.statusCurto);
    return stA === stB;
  }
  if (!descA || !descB) return false;

  if (descA !== descB) {
    if (descA.length < 8 || descB.length < 8) return false;
    if (!descA.includes(descB) && !descB.includes(descA)) return false;
  }

  const horaA = normalizarHoraAgendaTxt(a.horaEvento);
  const horaB = normalizarHoraAgendaTxt(b.horaEvento);
  if (horaA && horaB && horaA !== horaB) return false;

  return true;
}

export function chaveDiaUsuario(usuarioPasta, dataIso) {
  return `${usuarioPasta}|${dataIso}`;
}

/**
 * @param {string} nomePasta ex. `07 - Julho`, `01 - Janeiro`, `07`
 * @returns {number | null} mês 1–12
 */
export function parseMesPastaAgenda(nomePasta) {
  const m = String(nomePasta ?? '').match(/(\d{1,2})/);
  if (!m) return null;
  const mes = Number.parseInt(m[1], 10);
  if (mes < 1 || mes > 12) return null;
  return mes;
}

/**
 * @param {string} fileName
 * @returns {{
 *   usuarioArquivo: string,
 *   dia: number,
 *   mes: number,
 *   ano: number,
 *   linha: number,
 *   tipo: 'Hora' | 'Compromisso' | 'Status',
 * } | null}
 */
export function parseNomeArquivoAgenda(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  const m = base.match(RE_ARQUIVO_AGENDA);
  if (!m) return null;

  const dia = Number.parseInt(m[2], 10);
  const mes = Number.parseInt(m[3], 10);
  const ano = Number.parseInt(m[4], 10);
  const linha = Number.parseInt(m[5], 10);
  const tipo = m[6];
  if (!Number.isFinite(dia) || !Number.isFinite(mes) || !Number.isFinite(ano) || !Number.isFinite(linha)) {
    return null;
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2100 || linha < 1) {
    return null;
  }

  const tipoNorm =
    tipo.toLowerCase() === 'hora'
      ? 'Hora'
      : tipo.toLowerCase() === 'compromisso'
        ? 'Compromisso'
        : 'Status';

  return {
    usuarioArquivo: m[1],
    dia,
    mes,
    ano,
    linha,
    tipo: tipoNorm,
  };
}

/**
 * Ficheiro consolidado do dia: `02.12.2025.txt`
 * @param {string} fileName
 */
export function parseNomeArquivoAgendaDia(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  const m = base.match(RE_ARQUIVO_DIA_LEGADO);
  if (!m) return null;
  const dia = Number.parseInt(m[1], 10);
  const mes = Number.parseInt(m[2], 10);
  const ano = Number.parseInt(m[3], 10);
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31 || ano < 1900 || ano > 2100) return null;
  return { dia, mes, ano };
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/**
 * @param {number} ano
 * @param {number} mes
 * @param {number} dia
 * @returns {string | null} YYYY-MM-DD
 */
export function dataIsoAgenda(ano, mes, dia) {
  const d = new Date(ano, mes - 1, dia);
  if (d.getFullYear() !== ano || d.getMonth() !== mes - 1 || d.getDate() !== dia) return null;
  return `${ano}-${pad2(mes)}-${pad2(dia)}`;
}

/** @param {string | null | undefined} val */
export function normalizarHoraAgendaTxt(val) {
  if (val == null) return null;
  const s = String(val).trim();
  if (!s || s === '.....') return null;
  const m = s.match(/^(\d{1,2})[h:.](\d{2})$/i);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return `${pad2(hh)}:${pad2(mm)}`;
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length === 3 || digits.length === 4) {
    const hh = Number(digits.slice(0, digits.length - 2));
    const mm = Number(digits.slice(-2));
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return `${pad2(hh)}:${pad2(mm)}`;
  }
  if (digits.length === 2) {
    const hh = Number(digits);
    if (hh >= 0 && hh <= 23) return `${pad2(hh)}:00`;
  }
  return s.length <= 16 ? s : s.slice(0, 16);
}

/** @param {string | null | undefined} val */
export function normalizarStatusAgendaTxt(val) {
  const t = String(val ?? '').trim();
  if (!t || t === '__') return null;
  if (t.toUpperCase() === 'OK') return 'OK';
  return null;
}

/**
 * Uma linha CSV do ficheiro `dd.mm.yyyy.txt`.
 * @param {string} line
 */
export function parseLinhaCsvAgendaDia(line) {
  const raw = String(line ?? '').trim();
  if (!raw || !raw.startsWith('"')) return null;

  const parts = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < raw.length; i += 1) {
    const c = raw[i];
    if (c === '"') {
      inQ = !inQ;
      continue;
    }
    if (c === ',' && !inQ) {
      parts.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  parts.push(cur);

  if (parts.length < 3) return null;

  const hora = normalizarHoraAgendaTxt(parts[0]);
  const descricao = normalizarTextoPlanilha(parts[1]);
  const status = normalizarStatusAgendaTxt(parts[2]);

  if (!hora && !descricao && !status) return null;

  return { horaEvento: hora, descricao, statusCurto: status };
}

/**
 * @param {string} abs
 * @param {string} usuarioPasta
 */
export function lerEventosArquivoDiaLegado(abs, usuarioPasta) {
  const parsed = parseNomeArquivoAgendaDia(path.basename(abs));
  if (!parsed) return [];

  const dataIso = dataIsoAgenda(parsed.ano, parsed.mes, parsed.dia);
  if (!dataIso) return [];

  let text;
  try {
    const buf = fs.readFileSync(abs);
    text = decodeHistoricoTextBuffer(buf);
  } catch {
    return [];
  }

  const eventos = [];
  const linhas = text.split(/\r?\n/);
  for (let i = 0; i < linhas.length; i += 1) {
    const slot = parseLinhaCsvAgendaDia(linhas[i]);
    if (!slot) continue;
    eventos.push({
      usuarioPasta,
      dataEvento: dataIso,
      linhaLegado: i + 1,
      horaEvento: slot.horaEvento,
      descricao: slot.descricao ? slot.descricao.slice(0, 2000) : '',
      statusCurto: slot.statusCurto,
      fonte: 'dia-legado',
      pathDia: abs,
    });
  }
  return eventos;
}

/**
 * @param {string} dir
 * @param {(abs: string, ctx: object) => void} onFile
 * @param {object} [opts]
 */
function walkTxt(dir, onFile, opts = {}) {
  if (!fs.existsSync(dir)) return;
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const ent of entries) {
    const abs = path.join(dir, ent.name);
    if (ent.isDirectory()) {
      if (opts.maxDepth != null && (opts._depth ?? 0) >= opts.maxDepth) continue;
      walkTxt(abs, onFile, { ...opts, _depth: (opts._depth ?? 0) + 1 });
      continue;
    }
    if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.txt')) continue;
    onFile(abs, opts);
  }
}

/**
 * Referência «existente» na pasta: ficheiros `dd.mm.yyyy.txt` agrupados por dia/utilizador.
 * @returns {Map<string, import('./agenda-local-txt.mjs').EventoAgenda[]>} chaveDiaUsuario → eventos
 */
export function indexarReferenciaDiaLegado(baseAgenda, opts = {}) {
  const usuarios = opts.usuarios ?? USUARIOS_AGENDA_PASTA;
  /** @type {Map<string, object[]>} */
  const porDia = new Map();
  let ficheirosDia = 0;

  for (const usuarioPasta of usuarios) {
    const raizUsuario = path.join(baseAgenda, usuarioPasta);
    if (!fs.existsSync(raizUsuario)) continue;

    walkTxt(raizUsuario, (abs) => {
      if (!parseNomeArquivoAgendaDia(path.basename(abs))) return;

      const parsed = parseNomeArquivoAgendaDia(path.basename(abs));
      if (!parsed) return;
      if (opts.anoMin != null && parsed.ano < opts.anoMin) return;
      if (opts.anoMax != null && parsed.ano > opts.anoMax) return;

      const dataIso = dataIsoAgenda(parsed.ano, parsed.mes, parsed.dia);
      if (!dataIso) return;
      if (opts.dataMin && dataIso < opts.dataMin) return;
      if (opts.dataMax && dataIso > opts.dataMax) return;

      const eventos = lerEventosArquivoDiaLegado(abs, usuarioPasta);
      if (!eventos.length) return;

      const chave = chaveDiaUsuario(usuarioPasta, dataIso);
      porDia.set(chave, eventos);
      ficheirosDia += 1;
    });
  }

  return { porDia, ficheirosDia };
}

/**
 * @param {object} ev
 * @param {Map<string, object[]>} referenciaPorDia
 */
export function compararEventoComReferenciaDia(ev, referenciaPorDia) {
  const chave = chaveDiaUsuario(ev.usuarioPasta, ev.dataEvento);
  const refLista = referenciaPorDia.get(chave);
  if (!refLista?.length) {
    return { tipo: 'dia_sem_referencia', api: null };
  }

  const matches = refLista.filter((r) => compromissosEquivalentes(ev, r));
  if (matches.length === 1) {
    return { tipo: 'igual', ref: matches[0] };
  }
  if (matches.length > 1) {
    return { tipo: 'ambiguo', ref: null, candidatos: matches.length };
  }

  return { tipo: 'diferente', ref: null };
}

export function indexarFicheirosAgenda(baseAgenda, opts = {}) {
  const usuarios = opts.usuarios ?? USUARIOS_AGENDA_PASTA;
  /** @type {Map<string, { usuarioPasta: string, dataIso: string, linha: number, paths: Record<string, string> }>} */
  const grupos = new Map();
  let ficheirosNomeInvalido = 0;
  let ficheirosIgnorados = 0;

  for (const usuarioPasta of usuarios) {
    const raizUsuario = path.join(baseAgenda, usuarioPasta);
    if (!fs.existsSync(raizUsuario)) continue;

    walkTxt(raizUsuario, (abs) => {
      const base = path.basename(abs);
      const parsed = parseNomeArquivoAgenda(base);
      if (!parsed) {
        if (parseNomeArquivoAgendaDia(base)) return;
        ficheirosIgnorados += 1;
        return;
      }
      if (opts.anoMin != null && parsed.ano < opts.anoMin) return;
      if (opts.anoMax != null && parsed.ano > opts.anoMax) return;

      const dataIso = dataIsoAgenda(parsed.ano, parsed.mes, parsed.dia);
      if (!dataIso) {
        ficheirosNomeInvalido += 1;
        return;
      }
      if (opts.dataMin && dataIso < opts.dataMin) return;
      if (opts.dataMax && dataIso > opts.dataMax) return;

      const key = `${usuarioPasta}|${dataIso}|${parsed.linha}`;
      let g = grupos.get(key);
      if (!g) {
        g = {
          usuarioPasta,
          dataIso,
          linha: parsed.linha,
          paths: {},
        };
        grupos.set(key, g);
      }
      g.paths[parsed.tipo] = abs;
    });
  }

  return { grupos, ficheirosIgnorados, ficheirosNomeInvalido };
}

export function levantarEventosAgenda(baseAgenda, opts = {}) {
  const { grupos, ficheirosIgnorados, ficheirosNomeInvalido } = indexarFicheirosAgenda(
    baseAgenda,
    opts
  );
  /** @type {object[]} */
  const eventos = [];
  const conteudoVisto = new Set();

  for (const g of grupos.values()) {
    const hora = normalizarHoraAgendaTxt(readOneLineFile(g.paths.Hora));
    const compromisso = readOneLineFile(g.paths.Compromisso);
    const status = normalizarStatusAgendaTxt(readOneLineFile(g.paths.Status));

    if (!hora && !compromisso && !status) continue;

    const ev = {
      usuarioPasta: g.usuarioPasta,
      dataEvento: g.dataIso,
      linhaLegado: g.linha,
      horaEvento: hora,
      descricao: compromisso ? normalizarTextoPlanilha(compromisso).slice(0, 2000) : '',
      statusCurto: status,
      fonte: 'estruturado',
      paths: { ...g.paths },
    };
    conteudoVisto.add(chaveConteudoEvento(ev));
    eventos.push(ev);
  }

  let ficheirosDia = 0;
  let eventosSoDiaLegado = 0;

  if (opts.incluirDiaLegado !== false) {
    const ref = indexarReferenciaDiaLegado(baseAgenda, opts);
    ficheirosDia = ref.ficheirosDia;
    for (const lista of ref.porDia.values()) {
      for (const ev of lista) {
        const ck = chaveConteudoEvento(ev);
        if (conteudoVisto.has(ck)) continue;
        conteudoVisto.add(ck);
        eventos.push(ev);
        eventosSoDiaLegado += 1;
      }
    }
  }

  eventos.sort(
    (a, b) =>
      a.usuarioPasta.localeCompare(b.usuarioPasta) ||
      a.dataEvento.localeCompare(b.dataEvento) ||
      a.linhaLegado - b.linhaLegado
  );

  return {
    eventos,
    ficheirosIgnorados,
    ficheirosNomeInvalido,
    ficheirosDiaLegado: ficheirosDia,
    eventosSoDiaLegado,
    grupos: grupos.size,
  };
}
