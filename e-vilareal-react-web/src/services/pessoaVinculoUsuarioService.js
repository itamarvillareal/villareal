import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';

function classificarTermoBuscaNomeOuCpf(termo) {
  const t = String(termo ?? '').trim();
  if (!t) return { modo: 'vazio' };
  const hasLetters = /[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(t);
  const digits = t.replace(/\D/g, '');
  if (!hasLetters && digits.length > 0) {
    if (digits.length === 11 || digits.length === 14) return { modo: 'cpf', cpfDigits: digits };
    return { modo: 'codigo_ou_doc', digits };
  }
  return { modo: 'nome', nome: t };
}

/**
 * Lista pessoas do cadastro para escolha no fluxo de usuário (nome ou CPF/CNPJ).
 * @param {string} termo
 * @param {number} [limite=40]
 * @returns {Promise<Array<{ id: number, nome: string, cpf: string }>>}
 */
export async function pesquisarPessoasParaVinculoUsuario(termo, limite = 40) {
  const parsed = classificarTermoBuscaNomeOuCpf(termo);
  if (parsed.modo === 'vazio') return [];

  const arr = await pesquisarCadastroPessoasPorNomeOuCpf(termo, { limite });
  return (arr || []).map((p) => ({
    id: Number(p.id),
    nome: String(p.nome ?? ''),
    cpf: String(p.cpf ?? '').replace(/\D/g, ''),
  }));
}

/**
 * Resolve pessoa do cadastro para vínculo com usuário (API).
 *
 * @param {number} id
 * @returns {Promise<{ id?: number, nome?: string } | null>}
 */
export async function obterPessoaParaVinculoUsuario(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n < 1) return null;

  try {
    const p = await buscarCliente(n);
    return p ?? null;
  } catch {
    return null;
  }
}
