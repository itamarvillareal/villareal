import { useState, useEffect, useCallback, useRef } from 'react';
import { Search, Shield, UserPlus, UserRoundCog } from 'lucide-react';
import { TablePaginationBar } from '../ui/TablePaginationBar.jsx';
import { clampCadastroPessoasPageSize } from '../../api/clientesService.js';
import { listarUsuariosPaginados, alternarUsuarioAtivo } from '../../repositories/usuariosRepository.js';
import { getNomeExibicaoUsuario } from '../../data/usuarioDisplayHelpers.js';

const LS_PAGE_SIZE = 'vilareal:pageSize:usuarios';

const CRITERIOS = [
  { value: 'nome', label: 'Apelido ou nome de cadastro (API)' },
  { value: 'login', label: 'Login' },
  { value: 'codigo', label: 'Código (id)' },
  { value: 'nomePessoa', label: 'Nome da pessoa' },
];

function readInitialPageSize() {
  try {
    const raw = localStorage.getItem(LS_PAGE_SIZE);
    if (raw == null) return 25;
    return clampCadastroPessoasPageSize(Number(raw));
  } catch {
    return 25;
  }
}

function buildQueryFromCriterio(criterioBusca, valorBusca) {
  const v = String(valorBusca ?? '').trim();
  const out = { nome: undefined, login: undefined, codigo: undefined, nomePessoa: undefined };
  if (!v) return out;
  if (criterioBusca === 'nome') out.nome = v;
  if (criterioBusca === 'login') out.login = v;
  if (criterioBusca === 'codigo') {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 1) out.codigo = n;
  }
  if (criterioBusca === 'nomePessoa') out.nomePessoa = v;
  return out;
}

