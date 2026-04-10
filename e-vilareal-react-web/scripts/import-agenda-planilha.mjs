#!/usr/bin/env node
/**
 * Importa compromissos de uma planilha Excel sem cabeçalho:
 *   Coluna A: dia do mês (1–31)
 *   Coluna B: hora (texto, Excel time serial, ou vazio)
 *   Coluna C: descrição
 *   Coluna D: status (OK → statusCurto OK; resto ignora-se no API)
 *
 * Uso (troque pelo caminho real do ficheiro):
 *   cd e-vilareal-react-web
 *   VILAREAL_IMPORT_SENHA='***' node scripts/import-agenda-planilha.mjs "/Users/.../agenda abril.xlsx" --mes=4 --ano=2026 --login=itamar
 * No front: VITE_USE_API_AGENDA=true (reinicie o Vite) para a Agenda ler estes dados da API.
 *   --dry-run
 *   --base-url=http://localhost:8080
 */

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import XLSX from 'xlsx';

function parseArgs(argv) {
  const out = {
    file: null,
    mes: 4,
    ano: new Date().getFullYear(),
    login: 'itamar',
    senha: process.env.VILAREAL_IMPORT_SENHA || '',
    baseUrl: process.env.VILAREAL_API_BASE || 'http://localhost:8080',
    dryRun: false,
  };
  for (const a of argv) {
    if (a === '--dry-run') out.dryRun = true;
    else if (a.startsWith('--mes=')) out.mes = Number(a.slice(6));
    else if (a.startsWith('--ano=')) out.ano = Number(a.slice(6));
    else if (a.startsWith('--login=')) out.login = a.slice(8);
    else if (a.startsWith('--senha=')) out.senha = a.slice(8);
    else if (a.startsWith('--base-url=')) out.baseUrl = a.replace(/\/$/, '');
    else if (!a.startsWith('-') && !out.file) out.file = a;
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

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (!opts.file) {
    console.error(
      'Uso: node scripts/import-agenda-planilha.mjs "<ficheiro.xlsx>" [--mes=4] [--ano=2026] [--login=itamar] [--dry-run]'
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
      typeof diaRaw === 'number' && Number.isFinite(diaRaw) ? Math.floor(diaRaw) : parseInt(String(diaRaw ?? '').trim(), 10);
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

  console.log(`Linhas válidas: ${linhas.length} (mês ${opts.mes}/${opts.ano}, ficheiro: ${abs})`);

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
  const usuarioId = loginJson.usuario?.id;
  if (!token || !usuarioId) {
    console.error('Resposta de login inesperada:', loginJson);
    process.exit(1);
  }

  let ok = 0;
  let fail = 0;
  for (const L of linhas) {
    const body = {
      usuarioId,
      dataEvento: L.dataEvento,
      horaEvento: L.horaEvento,
      descricao: L.descricao.slice(0, 2000),
      statusCurto: L.statusCurto,
      processoRef: null,
      origem: 'import-xlsx-agenda-abril',
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
      fail += 1;
      const t = await r.text();
      console.error(`Erro linha ${L.linhaPlanilha} ${L.dataEvento}:`, r.status, t.slice(0, 200));
    } else {
      ok += 1;
    }
  }

  console.log(`Concluído: ${ok} criados, ${fail} falhas.`);
  process.exit(fail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
