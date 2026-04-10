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
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <label className="text-xs font-medium text-slate-600">Localizar por</label>
          <select
            value={criterioBusca}
            onChange={(e) => setCriterioBusca(e.target.value)}
            className="rounded border border-slate-300 px-2 py-1.5 text-sm bg-white"
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
            className="w-52 rounded border border-slate-300 px-2 py-1.5 text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
          <input
            type="checkbox"
            checked={apenasAtivos}
            onChange={(e) => setApenasAtivos(e.target.checked)}
            className="rounded border-slate-300"
          />
          Apenas ativos
        </label>
        <button
          type="button"
          onClick={() => onNovoUsuario?.()}
          className="inline-flex items-center gap-1.5 rounded border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-medium text-indigo-900 hover:bg-indigo-100 ml-auto"
        >
          <UserPlus className="h-4 w-4 shrink-0" aria-hidden />
          Novo usuário
        </button>
      </div>

      {error ? (
        <div className="rounded border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{error}</div>
      ) : null}

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <div className="px-3 py-2 border-b border-slate-200 bg-slate-50 flex items-center gap-2 text-xs text-slate-600">
          <Search className="h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {loading ? 'Carregando…' : `${totalElements} registro(s)`} — mesma paginação do relatório de pessoas
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="table-fixed w-full min-w-[44rem] text-sm">
            <thead className="bg-slate-100 text-slate-700 font-medium text-left">
              <tr>
                <th className="px-3 py-2 w-14">Id</th>
                <th className="px-3 py-2 w-[28%]">Nome (Pessoas)</th>
                <th className="px-3 py-2 w-[18%]">Apelido</th>
                <th className="px-3 py-2 w-28">Login</th>
                <th className="px-3 py-2 w-24">Pessoa nº</th>
                <th className="px-3 py-2 w-16">Ativo</th>
                <th className="px-3 py-2 text-right w-[11rem]">Ações</th>
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
                  <tr key={String(u.id)} className="hover:bg-slate-50/80">
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
                          className="inline-flex items-center gap-1 rounded border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-800 hover:bg-slate-50"
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
                          className="inline-flex items-center gap-1 rounded border border-indigo-200 bg-indigo-50 px-2 py-1 text-xs font-medium text-indigo-900 hover:bg-indigo-100"
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
                            className="rounded border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-50"
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
