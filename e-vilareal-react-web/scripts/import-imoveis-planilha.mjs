#!/usr/bin/env node
/**
 * Importa imoveis + contrato (layout Itamar). Primeira aba; cabecalho linha 7 Excel; dados linhas 9-72.
 * Uso: node scripts/import-imoveis-planilha.mjs "<ficheiro.xls>" --layout=itamar --login=itamar [--dry-run]
 * Envs: VILAREAL_IMPORT_SENHA, VILAREAL_API_BASE (sem /api), VILAREAL_IMPORT_CONCURRENCY (default 3).
 */

import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import "./lib/load-vilareal-import-env.mjs";
import XLSX from "xlsx";
import { parseDataPlanilhaCellIso } from "./lib/parse-data-planilha-br.mjs";
import { buscarProcesso, clientePkFromApiDto } from "./lib/vilareal-import-processo-api.mjs";

/** @param {unknown} v */
function parseDecimal(v) {
  if (v == null || v === "") return null;
  if (typeof v === "number" && Number.isFinite(v)) return v;
  const s = String(v).trim();
  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");
  if (lastComma !== -1 && lastComma > lastDot) {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  if (lastDot !== -1) {
    const intPart = s.slice(0, lastDot).replace(/,/g, "").replace(/[^\d-]/g, "");
    const frac = s.slice(lastDot + 1).replace(/\D/g, "");
    const normalized = frac.length ? `${intPart || "0"}.${frac}` : intPart || "0";
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }
  if (lastComma !== -1) {
    const n = Number(s.replace(/\./g, "").replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(s.replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) ? n : null;
}

const DATA_START_0 = 8;
const DATA_END_EXCLUSIVE = 72;

const PATH_PLANILHA_PADRAO = path.join(
  os.homedir(),
  "Dropbox",
  "sistema",
  "Villa Real - Administração de Imóveis - Itamar.xls"
);

function parseArgs(argv) {
  let fileArg = null;
  const out = {
    file: null,
    layout: "itamar",
    login: "itamar",
    senha: process.env.VILAREAL_IMPORT_SENHA || "",
    baseUrl: (process.env.VILAREAL_API_BASE || "http://localhost:8080").replace(/\/$/, ""),
    dryRun: false,
    concurrency: Math.min(
      16,
      Math.max(1, Number(process.env.VILAREAL_IMPORT_CONCURRENCY || 3) || 3)
    ),
  };
  for (const a of argv) {
    if (a === "--dry-run") out.dryRun = true;
    else if (a.startsWith("--layout=")) out.layout = a.slice(9).trim().toLowerCase();
    else if (a.startsWith("--login=")) out.login = a.slice(8);
    else if (a.startsWith("--senha=")) out.senha = a.slice(8);
    else if (a.startsWith("--concurrency=")) {
      const n = Number(a.slice(14));
      if (Number.isFinite(n) && n >= 1) out.concurrency = Math.min(16, Math.floor(n));
    } else if (a.startsWith("--base-url=")) out.baseUrl = a.slice(11).replace(/\/$/, "");
    else if (!a.startsWith("-") && !fileArg) fileArg = a;
  }
  out.file = fileArg || process.env.VILAREAL_IMPORT_IMOVEIS_PLANILHA_PATH || PATH_PLANILHA_PADRAO;
  return out;
}

function parseSimNao(v) {
  if (v == null) return null;
  const s = String(v).trim().toUpperCase();
  if (s === "SIM" || s === "VERDADEIRO" || s === "TRUE" || s === "1") return true;
  if (s === "N\u00c3O" || s === "NAO" || s === "FALSO" || s === "FALSE" || s === "0") return false;
  return null;
}

/** @param {unknown} raw @param {unknown} [fmt] */
function parseData(raw, fmt) {
  return parseDataPlanilhaCellIso(raw, fmt);
}

function parseInt2(v) {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
}

function parseTexto(v) {
  if (v == null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function normalizarCodigoCliente(raw) {
  if (raw == null || String(raw).trim() === "") return null;
  const d = String(raw).replace(/\D/g, "");
  if (!d) return null;
  const pad = d.padStart(8, "0");
  return pad.length > 8 ? pad.slice(-8) : pad;
}

function montarCamposExtras(row, rowFmt) {
  const extras = {};
  // Chaves alinhadas ao import Java (`ImoveisPlanilhaImportService`) e à UI (`mapApiToUi`).
  extras.infoIptuTexto = parseTexto(row[8]);
  extras.dataConsIptu = parseData(row[9], rowFmt?.[9]);
  extras.existeDebIptu = parseSimNao(row[10]);
  extras.aguaNumero = parseTexto(row[11]);
  extras.diaVencAgua = parseInt2(row[12]);
  extras.existeDebAgua = parseSimNao(row[13]);
  extras.dataConsAgua = parseData(row[14], rowFmt?.[14]);
  extras.energiaNumero = parseTexto(row[15]);
  extras.diaVencEnergia = parseInt2(row[16]);
  extras.existeDebEnergia = parseSimNao(row[17]);
  extras.dataConsEnergia = parseData(row[18], rowFmt?.[18]);
  extras.gasNumero = parseTexto(row[19]);
  extras.diaVencGas = parseInt2(row[20]);
  extras.existeDebGas = parseSimNao(row[21]);
  extras.dataConsGas = parseData(row[22], rowFmt?.[22]);
  extras.existeDebitoCond = parseSimNao(row[23]);
  extras.dataConsDebitoCond = parseData(row[24], rowFmt?.[24]);
  extras.contIntermImobArquivado = parseSimNao(row[34]);
  extras.contIntermImobAssProprietario = parseSimNao(row[35]);
  extras.contratoAssinadoProprietario = parseSimNao(row[36]);
  extras.contratoAssinadoInquilino = parseSimNao(row[37]);
  extras.contratoAssinadoGarantidor = parseSimNao(row[38]);
  extras.contratoAssinadoTestemunhas = parseSimNao(row[39]);
  extras.contratoArquivado = parseSimNao(row[40]);
  extras.linkVistoria = parseTexto(row[41]);
  extras.dataPag1TxCond = parseData(row[53], rowFmt?.[53]);
  extras.observacoesInquilino = parseTexto(row[54]);
  return Object.fromEntries(Object.entries(extras).filter(([, v]) => v != null));
}

function montarDadosBancarios(row) {
  const dados = {
    numeroBanco: parseTexto(row[46]),
    banco: parseTexto(row[47]),
    agencia: parseTexto(row[48]),
    conta: parseTexto(row[49]),
    cpfBanco: parseTexto(row[50]),
    titular: parseTexto(row[51]),
    chavePix: parseTexto(row[52]),
  };
  return Object.fromEntries(Object.entries(dados).filter(([, v]) => v != null));
}

function buildImovelPayload(row, rowFmt, clienteId, processoId) {
  const g = parseInt2(row[30]);
  const ocupado = parseSimNao(row[55]);
  const extras = montarCamposExtras(row, rowFmt);
  const cod = normalizarCodigoCliente(row[2]);
  const proc = parseInt2(row[3]);
  if (cod) extras.codigo = cod;
  if (proc != null && proc >= 1) extras.proc = String(proc);
  return {
    clienteId,
    processoId: processoId || null,
    numeroPlanilha: parseInt2(row[1]),
    responsavelPessoaId: parseInt2(row[4]),
    unidade: parseTexto(row[5]),
    condominio: parseTexto(row[6]),
    enderecoCompleto: parseTexto(row[25]),
    inscricaoImobiliaria: parseTexto(row[7]),
    garagens: g != null ? String(g) : null,
    situacao: ocupado === true ? "OCUPADO" : "DESOCUPADO",
    ativo: true,
    camposExtrasJson: JSON.stringify(extras),
  };
}

function buildContratoPayload(imovelId, row, rowFmt) {
  const dataInicio = parseData(row[27], rowFmt?.[27]);
  const valorAluguel = parseDecimal(row[31]);
  const statusContrato = dataInicio && valorAluguel != null ? "VIGENTE" : "RASCUNHO";
  const bancoObj = montarDadosBancarios(row);
  const dadosBancariosRepasseJson =
    Object.keys(bancoObj).length > 0 ? JSON.stringify(bancoObj) : undefined;
  const contrato = {
    imovelId,
    locadorPessoaId: parseInt2(row[4]),
    inquilinoPessoaId: parseInt2(row[26]),
    dataInicio: dataInicio || "1900-01-01",
    dataFim: parseData(row[28], rowFmt?.[28]),
    diaVencimentoAluguel: parseInt2(row[29]),
    valorAluguel: valorAluguel != null ? valorAluguel : 0,
    garantiaTipo: parseTexto(row[32]),
    valorGarantia: parseDecimal(row[33]),
    diaRepasse: parseInt2(row[45]),
    status: statusContrato,
    observacoes: parseTexto(row[54]),
  };
  if (dadosBancariosRepasseJson != null) {
    contrato.dadosBancariosRepasseJson = dadosBancariosRepasseJson;
  }
  return contrato;
}

function csvEscape(s) {
  if (s == null || s === "") return "";
  const t = String(s).replace(/"/g, '""');
  if (/[",\r\n]/.test(t)) return `"${t}"`;
  return t;
}

function reportLine(parts) {
  return parts.map(csvEscape).join(",");
}

async function fetchClientesMap(baseUrl, token) {
  const url = `${baseUrl}/api/clientes`;
  const r = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!r.ok) {
    const t = await r.text();
    throw new Error(`GET /api/clientes falhou: ${r.status} ${t.slice(0, 200)}`);
  }
  const list = await r.json();
  const map = new Map();
  for (const it of list) {
    const cod = normalizarCodigoCliente(it.codigoCliente);
    const clientePk = clientePkFromApiDto(it);
    if (cod && clientePk != null) {
      map.set(cod, clientePk);
    }
  }
  return map;
}

function resolveClienteId(row, clientesPorCodigo) {
  const cod = normalizarCodigoCliente(row[2]);
  if (!cod || !clientesPorCodigo) return null;
  return clientesPorCodigo.get(cod) ?? null;
}

function isRowIgnorable(row) {
  const np = parseInt2(row[1]);
  return np == null || np < 1;
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  if (opts.layout !== "itamar") {
    console.error("Use --layout=itamar.");
    process.exit(1);
  }
  if (!opts.file) {
    console.error(
      'Uso: node scripts/import-imoveis-planilha.mjs "<ficheiro.xls>" --layout=itamar --login=itamar [--dry-run]'
    );
    process.exit(1);
  }
  const abs = path.resolve(opts.file);
  if (!fs.existsSync(abs)) {
    console.error("Ficheiro nao encontrado:", abs);
    process.exit(1);
  }
  if (!opts.senha && !opts.dryRun) {
    console.error("Defina VILAREAL_IMPORT_SENHA ou use --dry-run.");
    process.exit(1);
  }

  const wb = XLSX.readFile(abs);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const matriz = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });
  const matrizFmt = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: false });
  const linhasDados = matriz.slice(DATA_START_0, DATA_END_EXCLUSIVE);
  const linhasFmt = matrizFmt.slice(DATA_START_0, DATA_END_EXCLUSIVE);
  const entries = [];
  for (let i = 0; i < linhasDados.length; i += 1) {
    const row = linhasDados[i];
    if (!Array.isArray(row) || isRowIgnorable(row)) continue;
    const rowFmt = Array.isArray(linhasFmt[i]) ? linhasFmt[i] : null;
    entries.push({ row, rowFmt, excelLinha: DATA_START_0 + i + 1 });
  }
  const rows = entries.map((e) => e.row);

  console.log(
    `Linhas grelha Excel ${DATA_START_0 + 1}-${DATA_END_EXCLUSIVE}: ${linhasDados.length}; validas (col B): ${entries.length} (${path.basename(abs)})`
  );

  let vigentes = 0;
  let rascunhos = 0;
  for (const { row, rowFmt } of entries) {
    const di = parseData(row[27], rowFmt?.[27]);
    const va = parseDecimal(row[31]);
    if (di && va != null) vigentes += 1;
    else rascunhos += 1;
  }
  console.log(
    `Contratos previstos: VIGENTE~${vigentes}, RASCUNHO~${rascunhos} (data col AB + valor col AF)`
  );

  if (opts.dryRun) {
    const sample = Math.min(3, entries.length);
    for (let i = 0; i < sample; i += 1) {
      const { row, rowFmt, excelLinha } = entries[i];
      const im = buildImovelPayload(row, rowFmt, null, null);
      const ct = buildContratoPayload(0, row, rowFmt);
      console.log(`--- Dry-run Excel linha ${excelLinha} ---`);
      console.log("imovel:", JSON.stringify(im));
      console.log("contrato:", JSON.stringify(ct));
    }
    if (entries.length > sample) {
      console.log(`... e mais ${entries.length - sample} linhas.`);
    }
    process.exit(0);
  }

  const loginUrl = `${opts.baseUrl}/api/auth/login`;
  const loginNorm = String(opts.login).trim().toLowerCase();
  const loginRes = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ login: loginNorm, senha: opts.senha }),
  });
  if (!loginRes.ok) {
    const t = await loginRes.text();
    console.error("Falha no login", loginRes.status, t);
    process.exit(1);
  }
  const loginJson = await loginRes.json();
  const token = loginJson.accessToken;
  if (!token) {
    console.error("Login sem accessToken");
    process.exit(1);
  }

  let clientesPorCodigo;
  try {
    clientesPorCodigo = await fetchClientesMap(opts.baseUrl, token);
  } catch (e) {
    console.error(e.message);
    process.exit(1);
  }

  const reportPath = path.join(process.cwd(), "import-imoveis-report.csv");
  fs.writeFileSync(
    reportPath,
    `${reportLine(["linhaPlanilha", "numeroPlanilha", "imovelId", "contratoId", "status", "mensagem"])}\n`,
    "utf8"
  );

  const conc = opts.concurrency;
  let ok = 0;
  let fail = 0;

  const authHeaders = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  async function buscarImovelPorNumeroPlanilha(numeroPlanilha) {
    const r = await fetch(`${opts.baseUrl}/api/imoveis/por-numero-planilha/${numeroPlanilha}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!r.ok) return null;
    return r.json();
  }

  async function buscarContratoVigente(imovelId) {
    const r = await fetch(`${opts.baseUrl}/api/locacoes/contratos?imovelId=${imovelId}`, {
      headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    });
    if (!r.ok) return null;
    const list = await r.json();
    if (!Array.isArray(list) || list.length === 0) return null;
    const vig = list.find((c) => String(c.status || "").toUpperCase() === "VIGENTE");
    return vig || list[0];
  }

  async function processOne(entry) {
    const { row, rowFmt, excelLinha } = entry;
    const clienteId = resolveClienteId(row, clientesPorCodigo);
    const cod = normalizarCodigoCliente(row[2]);
    const procNi = parseInt2(row[3]);
    let processoId = null;
    if (cod && procNi != null && procNi >= 1) {
      const procEnt = await buscarProcesso(opts.baseUrl, token, cod, procNi);
      processoId = procEnt?.id ?? null;
    }
    const imovelBody = buildImovelPayload(row, rowFmt, clienteId, processoId);
    const np = imovelBody.numeroPlanilha;
    const existente = await buscarImovelPorNumeroPlanilha(np);
    let imovelId;
    let statusImovel = "OK_NOVO";

    if (existente?.id) {
      const imRes = await fetch(`${opts.baseUrl}/api/imoveis/${existente.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(imovelBody),
      });
      const imText = await imRes.text();
      if (!imRes.ok) {
        fs.appendFileSync(
          reportPath,
          `${reportLine([excelLinha, np, existente.id, "", "ERRO_IMOVEL_PUT", imText.slice(0, 400)])}\n`,
          "utf8"
        );
        console.error(`Erro PUT imovel linha ${excelLinha}:`, imRes.status, imText.slice(0, 120));
        return false;
      }
      imovelId = existente.id;
      statusImovel = "OK_ATUALIZADO";
    } else {
      const imRes = await fetch(`${opts.baseUrl}/api/imoveis`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(imovelBody),
      });
      const imText = await imRes.text();
      if (!imRes.ok) {
        const msg = imText.slice(0, 400);
        fs.appendFileSync(
          reportPath,
          `${reportLine([excelLinha, np, "", "", "ERRO_IMOVEL_POST", msg])}\n`,
          "utf8"
        );
        console.error(`Erro POST imovel linha ${excelLinha}:`, imRes.status, msg.slice(0, 120));
        return false;
      }
      try {
        imovelId = JSON.parse(imText).id;
      } catch {
        fs.appendFileSync(
          reportPath,
          `${reportLine([excelLinha, np, "", "", "ERRO_PARSE", imText.slice(0, 200)])}\n`,
          "utf8"
        );
        return false;
      }
    }

    const contratoBody = buildContratoPayload(imovelId, row, rowFmt);
    const contratoExistente = await buscarContratoVigente(imovelId);
    let contratoId = "";
    let ctRes;
    if (contratoExistente?.id) {
      ctRes = await fetch(`${opts.baseUrl}/api/locacoes/contratos/${contratoExistente.id}`, {
        method: "PUT",
        headers: authHeaders,
        body: JSON.stringify(contratoBody),
      });
    } else {
      ctRes = await fetch(`${opts.baseUrl}/api/locacoes/contratos`, {
        method: "POST",
        headers: authHeaders,
        body: JSON.stringify(contratoBody),
      });
    }
    const ctText = await ctRes.text();
    if (!ctRes.ok) {
      fs.appendFileSync(
        reportPath,
        `${reportLine([excelLinha, np, imovelId, "", "ERRO_CONTRATO", ctText.slice(0, 400)])}\n`,
        "utf8"
      );
      console.error(`Erro contrato linha ${excelLinha}:`, ctRes.status, ctText.slice(0, 120));
      return false;
    }
    try {
      contratoId = JSON.parse(ctText).id ?? contratoExistente?.id ?? "";
    } catch {
      contratoId = contratoExistente?.id ?? "";
    }
    fs.appendFileSync(
      reportPath,
      `${reportLine([excelLinha, np, imovelId, contratoId, statusImovel, ""])}\n`,
      "utf8"
    );
    return true;
  }

  const jobs = entries;

  for (let i = 0; i < jobs.length; i += conc) {
    const batch = jobs.slice(i, i + conc);
    const results = await Promise.all(batch.map((j) => processOne(j)));
    for (const r of results) {
      if (r) ok += 1;
      else fail += 1;
    }
    const done = Math.min(i + conc, jobs.length);
    if (done % 10 < conc || done === jobs.length) {
      console.log(`... ${done}/${jobs.length} (ok=${ok} falhas=${fail})`);
    }
  }

  console.log(`Concluido: ${ok} OK, ${fail} falhas. CSV: ${reportPath}`);
  process.exit(fail > 0 ? 2 : 0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});