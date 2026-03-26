import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';
import {
  getPessoaPorIdIncluindoNovosLocais,
  getCadastroPessoasMockComNovosLocais,
} from '../data/cadastroPessoasMockNovosLocal.js';

function classificarTermoBuscaNomeOuCpf(termo) {
  const t = String(termo ?? '').trim();
  if (!t) return { modo: 'vazio', nome: '', cpfDigits: '' };
  const hasLetters = /[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(t);
  const digits = t.replace(/\D/g, '');
  if (!hasLetters && digits.length >= 3) return { modo: 'cpf', nome: '', cpfDigits: digits };
  return { modo: 'nome', nome: t, cpfDigits: '' };
}

/**
 * Lista pessoas do cadastro para escolha no fluxo de usuário (nome ou CPF/CNPJ).
 * @param {string} termo
 * @param {number} [limite=40]
 * @returns {Promise<Array<{ id: number, nome: string, cpf: string }>>}
 */
export async function pesquisarPessoasParaVinculoUsuario(termo, limite = 40) {
  const { modo, nome, cpfDigits } = classificarTermoBuscaNomeOuCpf(termo);
  if (modo === 'vazio') return [];

  if (import.meta.env.VITE_USE_MOCK_CADASTRO_PESSOAS === 'true') {
    const lista = getCadastroPessoasMockComNovosLocais(false);
    const nomeLower = nome.toLowerCase();
    const out = [];
    for (const p of lista) {
      const pid = Number(p.id);
      if (!Number.isFinite(pid)) continue;
      let ok = false;
      if (modo === 'cpf') {
        ok = String(p.cpf ?? '').replace(/\D/g, '').includes(cpfDigits);
      } else {
        ok = String(p.nome ?? '').toLowerCase().includes(nomeLower);
      }
      if (ok) {
        out.push({
          id: pid,
          nome: String(p.nome ?? ''),
          cpf: String(p.cpf ?? '').replace(/\D/g, ''),
        });
      }
      if (out.length >= limite) break;
    }
    return out;
  }

  const arr = await pesquisarCadastroPessoasPorNomeOuCpf(termo, { limite });
  return (arr || []).map((p) => ({
    id: Number(p.id),
    nome: String(p.nome ?? ''),
    cpf: String(p.cpf ?? '').replace(/\D/g, ''),
  }));
}

/**
 * Resolve pessoa do Cadastro de Pessoas para vínculo com usuário.
 * Mock: lista PDF + pessoas criadas localmente. API: GET /api/cadastro-pessoas/{id}.
 *
 * @param {number} id
 * @returns {Promise<{ id?: number, nome?: string } | null>}
 */
export async function obterPessoaParaVinculoUsuario(id) {
  const n = Number(id);
  if (!Number.isFinite(n) || n < 1) return null;

  if (import.meta.env.VITE_USE_MOCK_CADASTRO_PESSOAS === 'true') {
    return getPessoaPorIdIncluindoNovosLocais(n) || null;
  }

  try {
    const p = await buscarCliente(n);
    return p ?? null;
  } catch {
    return null;
  }
}
