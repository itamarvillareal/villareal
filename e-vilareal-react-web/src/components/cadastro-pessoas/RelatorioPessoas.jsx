import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FileText, Link2, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import {
  listarClientesPaginados,
  excluirCliente,
  clampCadastroPessoasPageSize,
} from '../../api/clientesService';
import { TablePaginationBar } from '../ui/TablePaginationBar.jsx';
import {
  listarPessoasComDocumento,
  obterDocumentoPessoa,
  criarUrlParaDocumento,
} from '../../services/pessoaDocumentoService.js';
import { listarCodigosClientePorIdPessoa } from '../../data/clienteCodigoHelpers.js';
import { listarClientesCadastro } from '../../repositories/clientesRepository.js';
import { listarProcessosPorIdPessoa } from '../../data/processosHistoricoData.js';
import { padCliente8Nav } from './cadastroPessoasNavUtils.js';
import { buildRouterStateChaveClienteProcesso } from '../../domain/camposProcessoCliente.js';

const CRITERIOS_BUSCA = [
  { value: 'nome', label: 'Nome' },
  { value: 'codigo', label: 'Código' },
  { value: 'cpf', label: 'CPF/CNPJ' },
];

const LS_PAGE_SIZE = 'vilareal:pageSize:relatorio-pessoas';

function readInitialPageSize() {
  try {
    const raw = localStorage.getItem(LS_PAGE_SIZE);
    if (raw == null) return 25;
    return clampCadastroPessoasPageSize(Number(raw));
  } catch {
    return 25;
  }
}

function buildFiltrosApi({ criterioBusca, valorBusca, valorBuscaCpf }) {
  const v = String(valorBusca ?? '').trim();
  const cpfExtra = String(valorBuscaCpf ?? '').replace(/\D/g, '') || undefined;
  let nome;
  let cpf;
  let codigo;
  if (criterioBusca === 'nome' && v) nome = v;
  if (criterioBusca === 'codigo' && v) {
    const n = parseInt(v, 10);
    if (Number.isFinite(n) && n >= 1) codigo = n;
  }
  if (criterioBusca === 'cpf' && v) {
    const d = v.replace(/\D/g, '');
    if (d) cpf = d;
  }
  return { nome, cpf, codigo, cpfAdicional: cpfExtra };
}

