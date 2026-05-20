/**
 * Levantamento dos ficheiros Gerais/145.1 (Dropbox) com estatísticas de validação.
 */

import fs from 'node:fs';
import path from 'node:path';
import {
  deduplicarPrazosFatais145_1,
  iterarPrazosFatais145_1,
  parseDataPrazoFatalTxt,
  parseNomeArquivo145_1,
} from './gerais-145-1-prazo-fatal.mjs';

/**
 * @param {string} base
 * @param {{
 *   anoMin?: number,
 *   anoMax?: number,
 *   clienteFiltro?: number | null,
 * }} [opts]
 */
export function levantarPrazosFatais145_1(base, opts = {}) {
  const anoMin = opts.anoMin ?? 2017;
  const anoMax = opts.anoMax ?? new Date().getFullYear() + 1;
  const clienteFiltro = opts.clienteFiltro ?? null;

  let ficheirosTxt = 0;
  let nomeInvalido = 0;
  let dataInvalida = 0;
  let dataValida = 0;

  if (fs.existsSync(base)) {
    for (let yyyy = anoMin; yyyy <= anoMax; yyyy += 1) {
      const dirAno = path.join(base, String(yyyy));
      if (!fs.existsSync(dirAno)) continue;
      for (let mm = 1; mm <= 12; mm += 1) {
        const dirMes = path.join(dirAno, String(mm).padStart(2, '0'));
        if (!fs.existsSync(dirMes)) continue;
        let files;
        try {
          files = fs.readdirSync(dirMes).filter((x) => x.toLowerCase().endsWith('.txt'));
        } catch {
          continue;
        }
        for (const f of files) {
          ficheirosTxt += 1;
          const parsed = parseNomeArquivo145_1(f);
          if (!parsed) {
            nomeInvalido += 1;
            continue;
          }
          if (clienteFiltro != null && parsed.codNum !== clienteFiltro) continue;
          try {
            const raw = fs.readFileSync(path.join(dirMes, f), 'utf8');
            if (parseDataPrazoFatalTxt(raw, mm)) dataValida += 1;
            else dataInvalida += 1;
          } catch {
            dataInvalida += 1;
          }
        }
      }
    }
  }

  /** @type {ReturnType<typeof deduplicarPrazosFatais145_1>} */
  const brutos = [];
  for (const e of iterarPrazosFatais145_1(base, { anoMin, anoMax, clienteFiltro })) {
    brutos.push(e);
  }

  const registos = deduplicarPrazosFatais145_1(brutos);

  return {
    registos,
    stats: {
      ficheirosTxt,
      dataValida,
      dataInvalida,
      nomeInvalido,
      registosUnicos: registos.length,
      duplicadosDescartados: Math.max(0, brutos.length - registos.length),
    },
  };
}
