/**
 * Varredura da pasta Agenda por ficheiros .txt alterados num dia (criados ou modificados).
 */

import fs from 'node:fs';
import path from 'node:path';

import {
  USUARIOS_AGENDA_PASTA,
  chaveConteudoEvento,
  dataIsoAgenda,
  descricaoComoNaApi,
  lerEventosArquivoDiaLegado,
  normalizarHoraAgendaTxt,
  normalizarStatusAgendaTxt,
  normalizarStrAgenda,
  parseNomeArquivoAgenda,
  parseNomeArquivoAgendaDia,
} from './agenda-local-txt.mjs';
import { readOneLineFile } from './historico-local-txt-paths.mjs';
import { normalizarTextoPlanilha } from './normalizar-texto-planilha.mjs';
import { inicioDiaLocal, mtimeNoDia, parseDiaArg } from './historico-hc-scan-alterados.mjs';

export { inicioDiaLocal, parseDiaArg, mtimeNoDia };

/** @typedef {'estruturado' | 'dia-legado' | 'outro'} TipoArquivoAgenda */

/**
 * @typedef {object} ArquivoAgendaAlterado
 * @property {string} abs
 * @property {string} relAposAgenda
 * @property {number} mtimeMs
 * @property {TipoArquivoAgenda} tipo
 * @property {string} usuarioPasta
 * @property {string | null} dataIso
 * @property {number | null} linha
 * @property {'Hora' | 'Compromisso' | 'Status' | null} tipoCampo
 */

/**
 * @typedef {object} SlotAgendaEstruturado
 * @property {string} usuarioPasta
 * @property {string} dataIso
 * @property {number} linha
 * @property {Record<string, string>} paths
 */

/**
 * @typedef {object} ScanAgendaAlterados
 * @property {ArquivoAgendaAlterado[]} todos
 * @property {ArquivoAgendaAlterado[]} estruturados
 * @property {ArquivoAgendaAlterado[]} diaLegado
 * @property {ArquivoAgendaAlterado[]} outros
 * @property {Map<string, SlotAgendaEstruturado>} slotsEstruturados
 * @property {Map<string, { usuarioPasta: string, dataIso: string, abs: string }>} ficheirosDia
 */

/**
 * @param {string} baseAgenda
 * @param {Date} inicioDia
 * @param {Date} fimDia
 * @param {string[]} [usuarios]
 * @returns {ScanAgendaAlterados}
 */
export function scanAgendaAlteradosNoDia(baseAgenda, inicioDia, fimDia, usuarios = USUARIOS_AGENDA_PASTA) {
  /** @type {ArquivoAgendaAlterado[]} */
  const todos = [];
  /** @type {Map<string, SlotAgendaEstruturado>} */
  const slotsEstruturados = new Map();
  /** @type {Map<string, { usuarioPasta: string, dataIso: string, abs: string }>} */
  const ficheirosDia = new Map();

  function walk(dir) {
    let entries;
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const ent of entries) {
      const abs = path.join(dir, ent.name);
      if (ent.isDirectory()) {
        walk(abs);
        continue;
      }
      if (!ent.isFile() || !ent.name.toLowerCase().endsWith('.txt')) continue;

      let st;
      try {
        st = fs.statSync(abs);
      } catch {
        continue;
      }
      if (!mtimeNoDia(st.mtimeMs, inicioDia, fimDia)) continue;

      const relAposAgenda = path.relative(baseAgenda, abs).split(path.sep).join('/');
      const usuarioPasta = relAposAgenda.split('/')[0] ?? '';

      const parsedAgenda = parseNomeArquivoAgenda(ent.name);
      if (parsedAgenda) {
        const dataIso = dataIsoAgenda(parsedAgenda.ano, parsedAgenda.mes, parsedAgenda.dia);
        if (!dataIso) continue;

        const row = {
          abs,
          relAposAgenda,
          mtimeMs: st.mtimeMs,
          tipo: /** @type {const} */ ('estruturado'),
          usuarioPasta: parsedAgenda.usuarioArquivo,
          dataIso,
          linha: parsedAgenda.linha,
          tipoCampo: parsedAgenda.tipo,
        };
        todos.push(row);

        const slotKey = `${parsedAgenda.usuarioArquivo}|${dataIso}|${parsedAgenda.linha}`;
        let slot = slotsEstruturados.get(slotKey);
        if (!slot) {
          slot = {
            usuarioPasta: parsedAgenda.usuarioArquivo,
            dataIso,
            linha: parsedAgenda.linha,
            paths: {},
          };
          slotsEstruturados.set(slotKey, slot);
        }
        slot.paths[parsedAgenda.tipo] = abs;
        continue;
      }

      const parsedDia = parseNomeArquivoAgendaDia(ent.name);
      if (parsedDia) {
        const dataIso = dataIsoAgenda(parsedDia.ano, parsedDia.mes, parsedDia.dia);
        if (!dataIso) continue;

        const row = {
          abs,
          relAposAgenda,
          mtimeMs: st.mtimeMs,
          tipo: /** @type {const} */ ('dia-legado'),
          usuarioPasta,
          dataIso,
          linha: null,
          tipoCampo: null,
        };
        todos.push(row);

        const diaKey = `${usuarioPasta}|${dataIso}`;
        ficheirosDia.set(diaKey, { usuarioPasta, dataIso, abs });
        continue;
      }

      todos.push({
        abs,
        relAposAgenda,
        mtimeMs: st.mtimeMs,
        tipo: 'outro',
        usuarioPasta,
        dataIso: null,
        linha: null,
        tipoCampo: null,
      });
    }
  }

  for (const u of usuarios) {
    const raiz = path.join(baseAgenda, u);
    if (fs.existsSync(raiz)) walk(raiz);
  }

  const estruturados = todos.filter((f) => f.tipo === 'estruturado');
  const diaLegado = todos.filter((f) => f.tipo === 'dia-legado');
  const outros = todos.filter((f) => f.tipo === 'outro');

  return { todos, estruturados, diaLegado, outros, slotsEstruturados, ficheirosDia };
}