export function RelatorioPessoas() {
  const navigate = useNavigate();
  const [pageData, setPageData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientesCodigosLista, setClientesCodigosLista] = useState([]);
  const [apenasAtivos, setApenasAtivos] = useState(false);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(readInitialPageSize);
  const [criterioBusca, setCriterioBusca] = useState('nome');
  const [valorBusca, setValorBusca] = useState('');
  const [valorBuscaCpf, setValorBuscaCpf] = useState('');
  const [debouncedFiltros, setDebouncedFiltros] = useState({
    criterioBusca: 'nome',
    valorBusca: '',
    valorBuscaCpf: '',
    apenasAtivos: false,
  });
  const debounceRef = useRef(null);
  const [selectedPessoa, setSelectedPessoa] = useState(null);
  const [modalVinculosSistema, setModalVinculosSistema] = useState(false);
  const [pessoasComDocumento, setPessoasComDocumento] = useState(() => listarPessoasComDocumento());

  useEffect(() => {
    let c = true;
    void listarClientesCadastro()
      .then((list) => {
        if (c) setClientesCodigosLista(Array.isArray(list) ? list : []);
      })
      .catch(() => {
        if (c) setClientesCodigosLista([]);
      });
    return () => {
      c = false;
    };
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      setDebouncedFiltros({
        criterioBusca,
        valorBusca,
        valorBuscaCpf,
        apenasAtivos,
      });
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [criterioBusca, valorBusca, valorBuscaCpf, apenasAtivos]);

  useEffect(() => {
    setPage(0);
    setSelectedPessoa(null);
  }, [debouncedFiltros]);

  const carregarApi = useCallback(async () => {
    const { nome, cpf, codigo, cpfAdicional } = buildFiltrosApi(debouncedFiltros);
    const res = await listarClientesPaginados({
      page,
      size: pageSize,
      apenasAtivos: debouncedFiltros.apenasAtivos,
      nome,
      cpf,
      codigo,
      cpfAdicional,
    });
    setPageData(res);
  }, [page, pageSize, debouncedFiltros]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        await carregarApi();
      } catch (err) {
        if (cancelled) return;
        setPageData(null);
        setError(err?.message || 'API indisponível. Verifique o backend e tente novamente.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [carregarApi]);

  const listaExibida = useMemo(
    () => (Array.isArray(pageData?.content) ? pageData.content : []),
    [pageData]
  );

  const totalElements = Number(pageData?.totalElements ?? 0);
  const totalPages = Math.max(0, Number(pageData?.totalPages ?? 0));

  useEffect(() => {
    if (totalPages <= 0) {
      if (page !== 0) setPage(0);
      return;
    }
    if (page > totalPages - 1) setPage(totalPages - 1);
  }, [totalPages, page]);

  useEffect(() => {
    setPessoasComDocumento(listarPessoasComDocumento());
  }, [listaExibida]);

  const pessoaAtual = useMemo(() => {
    if (selectedPessoa?.id != null) {
      const onPage = listaExibida.find((p) => Number(p.id) === Number(selectedPessoa.id));
      if (onPage) return onPage;
      return { id: selectedPessoa.id, nome: selectedPessoa.nome };
    }
    return listaExibida[0];
  }, [selectedPessoa, listaExibida]);

  const idPessoaParaVinculos = useMemo(() => {
    if (pessoaAtual?.id != null) return Number(pessoaAtual.id);
    return null;
  }, [pessoaAtual]);

  const nomeParaVinculos = useMemo(
    () => String(pessoaAtual?.nome || '').trim(),
    [pessoaAtual]
  );

  const vinculosClienteProc = useMemo(() => {
    if (idPessoaParaVinculos == null || !Number.isFinite(idPessoaParaVinculos)) {
      return { codigosCliente: [], processos: [] };
    }
    return {
      codigosCliente: listarCodigosClientePorIdPessoa(idPessoaParaVinculos, clientesCodigosLista),
      processos: listarProcessosPorIdPessoa(idPessoaParaVinculos, nomeParaVinculos),
    };
  }, [idPessoaParaVinculos, nomeParaVinculos, clientesCodigosLista]);

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

  const excluir = async (id, nome) => {
    if (!window.confirm(`Excluir "${nome}"?`)) return;
    setError(null);
    try {
      await excluirCliente(id);
      await carregarApi();
    } catch (err) {
      setError(err.message || 'Erro ao excluir.');
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/40 to-emerald-50/50">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-800 to-violet-800 bg-clip-text text-transparent tracking-tight">
                Relatório de pessoas
              </h1>
              <p className="text-slate-600 mt-1">Todas as pessoas cadastradas — filtros e tabela</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-4 text-sm">
              <div className="px-4 py-2.5 rounded-2xl bg-white/95 backdrop-blur-sm border border-slate-200/90 shadow-md ring-1 ring-indigo-500/10">
                <span className="text-slate-500 block text-xs">Registros</span>
                <span className="text-xl font-semibold text-slate-800 tabular-nums">{loading ? '—' : totalElements}</span>
              </div>
            </div>
          </div>
        </header>

        <section className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/90 ring-1 ring-indigo-500/10 p-4 mb-6">
          <div className="flex flex-wrap items-end gap-4">
            <div className="flex flex-wrap items-center gap-2">
              <label className="text-sm font-medium text-slate-700">Localizar por</label>
              <select
                value={criterioBusca}
                onChange={(e) => setCriterioBusca(e.target.value)}
                className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500"
              >
                {CRITERIOS_BUSCA.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
              <input
                type="text"
                value={valorBusca}
                onChange={(e) => setValorBusca(e.target.value)}
                placeholder={criterioBusca === 'cpf' ? 'CPF' : criterioBusca === 'codigo' ? 'Código' : 'Nome'}
                className="w-48 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-slate-700">CPF/CNPJ</label>
              <input
                type="text"
                value={valorBuscaCpf}
                onChange={(e) => setValorBuscaCpf(e.target.value)}
                placeholder="000.000.000-00"
                className="w-40 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:ring-2 focus:ring-indigo-400 focus:border-indigo-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 ml-auto">
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
                onClick={() => navigate('/clientes/nova')}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 text-white text-sm font-semibold hover:from-indigo-500 hover:to-violet-500 shadow-lg shadow-indigo-500/20"
              >
                <Plus className="w-4 h-4" />
                Nova pessoa
              </button>
              <button
                type="button"
                onClick={() => setModalVinculosSistema(true)}
                disabled={loading || idPessoaParaVinculos == null}
                title={
                  idPessoaParaVinculos == null
                    ? 'Selecione uma linha na tabela (clique na linha) para ver vínculos'
                    : 'Códigos de cliente e processos desta pessoa'
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 shadow-sm disabled:opacity-50"
              >
                <Link2 className="w-4 h-4" />
                Vínculos no sistema
              </button>
            </div>
          </div>
        </section>

        {error && (
          <div className="mb-4 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}

        <section className="bg-white/95 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200/90 ring-1 ring-indigo-500/10 overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center gap-3 text-sm text-slate-600">
            <Search className="w-4 h-4 shrink-0" />
            <span>
              Linha selecionada: <strong className="text-slate-800">{pessoaAtual?.nome || '—'}</strong>
            </span>
            <span className="text-slate-400">|</span>
            <span>Clique em uma linha para selecionar (vínculos usam a linha selecionada)</span>
          </div>
          <div className="p-4">
            {loading ? (
              <p className="text-slate-500 text-sm py-8 text-center">Carregando relatório...</p>
            ) : (
              <div className="border border-slate-200 rounded-xl overflow-hidden flex flex-col">
                <table className="w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700 font-medium">
                    <tr>
                      <th className="text-left px-4 py-3">ID</th>
                      <th className="text-left px-4 py-3">Nome</th>
                      <th className="text-left px-4 py-3">E-mail</th>
                      <th className="text-left px-4 py-3">CPF</th>
                      <th className="text-center px-4 py-3">Doc.</th>
                      <th className="text-left px-4 py-3">Ativo</th>
                      <th className="text-center px-4 py-3">Monit.</th>
                      <th className="text-right px-4 py-3">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {listaExibida.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                          Nenhuma pessoa cadastrada.
                        </td>
                      </tr>
                    ) : (
                      listaExibida.map((p) => (
                        <tr
                          key={p.id}
                          onClick={() => setSelectedPessoa({ id: p.id, nome: p.nome })}
                          className={`cursor-pointer hover:bg-slate-50/80 ${
                            Number(selectedPessoa?.id) === Number(p.id) ? 'bg-blue-50/80' : ''
                          }`}
                        >
                          <td className="px-4 py-3 text-slate-600">{p.id}</td>
                          <td className="px-4 py-3 font-medium text-slate-800">{p.nome}</td>
                          <td className="px-4 py-3 text-slate-600">{p.email}</td>
                          <td className="px-4 py-3 text-slate-600">{p.cpf}</td>
                          <td className="px-4 py-3 text-center">
                            {pessoasComDocumento.includes(String(p.id)) ? (
                              <button
                                type="button"
                                className="inline-flex items-center justify-center p-1.5 rounded-full bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                title="Documento pessoal disponível"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  try {
                                    const doc = obterDocumentoPessoa(p.id);
                                    if (!doc) return;
                                    const url = criarUrlParaDocumento(doc);
                                    if (url) window.open(url, '_blank', 'noopener,noreferrer');
                                  } catch {
                                    /* ignore */
                                  }
                                }}
                              >
                                <FileText className="w-4 h-4" />
                              </button>
                            ) : (
                              <span className="text-slate-400">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">{p.ativo ? 'Sim' : 'Não'}</td>
                          <td className="px-4 py-3 text-center text-slate-600">
                            {p.marcadoMonitoramento ? 'Sim' : '—'}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/clientes/editar/${p.id}`);
                              }}
                              className="p-2 rounded-lg text-blue-600 hover:bg-blue-50 inline-flex items-center justify-center"
                              title="Editar"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                excluir(p.id, p.nome);
                              }}
                              className="p-2 rounded-lg text-red-600 hover:bg-red-50 inline-flex items-center justify-center ml-1"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
                <TablePaginationBar
                  page={page}
                  totalPages={totalPages}
                  totalElements={totalElements}
                  pageSize={pageSize}
                  onPageChange={setPage}
                  onPageSizeChange={persistPageSize}
                  loading={loading}
                  idPrefix="relatorio-pessoas"
                />
              </div>
            )}
          </div>
        </section>
      </div>

      {modalVinculosSistema && idPessoaParaVinculos != null && (
        <div
          className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/40"
          role="presentation"
          onClick={() => setModalVinculosSistema(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="bg-white rounded-xl shadow-xl border border-slate-200 max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-slate-200 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-800">Vínculos no sistema</h2>
                <p className="text-sm text-slate-600 mt-1">
                  Pessoa nº <span className="font-semibold">{idPessoaParaVinculos}</span>
                  {nomeParaVinculos ? (
                    <>
                      {' '}
                      — <span className="font-medium">{nomeParaVinculos}</span>
                    </>
                  ) : null}
                </p>
                <p className="text-xs text-slate-500 mt-2">
                  Códigos de cliente vêm da API de clientes; processos do histórico local (tela Processos).
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalVinculosSistema(false)}
                className="px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100"
              >
                Fechar
              </button>
            </div>
            <div className="px-5 py-4 overflow-y-auto flex-1 space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Códigos de cliente</h3>
                {vinculosClienteProc.codigosCliente.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhum código de cliente vinculado a esta pessoa no cadastro.</p>
                ) : (
                  <ul className="flex flex-wrap gap-2">
                    {vinculosClienteProc.codigosCliente.map((cod) => (
                      <li key={cod}>
                        <button
                          type="button"
                          onClick={() => {
                            setModalVinculosSistema(false);
                            navigate('/pessoas', { state: buildRouterStateChaveClienteProcesso(padCliente8Nav(cod), '') });
                          }}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-blue-200 bg-blue-50 text-blue-800 text-sm font-medium hover:bg-blue-100"
                        >
                          {padCliente8Nav(cod)}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <div>
                <h3 className="text-sm font-semibold text-slate-800 mb-2">Processos (parte cliente / oposta)</h3>
                {vinculosClienteProc.processos.length === 0 ? (
                  <p className="text-sm text-slate-500">
                    Nenhum processo encontrado com esta pessoa nas partes vinculadas ou nos nomes.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-100 text-slate-700">
                        <tr>
                          <th className="text-left px-3 py-2 font-medium">Cod. cliente</th>
                          <th className="text-left px-3 py-2 font-medium">Proc.</th>
                          <th className="text-left px-3 py-2 font-medium">Papéis</th>
                          <th className="text-right px-3 py-2 font-medium">Abrir</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {vinculosClienteProc.processos.map((row, idx) => (
                          <tr key={`${row.codCliente}-${row.proc}-${idx}`} className="hover:bg-slate-50/80">
                            <td className="px-3 py-2 text-slate-700">{row.codCliente}</td>
                            <td className="px-3 py-2 text-slate-700">{row.proc}</td>
                            <td className="px-3 py-2 text-slate-600">{row.papeis}</td>
                            <td className="px-3 py-2 text-right">
                              <button
                                type="button"
                                onClick={() => {
                                  setModalVinculosSistema(false);
                                  navigate('/processos', {
                                    state: buildRouterStateChaveClienteProcesso(
                                      padCliente8Nav(row.codCliente),
                                      row.proc ?? ''
                                    ),
                                  });
                                }}
                                className="text-blue-600 hover:underline text-sm font-medium"
                              >
                                Processos
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
