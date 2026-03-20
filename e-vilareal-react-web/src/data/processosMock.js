// Mock explícito para clientes 1–10 e processos 1–10.
// Usado para testes previsíveis e consistentes entre telas (Processos/Cálculos/Diagnósticos).
// O seed em processosHistoricoData.js (ensureHistoricoDemonstracaoDiagnostico) usa estes dados para o localStorage.

const pad3 = (n) => String(n).padStart(3, '0');
const pad2 = (n) => String(n).padStart(2, '0');
const pad8 = (n) => String(n).padStart(8, '0');

const NOMES_CLIENTE = [
  'ALFA COMÉRCIO LTDA',
  'BETA SERVIÇOS EIRELI',
  'GAMMA INDÚSTRIA S/A',
  'DELTA LOGÍSTICA LTDA',
  'ÉPSILON PARTICIPAÇÕES',
  'ZETA HOLDING LTDA',
  'ETA TECNOLOGIA LTDA',
  'THETA CONSULTORIA',
  'IOTA IMÓVEIS LTDA',
  'KAPPA ALIMENTOS LTDA',
];

function autorNome(clienteNum) {
  return `${NOMES_CLIENTE[(clienteNum - 1) % NOMES_CLIENTE.length]} (CLIENTE ${pad3(clienteNum)})`;
}

function reuNome(clienteNum, procNum) {
  const base = (clienteNum * 7 + procNum * 13) % 999;
  return `RÉU ${pad3(base)} — PROC ${pad2(procNum)}`;
}

function numeroProcessoNovo(clienteNum, procNum) {
  const seq = 5600000 + clienteNum * 41 + procNum * 9;
  const dv = String(10 + ((clienteNum + procNum) % 90)).padStart(2, '0');
  const foro = String(1000 + ((clienteNum * 11) % 900)).slice(-4);
  return `${String(seq).slice(0, 7)}-${dv}.2025.8.09.${foro}`;
}

export function getMockProcesso10x10(codigoCliente, processo) {
  const c = Number(String(codigoCliente ?? '').trim());
  const p = Number(String(processo ?? '').trim());
  if (!Number.isFinite(c) || !Number.isFinite(p)) return null;
  const clienteNum = Math.floor(c);
  const procNum = Math.floor(p);
  if (clienteNum < 1 || clienteNum > 10 || procNum < 1 || procNum > 10) return null;

  return {
    codigoCliente: pad8(clienteNum),
    processo: procNum,
    autor: autorNome(clienteNum),
    reu: reuNome(clienteNum, procNum),
    parteCliente: `PARTE CLIENTE — ${autorNome(clienteNum)} — PROC ${pad2(procNum)}`,
    parteOposta: `PARTE OPOSTA — ${reuNome(clienteNum, procNum)}`,
    numeroProcessoVelho: '',
    numeroProcessoNovo: numeroProcessoNovo(clienteNum, procNum),
  };
}

