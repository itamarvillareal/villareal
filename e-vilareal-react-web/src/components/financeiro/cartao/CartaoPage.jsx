import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CreditCard } from 'lucide-react';
import { featureFlags } from '../../../config/featureFlags.js';
import {
  listarCartoesFinanceiro,
  listarLancamentosCartaoFinanceiro,
} from '../../../repositories/financeiroRepository.js';
import { Pagination } from '../shared/Pagination.jsx';
import { ValorText } from '../shared/ValorText.jsx';
import { ExtratoSkeleton } from '../shared/LoadingSkeleton.jsx';
import { formatDataCurta } from '../shared/financeiroFormat.js';
import { ContaBadge } from '../shared/ContaBadge.jsx';
import { buildContaToLetraMerge, loadPersistedContasContabeisExtrasFinanceiro } from '../../../data/financeiroData.js';

function contaLetra(nome, map) {
  return map[nome] || 'N';
}

export function CartaoPage() {
  const { id } = useParams();
  const numeroParam = id != null && id !== '' ? Number(id) : null;

  const [cartoes, setCartoes] = useState([]);
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(false);
  const [erro, setErro] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);

  const contaToLetra = useMemo(
    () => buildContaToLetraMerge(loadPersistedContasContabeisExtrasFinanceiro()),
    [],
  );

  const cartaoAtivo = useMemo(() => {
    if (!numeroParam || !Number.isFinite(numeroParam)) return null;
    return cartoes.find((c) => Number(c.numeroCartao) === numeroParam) ?? null;
  }, [cartoes, numeroParam]);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro) return undefined;
    const ac = new AbortController();
    listarCartoesFinanceiro({ signal: ac.signal })
      .then((c) => setCartoes(Array.isArray(c) ? c : []))
      .catch(() => setCartoes([]));
    return () => ac.abort();
  }, []);

  useEffect(() => {
    if (!featureFlags.useApiFinanceiro || !cartaoAtivo?.id) {
      setRows([]);
      return undefined;
    }
    const ac = new AbortController();
    setLoading(true);
    setErro('');
    listarLancamentosCartaoFinanceiro({ cartaoId: cartaoAtivo.id }, { signal: ac.signal })
      .then((lista) => setRows(Array.isArray(lista) ? lista : []))
      .catch((e) => {
        if (e?.name !== 'AbortError') setErro(e?.message || 'Erro ao carregar extrato do cartão.');
      })
      .finally(() => setLoading(false));
    return () => ac.abort();
  }, [cartaoAtivo?.id]);

  useEffect(() => {
    setPage(0);
  }, [cartaoAtivo?.id]);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const pageRows = rows.slice(page * pageSize, page * pageSize + pageSize);

  if (!featureFlags.useApiFinanceiro) {
    return <p className="p-4 text-sm text-slate-600">API financeiro desativada.</p>;
  }

  if (!numeroParam || !Number.isFinite(numeroParam)) {
    return (
      <div className="p-4">
        <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100 mb-3">Cartões</h2>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {cartoes.map((c) => (
            <li key={c.id}>
              <Link
                to={`/financeiro/cartao/${c.numeroCartao}`}
                className="flex items-center gap-2 p-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-amber-400 transition-colors"
              >
                <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />
                <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{c.nome}</span>
              </Link>
            </li>
          ))}
        </ul>
        {cartoes.length === 0 ? (
          <p className="text-sm text-slate-500 mt-4">Nenhum cartão cadastrado.</p>
        ) : null}
      </div>
    );
  }

  if (!cartaoAtivo) {
    return (
      <p className="p-4 text-sm text-slate-600">
        Cartão não encontrado.{' '}
        <Link to="/financeiro/cartao" className="text-blue-600 hover:underline">
          Ver lista
        </Link>
      </p>
    );
  }

  return (
    <div className="flex flex-col min-h-0 h-full bg-white dark:bg-slate-900">
      <header className="px-3 py-2 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between gap-2">
        <h2 className="text-sm font-medium text-slate-900 dark:text-slate-100">
          {cartaoAtivo.nome}
        </h2>
        <Link to="/financeiro/cartao" className="text-xs text-blue-600 hover:underline shrink-0">
          Todos os cartões
        </Link>
      </header>

      {erro ? (
        <p className="px-3 py-2 text-sm text-red-600 dark:text-red-400">{erro}</p>
      ) : null}

      <div className="flex-1 min-h-0 overflow-auto">
        {loading ? (
          <ExtratoSkeleton />
        ) : (
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr
                className="text-xs font-medium text-slate-500"
                style={{ background: 'var(--fin-header-bg)' }}
              >
                <th className="px-2 py-2 text-left w-[72px]">Data</th>
                <th className="px-2 py-2 text-left">Descrição</th>
                <th className="px-2 py-2 text-right w-[100px]">Valor</th>
                <th className="px-2 py-2 text-left w-[80px]">Categoria</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-10 text-center text-slate-500">
                    Nenhum lançamento neste cartão.
                  </td>
                </tr>
              ) : (
                pageRows.map((row, i) => {
                  const letra = contaLetra(row.contaContabilNome, contaToLetra);
                  const valor = Number(row.valor) || 0;
                  const natureza = valor < 0 ? 'DEBITO' : 'CREDITO';
                  return (
                    <tr
                      key={row.id}
                      className="border-b border-slate-100 dark:border-slate-800"
                      style={{ background: i % 2 ? 'var(--fin-row-alt)' : 'transparent' }}
                    >
                      <td className="px-2 py-1.5 text-slate-500 whitespace-nowrap">
                        {formatDataCurta(row.dataLancamento)}
                      </td>
                      <td className="px-2 py-1.5 text-slate-900 dark:text-slate-100">
                        {row.descricao}
                        <span className="ml-2 inline-block align-middle">
                          <ContaBadge codigo={letra} />
                        </span>
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        <ValorText valor={Math.abs(valor)} natureza={natureza} />
                      </td>
                      <td className="px-2 py-1.5 text-xs text-slate-500 truncate max-w-[120px]">
                        {row.descricaoDetalhada || row.contaContabilNome || '—'}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>

      <Pagination
        page={page}
        totalPages={totalPages}
        totalItems={total}
        pageSize={pageSize}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  );
}
