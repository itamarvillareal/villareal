#!/usr/bin/env node
/**
 * Importa compromissos de uma planilha Excel sem cabeçalho.
 *
 * Layout `--layout=mes` (padrão):
 *   A: dia (1–31), B: hora, C: descrição, D: status (OK)
 *   Requer --mes= e --ano=
 *
 * Layout `--layout=total` (ex.: "agenda itamar total.xlsx"):
 *   A: data (número serial Excel ou texto dd/mm/aaaa)
 *   B: hora (fracção Excel ou texto)
 *   C: descrição
 *   D: status opcional
 *
 * Layout `--layout=total-acde` (colunas A,C,D,E com B vazio):
 *   A: data, C: hora, D: descrição, E: status
 *
 * Filtro opcional: --data-min=2026-05-01 (só datas >=; omitir = importa todas as linhas válidas).
 * Paralelismo: --concurrency=8 ou VILAREAL_IMPORT_CONCURRENCY (útil para ~20k linhas).
 *
 * Opcional: --usuario-id=3 (ou VILAREAL_IMPORT_USUARIO_ID) — envia esse id no corpo do POST;
 * o JWT continua a ser do --login. O backend pode ou não restringir isto; use só em ambiente controlado.
 *
 * Uso:
 *   VILAREAL_IMPORT_SENHA='***' node scripts/import-agenda-planilha.mjs "ficheiro.xlsx" --layout=total --login=itamar
 * No front: VITE_USE_API_AGENDA=true (reinicie o Vite).
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

function parseArgs(argv) {
  const out = {
    file: null,
    layout: 'mes',
    mes: 4,
    ano: new Date().getFullYear(),
    dataMin: null,
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: process.env.VILAREAL_API_BASE || 'http://localhost:8080',
    dryRun: false,
    concurrency: Math.min(
      32,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 8) || 8)
    ),
    usuarioIdBody: null,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--layout=')) out.layout = a.slice(9).trim().toLowerCase();
    else if (a.startsWith('--mes=')) out.mes = Number(a.slice(6));
    else if (a.startsWith('--ano=')) out.ano = Number(a.slice(6));
    else if (a.startsWith('--data-min=')) out.dataMin = normalizarDataMinArg(a.slice(11));
    else if (a.startsWith('--concurrency=')) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(32, Math.floor(n));
    }     else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--usuario-id=')) {
      const n = Number(a.slice(13));
      if (Number.isFinite(n) && n >= 1) out.usuarioIdBody = Math.floor(n);
    } else if (a.startsWith('--base-url=')) out.baseUrl = a.replace(/\/$/, '');
    else if (!a.startsWith('-') && !out.file) out.file = a;
  }
  if (out.usuarioIdBody == null && process.env.VILAREAL_IMPORT_USUARIO_ID) {
    const n = Number(process.env.VILAREAL_IMPORT_USUARIO_ID);
    if (Number.isFinite(n) && n >= 1) out.usuarioIdBody = Math.floor(n);
  }
  return out;
}

function pad2(n) {
  return String(n).padStart(2, '0');
}

/** Converte célula de hora (Excel ou texto) para HH:mm ou null. */
function normalizarHoraCelula(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && val > 0 && val < 1) {
    const totalMin = Math.round(val * 24 * 60);
    const hh = Math.floor(totalMin / 60) % 24;
    const mm = totalMin % 60;
    return `${pad2(hh)}:${pad2(mm)}`;
  }
  const s = String(val).trim();
  if (!s) return null;
  const m = s.match(/^(\d{1,2})[h:](\d{2})$/i);
  if (m) {
    const hh = Number(m[1]);
    const mm = Number(m[2]);
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return `${pad2(hh)}:${pad2(mm)}`;
  }
  const digits = s.replace(/\D/g, '');
  if (digits.length >= 3) {
    const hh = Number(digits.slice(0, digits.length === 3 ? 1 : 2));
    const mm = Number(digits.slice(-2));
    if (hh >= 0 && hh <= 23 && mm >= 0 && mm <= 59) return `${pad2(hh)}:${pad2(mm)}`;
  }
  if (digits.length === 2) {
    const hh = Number(digits);
    if (hh >= 0 && hh <= 23) return `${pad2(hh)}:00`;
  }
  return null;
}

