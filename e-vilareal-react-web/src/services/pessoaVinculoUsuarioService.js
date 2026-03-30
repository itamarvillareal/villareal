import { buscarCliente, pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';
import {
  getPessoaPorIdIncluindoNovosLocais,
  getCadastroPessoasMockComNovosLocais,
} from '../data/cadastroPessoasMockNovosLocal.js';

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

  if (import.meta.env.VITE_USE_MOCK_CADASTRO_PESSOAS === 'true') {
    const lista = getCadastroPessoasMockComNovosLocais(false);
    const nomeLower = String(parsed.nome ?? '').toLowerCase();
    const out = [];
    for (const p of lista) {
      const pid = Number(p.id);
      if (!Number.isFinite(pid)) continue;
      const idStr = String(pid);
      const cpfD = String(p.cpf ?? '').replace(/\D/g, '');
      let ok = false;
      if (parsed.modo === 'cpf') {
        ok = cpfD.includes(parsed.cpfDigits);
      } else if (parsed.modo === 'codigo_ou_doc') {
        const d = parsed.digits;
        ok =
          idStr === d ||
          idStr.startsWith(d) ||
          (d.length >= 3 && cpfD.includes(d));
      } else {
        ok = String(p.nome ?? '').toLowerCase().includes(nomeLower);
      }
      if (ok) {
        out.push({
          id: pid,
          nome: String(p.nome ?? ''),
          cpf: cpfD,
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
