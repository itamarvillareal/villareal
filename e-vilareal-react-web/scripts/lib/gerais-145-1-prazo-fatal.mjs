/**
 * Leitura dos ficheiros tipo 145.1 (prazo fatal por processo).
 * Estrutura: `<base>/<aaaa>/<mm>/00000NNN.145.1.<proc>.txt`
 * Conteúdo: uma linha com a data do prazo fatal (dd/mm/aaaa).
 */

import fs from 'node:fs';
import path from 'node:path';
import { parseDataSlashComHint } from './historico-local-txt-paths.mjs';

export const DEFAULT_BASE_GERAIS_145_1 = path.join(
  process.env.HOME || '',
  'Dropbox',
  'Banco de Dados',
  'Gerais',
  '145.1'
);

/**
 * Ex.: `00000985.145.1.110.txt` → cliente 00000985, processo 110.
 * @param {string} fileName
 * @returns {{ cod8: string, codNum: number, numeroInterno: number } | null}
 */
export function parseNomeArquivo145_1(fileName) {
  const base = path.basename(fileName, path.extname(fileName));
  const parts = base.split('.');
  if (parts.length < 3) return null;
  const codRaw = parts[0];
  if (!/^\d{8}$/.test(codRaw)) return null;
  const procRaw = parts[parts.length - 1];
  const numeroInterno = Number.parseInt(procRaw, 10);
  if (!Number.isFinite(numeroInterno) || numeroInterno < 1) return null;
  const cod8 = codRaw;
  const codNum = Number.parseInt(cod8, 10);
  return { cod8, codNum, numeroInterno };
}

/**
 * @param {string} texto
 * @param {number | null} [mmPastaHint]
 * @returns {string | null} yyyy-mm-dd
 */
export function parseDataPrazoFatalTxt(texto, mmPastaHint = null) {
  if (texto == null) return null;
  const linha = String(texto)
    .split(/\r?\n/)
    .map((l) => l.trim())
    .find((l) => l.length > 0);
  if (!linha) return null;

  const slash = parseDataSlashComHint(linha, mmPastaHint);
  if (slash) {
    return `${slash.yyyy}-${String(slash.mo).padStart(2, '0')}-${String(slash.dd).padStart(2, '0')}`;
  }

  const iso = linha.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;

  return null;
}

/**
 * @param {string} base
 * @param {{ anoMin?: number, anoMax?: number, clienteFiltro?: number | null }} [opts]
 * @yields {{
 *   cod8: string,
 *   codNum: number,
 *   numeroInterno: number,
 *   prazoFatalIso: string,
 *   arquivo: string,
 *   relPath: string,
 *   yyyy: number,
 *   mm: number,
 * }}
 */
export function* iterarPrazosFatais145_1(base, opts = {}) {
  if (!fs.existsSync(base)) return;

  const anoMin = opts.anoMin ?? 2017;
  const anoMax = opts.anoMax ?? 2030;
  const filtroCliente = opts.clienteFiltro ?? null;

  let anos;
  try {
    anos = fs
      .readdirSync(base, { withFileTypes: true })
      .filter((d) => d.isDirectory() && /^\d{4}$/.test(d.name))
      .map((d) => Number(d.name))
      .filter((y) => y >= anoMin && y <= anoMax)
      .sort((a, b) => a - b);
  } catch {
    return;
  }

  for (const yyyy of anos) {
    const dirAno = path.join(base, String(yyyy));
    let meses;
    try {
      meses = fs
        .readdirSync(dirAno, { withFileTypes: true })
        .filter((d) => d.isDirectory() && /^\d{1,2}$/.test(d.name))
        .map((d) => Number(d.name))
        .filter((m) => m >= 1 && m <= 12)
        .sort((a, b) => a - b);
    } catch {
      continue;
    }

    for (const mm of meses) {
      const dirMes = path.join(dirAno, String(mm).padStart(2, '0'));
      let files;
      try {
        files = fs.readdirSync(dirMes).filter((f) => f.toLowerCase().endsWith('.txt'));
      } catch {
        continue;
      }

      for (const f of files) {
        const parsed = parseNomeArquivo145_1(f);
        if (!parsed) continue;
        if (filtroCliente != null && parsed.codNum !== filtroCliente) continue;

        const abs = path.join(dirMes, f);
        let raw;
        try {
          raw = fs.readFileSync(abs, 'utf8');
        } catch {
          continue;
        }

        const prazoFatalIso = parseDataPrazoFatalTxt(raw, mm);
        if (!prazoFatalIso) continue;

        yield {
          cod8: parsed.cod8,
          codNum: parsed.codNum,
          numeroInterno: parsed.numeroInterno,
          prazoFatalIso,
          arquivo: abs,
          relPath: path.relative(base, abs),
          yyyy,
          mm,
        };
      }
    }
  }
}

/**
 * Um registo por par cliente+processo; em duplicata fica o ficheiro com pasta (ano,mês) mais recente.
 * @param {Iterable<ReturnType<typeof iterarPrazosFatais145_1> extends Generator<infer T> ? T : never>} entradas
 */
export function deduplicarPrazosFatais145_1(entradas) {
  /** @type {Map<string, object>} */
  const map = new Map();

  for (const e of entradas) {
    const key = `${e.cod8}|${e.numeroInterno}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, e);
      continue;
    }
    const score = e.yyyy * 100 + e.mm;
    const prevScore = prev.yyyy * 100 + prev.mm;
    if (score > prevScore || (score === prevScore && e.prazoFatalIso > prev.prazoFatalIso)) {
      map.set(key, e);
    }
  }

  return [...map.values()].sort(
    (a, b) => a.codNum - b.codNum || a.numeroInterno - b.numeroInterno
  );
}