function normalizarStatus(val) {
  const t = String(val ?? '').trim();
  if (!t) return null;
  if (t.toUpperCase() === 'OK') return 'OK';
  return null;
}

function diasNoMes(ano, mes) {
  return new Date(ano, mes, 0).getDate();
}

/** Serial Excel (parte inteira) → YYYY-MM-DD (UTC, convenção OFX/date-only). */
function excelSerialParaISO(serial) {
  if (typeof serial !== 'number' || !Number.isFinite(serial)) return null;
  const whole = Math.floor(serial);
  if (whole < 1) return null;
  const utcMs = (whole - 25569) * 86400 * 1000;
  const d = new Date(utcMs);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`;
}

function parseDataCelula(val) {
  if (val == null || val === '') return null;
  if (typeof val === 'number' && Number.isFinite(val)) {
    const whole = Math.floor(val);
    // Serial de data Excel (1900+); evita confundir com dia 1–31 do layout «mês».
    if (whole > 20000 && whole < 200000) return excelSerialParaISO(val);
    if (val >= 1 && val <= 31 && val === Math.floor(val)) return null;
  }
  const s = String(val).trim();
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function normalizarDataMinArg(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const br = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) return `${br[3]}-${pad2(br[2])}-${pad2(br[1])}`;
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (iso) return `${iso[1]}-${iso[2]}-${iso[3]}`;
  return null;
}

function dataISOEhMaiorOuIgual(a, b) {
  if (!a || !b) return true;
  return String(a).localeCompare(String(b)) >= 0;
}

function buildLinhasLayoutMes(mat, opts) {
  const maxDia = diasNoMes(opts.ano, opts.mes);
  const linhas = [];
  for (let i = 0; i < mat.length; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    const diaRaw = row[0];
    const horaRaw = row[1];
    const desc = row[2];
    const statusRaw = row[3];

    const dia =
      typeof diaRaw === 'number' && Number.isFinite(diaRaw)
        ? Math.floor(diaRaw)
        : parseInt(String(diaRaw ?? '').trim(), 10);
    if (!Number.isFinite(dia) || dia < 1 || dia > maxDia) continue;

    const descricao = String(desc ?? '').trim();
    if (!descricao) continue;

    const horaEvento = normalizarHoraCelula(horaRaw);
    const statusCurto = normalizarStatus(statusRaw);
    const dataEvento = `${opts.ano}-${pad2(opts.mes)}-${pad2(dia)}`;

    linhas.push({
      linhaPlanilha: i + 1,
      dataEvento,
      horaEvento,
      descricao,
      statusCurto,
    });
  }
  return linhas;
}

/** A=data, B=hora, C=desc, D=status opcional */
function buildLinhasLayoutTotal(mat, opts) {
  const linhas = [];
  for (let i = 0; i < mat.length; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    const dataEvento = parseDataCelula(row[0]);
    if (!dataEvento) continue;
    if (opts.dataMin && !dataISOEhMaiorOuIgual(dataEvento, opts.dataMin)) continue;

    const horaEvento = normalizarHoraCelula(row[1]);
    const descricao = String(row[2] ?? '').trim();
    if (!descricao) continue;
    const statusCurto = normalizarStatus(row[3]);

    linhas.push({
      linhaPlanilha: i + 1,
      dataEvento,
      horaEvento,
      descricao,
      statusCurto,
    });
  }
  return linhas;
}

/** A=data, C=hora, D=desc, E=status */
function buildLinhasLayoutTotalAcde(mat, opts) {
  const linhas = [];
  for (let i = 0; i < mat.length; i += 1) {
    const row = mat[i];
    if (!Array.isArray(row)) continue;
    const dataEvento = parseDataCelula(row[0]);
    if (!dataEvento) continue;
    if (opts.dataMin && !dataISOEhMaiorOuIgual(dataEvento, opts.dataMin)) continue;

    const horaEvento = normalizarHoraCelula(row[2]);
    const descricao = String(row[3] ?? '').trim();
    if (!descricao) continue;
    const statusCurto = normalizarStatus(row[4]);

    linhas.push({
      linhaPlanilha: i + 1,
      dataEvento,
      horaEvento,
      descricao,
      statusCurto,
    });
  }
  return linhas;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file) {
    console.error(
      'Uso: node scripts/import-agenda-planilha.mjs "<ficheiro.xlsx>" [--layout=mes|total|total-acde] [--mes=4 --ano=2026] [--data-min=AAAA-MM-DD] [--concurrency=8] [--login=itamar] [--dry-run]'
    );
    process.exit(1);
  }
  const abs = path.resolve(opts.file);
  if (!fs.existsSync(abs)) {
    console.error('Ficheiro não encontrado:', abs);
    process.exit(1);
  }
  if (!opts.senha && !opts.dryRun) {
    console.error('Defina a senha: variável VILAREAL_IMPORT_SENHA ou --senha=...');
    process.exit(1);
  }

  const wb = XLSX.readFile(abs);
  const sh = wb.Sheets[wb.SheetNames[0]];
  const mat = XLSX.utils.sheet_to_json(sh, { header: 1, defval: null, raw: true });

  let linhas;
  let label;
  if (opts.layout === 'total') {
    linhas = buildLinhasLayoutTotal(mat, opts);
    label = `layout=total${opts.dataMin ? `, data>=${opts.dataMin}` : ''}`;
  } else if (opts.layout === 'total-acde') {
    linhas = buildLinhasLayoutTotalAcde(mat, opts);
    label = `layout=total-acde${opts.dataMin ? `, data>=${opts.dataMin}` : ''}`;
  } else {
    linhas = buildLinhasLayoutMes(mat, opts);
    label = `mês ${opts.mes}/${opts.ano}`;
  }

  console.log(`Linhas válidas: ${linhas.length} (${label}, ficheiro: ${abs})`);

  if (opts.dryRun) {
    for (const L of linhas.slice(0, 15)) {
      console.log(JSON.stringify(L));
    }
    if (linhas.length > 15) console.log(`... e mais ${linhas.length - 15}`);
    process.exit(0);
  }

  const loginUrl = `${opts.baseUrl}/api/auth/login`;
  const loginRes = await fetch(loginUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ login: opts.login, senha: opts.senha }),
  });
  if (!loginRes.ok) {
    const t = await loginRes.text();
    console.error('Falha no login', loginRes.status, t);
    process.exit(1);
  }
  const loginJson = await loginRes.json();
  const token = loginJson.accessToken;
  const usuarioIdJwt = loginJson.usuario?.id;
  const usuarioId =
    opts.usuarioIdBody != null ? opts.usuarioIdBody : usuarioIdJwt;
  if (!token || usuarioId == null || !Number.isFinite(Number(usuarioId))) {
    console.error('Resposta de login inesperada:', loginJson);
    process.exit(1);
  }
  if (opts.usuarioIdBody != null && usuarioIdJwt != null && usuarioIdJwt !== usuarioId) {
    console.log(
      `Importação para usuarioId=${usuarioId} (JWT: login=${opts.login}, id token=${usuarioIdJwt}).`
    );
  }

  const origem =
    opts.layout === 'total' || opts.layout === 'total-acde'
      ? 'import-xlsx-agenda-total'
      : 'import-xlsx-agenda-mes';

  const conc = opts.concurrency;
  let ok = 0;
  let fail = 0;

  async function postUm(L) {
    const body = {
      usuarioId,
      dataEvento: L.dataEvento,
      horaEvento: L.horaEvento,
      descricao: L.descricao.slice(0, 2000),
      statusCurto: L.statusCurto,
      processoRef: null,
      origem,
    };
    const r = await fetch(`${opts.baseUrl}/api/agenda/eventos`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const t = await r.text();
      console.error(`Erro linha ${L.linhaPlanilha} ${L.dataEvento}:`, r.status, t.slice(0, 200));
      return false;
    }
    return true;
  }

  for (let i = 0; i < linhas.length; i += conc) {
    const batch = linhas.slice(i, i + conc);
    const results = await Promise.all(batch.map((L) => postUm(L)));
    for (const r of results) {
      if (r) ok += 1;
      else fail += 1;
    }
    const done = Math.min(i + conc, linhas.length);
    if (linhas.length > 500 && (done % 1000 < conc || done === linhas.length)) {
      console.log(`… ${done}/${linhas.length} enviados`);
    }
  }

  console.log(`Concluído: ${ok} criados, ${fail} falhas.`);
  process.exit(fail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