export function UsuariosListaApiPaginada({
  refreshKey = 0,
  onAposMutacao,
  onAbrirDados,
  onAbrirPermissoes,
  onNovoUsuario,
}) {
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(readInitialPageSize);
  const [apenasAtivos, setApenasAtivos] = useState(false);
  const [criterioBusca, setCriterioBusca] = useState('nome');
  const [valorBusca, setValorBusca] = useState('');
  const [debounced, setDebounced] = useState({
    criterioBusca: 'nome',
    valorBusca: '',
    apenasAtivos: false,
  });
  const debounceRef = useRef(null);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebounced({ criterioBusca, valorBusca, apenasAtivos });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [criterioBusca, valorBusca, apenasAtivos]);

  useEffect(() => {
    setPage(0);
  }, [debounced]);

  const carregar = useCallback(async () => {
    void refreshKey;
    const q = buildQueryFromCriterio(debounced.criterioBusca, debounced.valorBusca);
    setLoading(true);
    setError('');
    try {
      const res = await listarUsuariosPaginados({
        page,
        size: pageSize,
        apenasAtivos: debounced.apenasAtivos,
        nome: q.nome,
        login: q.login,
        codigo: q.codigo,
        nomePessoa: q.nomePessoa,
      });
      setPageData(res);
    } catch (e) {
      setPageData(null);
      setError(e?.message || 'Erro ao carregar usuários.');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, debounced, refreshKey]);

  useEffect(() => {
    void carregar();
  }, [carregar]);

  const totalElements = Number(pageData?.totalElements ?? 0);
  const totalPages = Math.max(0, Number(pageData?.totalPages ?? 0));
  const content = Array.isArray(pageData?.content) ? pageData.content : [];

  const persistPageSize = (n) => {
    const v = clampCadastroPessoasPageSize(n);
    try {
      localStorage.setItem(LS_PAGE_SIZE, String(v));
    } catch {
      /* ignore */
    }
    setPageSize(v);
    setPage(0);
  };

  useEffect(() => {
    if (totalPages <= 0) {
      if (page !== 0) setPage(0);
      return;
    }
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [totalPages, page]);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-slate-200/90 bg-white/80 backdrop-blur-sm p-4 shadow-sm ring-1 ring-indigo-500/10">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="text-xs font-medium text-slate-600">Localizar por</label>
            <select
              value={criterioBusca}
              onChange={(e) => setCriterioBusca(e.target.value)}
              className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm bg-white shadow-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            >
              {CRITERIOS.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
            <input
              type="search"
              value={valorBusca}
              onChange={(e) => setValorBusca(e.target.value)}
              placeholder="Digite para filtrar…"
              className="w-52 rounded-lg border border-slate-200 px-2 py-1.5 text-sm shadow-sm focus:ring-2 focus:ring-indigo-300 focus:border-indigo-400"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={apenasAtivos}
              onChange={(e) => setApenasAtivos(e.target.checked)}
              className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            Apenas ativos
          </label>
          <button
            type="button"
            onClick={() => onNovoUsuario?.()}
            className="inline-flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-indigo-500/20 hover:from-indigo-500 hover:to-violet-500 ml-auto"
          >
            <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
            Novo usuário
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 shadow-sm">{error}</div>
      ) : null}

      <div className="border border-slate-200/90 rounded-2xl overflow-hidden bg-white shadow-md ring-1 ring-indigo-500/10">
        <div className="px-3 py-2.5 border-b border-white/20 bg-gradient-to-r from-indigo-600 to-violet-700 flex items-center gap-2 text-xs font-medium text-white">
          <Search className="h-3.5 w-3.5 shrink-0 opacity-90" aria-hidden />
          <span>
            {loading ? 'Carregando…' : `${totalElements} registro(s)`} — mesma paginação do relatório de pessoas
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-fixed w-full min-w-[44rem] text-sm">
            <thead className="bg-slate-50 text-slate-700 font-semibold text-left text-xs uppercase tracking-wide border-b border-slate-200">
              <tr>
                <th className="px-3 py-2.5 w-14">Id</th>
                <th className="px-3 py-2.5 w-[28%]">Nome (Pessoas)</th>
                <th className="px-3 py-2.5 w-[18%]">Apelido</th>
                <th className="px-3 py-2.5 w-28">Login</th>
                <th className="px-3 py-2.5 w-24">Pessoa nº</th>
                <th className="px-3 py-2.5 w-16">Ativo</th>
                <th className="px-3 py-2.5 text-right w-[11rem]">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    Carregando…
                  </td>
                </tr>
              ) : content.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    Nenhum usuário nesta página.
                  </td>
                </tr>
              ) : (
                content.map((u) => (
                  <tr key={String(u.id)} className="hover:bg-indigo-50/40 transition-colors">
                    <td className="px-3 py-2 font-mono text-xs text-slate-600">{u.id}</td>
                    <td className="px-3 py-2 text-slate-900 align-top overflow-hidden">
                      <div className="truncate" title={String(u.nomePessoa ?? '').trim() || undefined}>
                        {String(u.nomePessoa ?? '').trim() || '—'}
                      </div>
                    </td>
                    <td className="px-3 py-2 text-slate-900 align-top overflow-hidden">
                      <div className="truncate" title={getNomeExibicaoUsuario(u) || undefined}>
                        {getNomeExibicaoUsuario(u)}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-slate-700">{u.login || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs">{u.numeroPessoa ?? '—'}</td>
                    <td className="px-3 py-2 text-xs">{u.ativo === false ? 'Não' : 'Sim'}</td>
                    <td className="px-3 py-2 text-right whitespace-nowrap">
                      <div className="inline-flex flex-wrap gap-1 justify-end">
                        <button
                          type="button"
                          onClick={() => onAbrirDados?.(u)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50 shadow-sm"
                        >
                          <UserRoundCog className="h-3.5 w-3.5" aria-hidden />
                          Dados
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            onAbrirPermissoes?.({
                              id: u.id,
                              nome: getNomeExibicaoUsuario(u),
                            })
                          }
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-100 shadow-sm"
                        >
                          <Shield className="h-3.5 w-3.5" aria-hidden />
                          Permissões
                        </button>
                        {u.ativo !== false ? (
                          <button
                            type="button"
                            onClick={async () => {
                              if (!window.confirm('Inativar este usuário?')) return;
                              try {
                                await alternarUsuarioAtivo(u.id, false);
                                await onAposMutacao?.();
                              } catch (e) {
                                window.alert(e?.message || 'Erro ao inativar.');
                              }
                            }}
                            className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 shadow-sm"
                          >
                            Inativar
                          </button>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <TablePaginationBar
          page={page}
          totalPages={totalPages}
          totalElements={totalElements}
          pageSize={pageSize}
          onPageChange={setPage}
          onPageSizeChange={persistPageSize}
          loading={loading}
          idPrefix="usuarios-api"
        />
      </div>
    </div>
  );
}