/**
 * O mesmo compromisso (utilizador + dia + hora + descrição) pode vir das duas fontes legado —
 * estruturado (ficheiros por-campo) e consolidado (`dd.mm.yyyy.txt`) — com status divergente,
 * tipicamente o por-campo em branco e o consolidado "OK". O consolidado é a referência, logo um
 * status preenchido vence o vazio. Sem isto o sync importaria as duas variantes (mesma hora+descrição,
 * status diferente) e ficaria a oscilar em PUTs sem nunca reconhecer o par estrito.
 * @param {object[]} eventos
 * @returns {object[]}
 */
export function colapsarEventosConflitoStatus(eventos) {
  /** @type {Map<string, object>} */
  const porChave = new Map();
  const ordem = [];
  for (const ev of eventos) {
    const usuario = normalizarStrAgenda(ev.usuarioPasta);
    const hora = normalizarHoraAgendaTxt(ev.horaEvento) ?? '';
    const desc = normalizarStrAgenda(descricaoComoNaApi(ev.descricao));
    const key = `${usuario}|${ev.dataEvento}|${hora}|${desc}`;
    const existente = porChave.get(key);
    if (!existente) {
      porChave.set(key, ev);
      ordem.push(key);
      continue;
    }
    const stExist = normalizarStatusAgendaTxt(existente.statusCurto);
    const stNovo = normalizarStatusAgendaTxt(ev.statusCurto);
    if (!stExist && stNovo) existente.statusCurto = ev.statusCurto;
  }
  return ordem.map((k) => porChave.get(k));
}

/**
 * Eventos a sincronizar a partir do resultado do scan (só o que mudou hoje).
 * @param {ScanAgendaAlterados} scan
 * @returns {object[]}
 */
export function eventosFromScanAgenda(scan) {
  /** @type {object[]} */
  const eventos = [];
  const conteudoVisto = new Set();

  for (const slot of scan.slotsEstruturados.values()) {
    const hora = normalizarHoraAgendaTxt(readOneLineFile(slot.paths.Hora));
    const compromisso = readOneLineFile(slot.paths.Compromisso);
    const status = normalizarStatusAgendaTxt(readOneLineFile(slot.paths.Status));
    if (!hora && !compromisso && !status) continue;

    const ev = {
      usuarioPasta: slot.usuarioPasta,
      dataEvento: slot.dataIso,
      linhaLegado: slot.linha,
      horaEvento: hora,
      descricao: compromisso ? normalizarTextoPlanilha(compromisso).slice(0, 2000) : '',
      statusCurto: status,
      fonte: 'estruturado-scan',
      paths: { ...slot.paths },
    };
    const ck = chaveConteudoEvento(ev);
    if (conteudoVisto.has(ck)) continue;
    conteudoVisto.add(ck);
    eventos.push(ev);
  }

  for (const dia of scan.ficheirosDia.values()) {
    const lista = lerEventosArquivoDiaLegado(dia.abs, dia.usuarioPasta);
    for (const ev of lista) {
      const ck = chaveConteudoEvento(ev);
      if (conteudoVisto.has(ck)) continue;
      conteudoVisto.add(ck);
      eventos.push({ ...ev, fonte: 'dia-legado-scan' });
    }
  }

  const colapsados = colapsarEventosConflitoStatus(eventos);
  colapsados.sort(
    (a, b) =>
      a.usuarioPasta.localeCompare(b.usuarioPasta) ||
      a.dataEvento.localeCompare(b.dataEvento) ||
      a.linhaLegado - b.linhaLegado
  );
  return colapsados;
}
