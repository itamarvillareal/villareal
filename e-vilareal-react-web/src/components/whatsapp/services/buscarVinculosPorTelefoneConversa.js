/**
 * Busca pessoas vinculadas ao telefone da conversa WhatsApp e seus vínculos (cód. + proc.).
 */

import { pesquisarCadastroPessoasPorTelefone } from '../../../api/clientesService.js';
import { carregarProcessosVinculoPessoa } from '../../../data/pessoaVinculosProcessos.js';
import { listarCodigosClientePorIdPessoaAsync } from '../../../data/clienteCodigoHelpers.js';
import { normalizePhoneForApi } from '../../../utils/whatsappFormat.js';

function padCliente8(cod) {
  const d = String(cod ?? '1').replace(/\D/g, '') || '1';
  const n = Math.max(1, Math.floor(Number(d)) || 1);
  return String(n).padStart(8, '0');
}

function chaveVinculo(codigoCliente, numeroInterno) {
  const cod = padCliente8(codigoCliente);
  const proc = Math.floor(Number(String(numeroInterno ?? '').replace(/\D/g, '')) || 0);
  return `${cod}-${proc}`;
}

/**
 * Normaliza linhas de processo em pares código + proc. únicos.
 * @param {Array<{ codCliente?: string, codigoCliente?: string, proc?: string|number, numeroInterno?: string|number, papeis?: string, cliente?: string, parteOposta?: string, unidade?: string }>} processos
 * @returns {Array<{ codigoCliente: string, numeroInterno: number, papeis: string, cliente: string, parteOposta: string, unidade: string }>}
 */
export function montarVinculosCodProc(processos) {
  const map = new Map();
  for (const row of processos || []) {
    const codRaw = row.codCliente ?? row.codigoCliente;
    if (codRaw == null || String(codRaw).trim() === '') continue;
    const codigoCliente = padCliente8(codRaw);
    const numeroInterno = Math.floor(Number(String(row.proc ?? row.numeroInterno ?? '').replace(/\D/g, '')) || 0);
    if (!codigoCliente || numeroInterno < 1) continue;
    const key = chaveVinculo(codigoCliente, numeroInterno);
    const parteOposta = String(row.parteOposta ?? '').trim();
    const unidade = String(row.unidade ?? '').trim();
    if (!map.has(key)) {
      map.set(key, {
        codigoCliente,
        numeroInterno,
        papeis: String(row.papeis ?? '').trim(),
        cliente: String(row.cliente ?? '').trim(),
        parteOposta,
        unidade,
      });
      continue;
    }
    const existente = map.get(key);
    if (!existente.parteOposta && parteOposta) existente.parteOposta = parteOposta;
    if (!existente.unidade && unidade) existente.unidade = unidade;
    if (!existente.papeis && row.papeis) existente.papeis = String(row.papeis).trim();
  }
  return [...map.values()].sort((a, b) => chaveVinculo(a.codigoCliente, a.numeroInterno).localeCompare(chaveVinculo(b.codigoCliente, b.numeroInterno)));
}

/**
 * @typedef {{ id: number, nome: string, codigosCliente: string[], vinculos: ReturnType<typeof montarVinculosCodProc> }} PessoaVinculosConversa
 * @typedef {{ telefone: string, pessoas: PessoaVinculosConversa[], erro: string|null }} ResultadoVinculosTelefoneConversa
 */

/**
 * Usa o telefone da conversa ativa, busca pessoas no cadastro e carrega vínculos de cada uma.
 * @param {string} telefoneRaw
 * @returns {Promise<ResultadoVinculosTelefoneConversa>}
 */
export async function buscarVinculosPorTelefoneConversa(telefoneRaw) {
  const telefone = normalizePhoneForApi(telefoneRaw);
  const digits = telefone.replace(/\D/g, '');
  if (digits.length < 4) {
    return { telefone, pessoas: [], erro: 'Telefone inválido para busca no cadastro.' };
  }

  const pessoasEncontradas = await pesquisarCadastroPessoasPorTelefone(digits, { limite: 50 });
  if (!Array.isArray(pessoasEncontradas) || pessoasEncontradas.length === 0) {
    return { telefone, pessoas: [], erro: null };
  }

  const pessoas = await Promise.all(
    pessoasEncontradas.map(async (pessoa) => {
      const id = Math.floor(Number(pessoa?.id));
      const nome = String(pessoa?.nome ?? '').trim();
      const [processos, codigosCliente] = await Promise.all([
        carregarProcessosVinculoPessoa(id, nome),
        listarCodigosClientePorIdPessoaAsync(id),
      ]);
      return {
        id,
        nome: nome || `Pessoa nº ${id}`,
        codigosCliente: Array.isArray(codigosCliente) ? codigosCliente : [],
        vinculos: montarVinculosCodProc(processos),
      };
    }),
  );

  return { telefone, pessoas, erro: null };
}
