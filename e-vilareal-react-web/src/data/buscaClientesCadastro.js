import { normalizarTextoBusca } from '../components/CadastroClientes.jsx';
import { featureFlags } from '../config/featureFlags.js';
import { padCliente8Cadastro } from './cadastroClientesStorage.js';
import { normalizarCodigoClienteFinanceiro } from './financeiroData.js';
import {
  resolverClienteCadastroPorCodigo,
} from '../repositories/clientesRepository.js';

function formatDocBR(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d || '—';
}

function buildIndiceClientesPorNome(clientesApiIndex) {
  const out = [];
  for (const c of clientesApiIndex || []) {
    const codP = String(c.codigo ?? '').trim();
    if (!codP) continue;
    const codigoNum = Number(codP.replace(/\D/g, '')) || 0;
    const nome =
      String(c.nomeRazao ?? '').trim() ||
      (c.pessoa ? `Pessoa nº ${String(c.pessoa).replace(/\D/g, '')}` : `Cliente ${codP}`);
    out.push({
      codigoPadded: codP.length === 8 ? codP : padCliente8Cadastro(codP),
      codigoNum,
      nome,
      cnpjCpf: String(c.cnpjCpf ?? '').replace(/\D/g, ''),
    });
  }
  out.sort((a, b) => a.codigoNum - b.codigoNum);
  return out;
}

function toModalRow(row) {
  const codCliente = normalizarCodigoClienteFinanceiro(row.codigoNum);
  if (!codCliente) return null;
  return {
    codCliente,
    codigoPadded: row.codigoPadded,
    nomeCliente: row.nome,
    cpfLabel: formatDocBR(row.cnpjCpf),
  };
}

function termoPermiteBusca(raw) {
  const t = String(raw ?? '').trim();
  if (!t) return false;
  if (/^\d{8}$/.test(t)) return true;
  if (/^\d+$/.test(t)) return true;
  return normalizarTextoBusca(t).length >= 2;
}

/**
 * Filtra o índice local por código do cliente (8 dígitos exatos ou sufixo numérico, ex.: 491 → 00000491).
 * @param {Array<{ codigoPadded: string, codigoNum: number, nome: string, cnpjCpf?: string }>} indice
 */
export function filtrarClientesIndicePorCodigo(indice, termoRaw, { limite = 80 } = {}) {
  const raw = String(termoRaw ?? '').trim();
  if (!/^\d+$/.test(raw)) return [];

  const digits = raw.replace(/\D/g, '');
  const vistos = new Set();
  const hits = [];

  function push(row) {
    if (!row || vistos.has(row.codigoPadded) || hits.length >= limite) return;
    vistos.add(row.codigoPadded);
    hits.push(row);
  }

  if (/^\d{8}$/.test(raw)) {
    const cod8 = padCliente8Cadastro(raw);
    push(indice.find((r) => r.codigoPadded === cod8));
    hits.sort((a, b) => a.codigoNum - b.codigoNum);
    return hits;
  }

  const cod8Tentativa = padCliente8Cadastro(digits);
  push(indice.find((r) => r.codigoPadded === cod8Tentativa));

  for (const row of indice) {
    if (hits.length >= limite) break;
    const pad = row.codigoPadded;
    const numStr = String(row.codigoNum);
    if (
      pad.endsWith(digits) ||
      numStr === digits ||
      (digits.length >= 2 && numStr.endsWith(digits))
    ) {
      push(row);
    }
  }
  hits.sort((a, b) => a.codigoNum - b.codigoNum);
  return hits;
}

/**
 * Pesquisa clientes no índice de cadastro (nome/razão, código 8 dígitos ou parcial, CPF/CNPJ),
 * alinhada à seção «Buscar cliente» da tela /pessoas — não usa o cadastro de pessoas.
 *
 * @returns {Promise<Array<{ codCliente: string, codigoPadded: string, nomeCliente: string, cpfLabel: string }>>}
 */
export async function pesquisarClientesCadastroPorTermo(termoRaw, clientesApiIndex, { limite = 80 } = {}) {
  const raw = String(termoRaw ?? '').trim();
  if (!termoPermiteBusca(raw)) return [];

  const indice = buildIndiceClientesPorNome(clientesApiIndex);
  const soDigitos = raw.length > 0 && /^\d+$/.test(raw);
  const codigo8 = /^\d{8}$/.test(raw);
  const digits = raw.replace(/\D/g, '');
  const pareceCpfCnpj = digits.length === 11 || digits.length === 14;

  if (soDigitos && codigo8) {
    const cod8 = padCliente8Cadastro(raw);
    let hit = indice.find((r) => r.codigoPadded === cod8);
    if (!hit && featureFlags.useApiClientes) {
      const resolved = await resolverClienteCadastroPorCodigo(raw);
      if (resolved) {
        const codigoNum = Number(String(resolved.codigo ?? '').replace(/\D/g, '')) || 0;
        hit = {
          codigoPadded: String(resolved.codigo ?? cod8),
          codigoNum,
          nome: String(resolved.nomeRazao ?? '').trim() || `Cliente ${cod8}`,
          cnpjCpf: String(resolved.cnpjCpf ?? '').replace(/\D/g, ''),
        };
      }
    }
    const row = hit ? toModalRow(hit) : null;
    return row ? [row] : [];
  }

  if (soDigitos && pareceCpfCnpj) {
    const hits = [];
    for (const row of indice) {
      if (hits.length >= limite) break;
      if (row.cnpjCpf && (row.cnpjCpf.includes(digits) || digits.includes(row.cnpjCpf))) {
        const m = toModalRow(row);
        if (m) hits.push(m);
      }
    }
    return hits;
  }

  if (soDigitos && !codigo8 && !pareceCpfCnpj && featureFlags.useApiClientes) {
    const resolved = await resolverClienteCadastroPorCodigo(digits || raw);
    if (resolved) {
      const codigoPadded = String(resolved.codigo ?? '').trim() || padCliente8Cadastro(raw);
      const codigoNum = Number(String(codigoPadded).replace(/\D/g, '')) || 0;
      const m = toModalRow({
        codigoPadded,
        codigoNum,
        nome: String(resolved.nomeRazao ?? '').trim() || `Cliente ${codigoPadded}`,
        cnpjCpf: String(resolved.cnpjCpf ?? '').replace(/\D/g, ''),
      });
      if (m) return [m];
    }
  }

  if (soDigitos && !codigo8 && !pareceCpfCnpj) {
    const rows = filtrarClientesIndicePorCodigo(indice, raw, { limite });
    return rows.map((row) => toModalRow(row)).filter(Boolean);
  }

  const t = normalizarTextoBusca(raw);
  if (t.length < 2) return [];
  const hits = [];
  for (const row of indice) {
    if (hits.length >= limite) break;
    if (normalizarTextoBusca(row.nome).includes(t)) {
      const m = toModalRow(row);
      if (m) hits.push(m);
    }
  }
  return hits;
}

export { termoPermiteBusca as termoPermiteBuscaClienteCadastro };
