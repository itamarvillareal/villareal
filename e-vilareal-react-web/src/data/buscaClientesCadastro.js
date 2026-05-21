import { normalizarTextoBusca } from '../components/CadastroClientes.jsx';
import { featureFlags } from '../config/featureFlags.js';
import { padCliente8Cadastro } from './cadastroClientesStorage.js';
import { normalizarCodigoClienteFinanceiro } from './financeiroData.js';
import {
  listarRegistrosProcessosHistoricoNormalizados,
} from './processosHistoricoData.js';
import {
  resolverClienteCadastroPorCodigo,
} from '../repositories/clientesRepository.js';
import { listarProcessosPorNumeroInterno } from '../repositories/processosRepository.js';

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
 * Pesquisa clientes no índice de cadastro (nome/razão, código 8 dígitos, CPF/CNPJ ou nº interno do processo),
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
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0 || n > 2_147_483_647) return [];
    const hits = [];
    if (featureFlags.useApiProcessos) {
      const arr = await listarProcessosPorNumeroInterno(n);
      for (const p of arr || []) {
        if (hits.length >= limite) break;
        const cod8 = padCliente8Cadastro(p.codigoCliente);
        const idxRow = (clientesApiIndex || []).find((c) => c.codigo === cod8);
        const nomeCli = String(idxRow?.nomeRazao ?? '').trim();
        const cnj = String(p.numeroCnj ?? '').trim();
        const po = String(p.parteOposta ?? '').trim();
        const rotulo = [
          nomeCli || `Cliente ${cod8}`,
          `Proc. ${p.numeroInterno ?? n}`,
          cnj ? `CNJ ${cnj}` : null,
          po ? (po.length > 100 ? `${po.slice(0, 100)}…` : po) : null,
        ]
          .filter(Boolean)
          .join(' · ');
        const codigoNum = Number(String(cod8).replace(/\D/g, '')) || 0;
        const m = toModalRow({
          codigoPadded: cod8,
          codigoNum,
          nome: rotulo,
          cnpjCpf: String(idxRow?.cnpjCpf ?? '').replace(/\D/g, ''),
        });
        if (m) hits.push(m);
      }
    } else {
      const seen = new Set();
      for (const reg of listarRegistrosProcessosHistoricoNormalizados()) {
        if (Number(reg.proc) !== n) continue;
        const codJur = String(reg.codCliente ?? '').trim();
        const codNum = Number(String(codJur).replace(/^0+/, '') || 0);
        if (!Number.isFinite(codNum) || codNum < 1) continue;
        const cod8 = padCliente8Cadastro(codNum);
        if (seen.has(cod8)) continue;
        seen.add(cod8);
        const nomeC = String(reg.cliente ?? '').trim() || `Cliente ${cod8}`;
        const m = toModalRow({
          codigoPadded: cod8,
          codigoNum: codNum,
          nome: `${nomeC} · proc. ${n}`,
          cnpjCpf: '',
        });
        if (m) hits.push(m);
        if (hits.length >= limite) break;
      }
    }
    return hits;
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
