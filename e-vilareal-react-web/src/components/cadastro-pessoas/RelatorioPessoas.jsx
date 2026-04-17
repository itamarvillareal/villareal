import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { FileText, Link2, Pencil, Plus, Search, Trash2, Download, Loader2 } from 'lucide-react';
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
import {
  coletarIdsExportacaoPessoas,
  exportarPessoasParaXlsx,
  parsearIdsListaExportacaoPessoas,
} from '../../services/exportarPessoasExcel.js';
import { getContextoAuditoriaUsuario, registrarAuditoria } from '../../services/auditoriaCliente.js';

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
  const location = useLocation();
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
  const [modalExportar, setModalExportar] = useState(false);
  /** filtros | intervalo (IDs) | quantidade (primeiras N por ordem de ID) | lista (IDs separados por ;) */
  const [modoExport, setModoExport] = useState('filtros');
  const [exportAplicarFiltrosBusca, setExportAplicarFiltrosBusca] = useState(true);
  const [exportIdDe, setExportIdDe] = useState('');
  const [exportIdAte, setExportIdAte] = useState('');
  const [exportQuantidade, setExportQuantidade] = useState('500');
  const [exportListaIds, setExportListaIds] = useState('');
  const [exportando, setExportando] = useState(false);
  const [exportStatus, setExportStatus] = useState('');

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

  useEffect(() => {
    const sp = new URLSearchParams(location.search || '');
    if (sp.get('export') === '1') {
      setModalExportar(true);
      navigate({ pathname: location.pathname, search: '' }, { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  const montarFiltrosParaExport = useCallback(() => {
    const base = { apenasAtivos: debouncedFiltros.apenasAtivos };
    if (!exportAplicarFiltrosBusca) return base;
    return { ...base, ...buildFiltrosApi(debouncedFiltros) };
  }, [debouncedFiltros, exportAplicarFiltrosBusca]);

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

  const executarExportacaoExcel = async () => {
    setError(null);
    setExportando(true);
    setExportStatus('');
    try {
      const filtros = montarFiltrosParaExport();
      let ids;
      if (modoExport === 'lista') {
        ids = parsearIdsListaExportacaoPessoas(exportListaIds);
        if (!ids.length) {
          setError(
            'Informe os números das pessoas no cadastro, separados por ponto e vírgula (ex.: 200; 201; 209; 404).'
          );
          return;
        }
      } else if (modoExport === 'filtros') {
        ids = await coletarIdsExportacaoPessoas('filtros', filtros, null, null, (ev) => {
          setExportStatus(`A listar registos… (página ${ev.page + 1})`);
        });
      } else if (modoExport === 'intervalo') {
        const idDe = Math.floor(Number(exportIdDe));
        const idAte = Math.floor(Number(exportIdAte));
        ids = await coletarIdsExportacaoPessoas(
          'intervalo',
          filtros,
          { idDe, idAte },
          null,
          (ev) => {
            setExportStatus(`A listar registos… (página ${ev.page + 1})`);
          }
        );
      } else {
        const q = Math.floor(Number(exportQuantidade));
        ids = await coletarIdsExportacaoPessoas('quantidade', filtros, null, q, (ev) => {
          setExportStatus(`A listar registos… (página ${ev.page + 1})`);
        });
      }

      if (!ids.length) {
        setError('Nenhuma pessoa encontrada para estes critérios.');
        return;
      }
      if (ids.length > 2000) {
        const ok = window.confirm(
          `Serão exportadas ${ids.length} pessoas (uma chamada à API por pessoa para dados completos). Continuar?`
        );
        if (!ok) return;
      }

      await exportarPessoasParaXlsx(ids, clientesCodigosLista, (ev) => {
        setExportStatus(`A carregar ficha completa… ${ev.atual} de ${ev.total}`);
      });

      const { usuarioNome } = getContextoAuditoriaUsuario();
      registrarAuditoria({
        modulo: 'Pessoas',
        tela: '/clientes/relatorio',
        tipoAcao: 'EXPORTACAO_EXCEL',
        descricao: `Exportação Excel: ${ids.length} pessoa(s). Modo ${modoExport}.`,
      });
      setModalExportar(false);
    } catch (err) {
      setError(String(err?.message || err || 'Falha na exportação.'));
    } finally {
      setExportando(false);
      setExportStatus('');
    }
  };

  return (
    <div className="min-h-full bg-gradient-to-br from-slate-100 via-indigo-50/40 to-emerald-50/50 dark:bg-gradient-to-b dark:from-[#0a0d12] dark:via-[#0c1017] dark:to-[#0e141d]">
      <div className="max-w-6xl mx-auto px-4 py-6">
        <header className="mb-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3 min-w-0">
              <span className="mt-1 flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-700 text-white shadow-lg shadow-indigo-500/25 ring-1 ring-white/20">
                <FileText className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0">
              <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-800 to-violet-800 dark:from-indigo-200 dark:to-violet-200 bg-clip-text text-transparent tracking-tight">
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
                onClick={() => setModalExportar(true)}
                disabled={loading}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 text-emerald-900 text-sm font-semibold hover:bg-emerald-100 shadow-sm disabled:opacity-50"
                title="Exportar cadastro completo para planilha Excel"
              >
                <Download className="w-4 h-4" />
                Exportar Excel
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

      {modalExportar && (
        <div
          className="fixed inset-0 z-[85] flex items-center justify-center p-4 bg-black/45"
          role="presentation"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget && !exportando) setModalExportar(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-export-pessoas-titulo"
            className="bg-white rounded-2xl shadow-xl border border-slate-200 max-w-lg w-full p-6"
            onMouseDown={(e) => e.stopPropagation()}
          >
            <h2 id="modal-export-pessoas-titulo" className="text-lg font-semibold text-slate-800">
              Exportar pessoas para Excel
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Cada linha inclui dados principais, complementares, endereços e contatos (quando a API estiver ativa),
              vínculos de cliente e resumo de processos, e indicação de documento pessoal anexado.
            </p>

            <fieldset className="mt-4 space-y-2">
              <legend className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Escopo</legend>
              <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="modoExportPessoas"
                  checked={modoExport === 'filtros'}
                  onChange={() => setModoExport('filtros')}
                  className="mt-0.5 text-indigo-600"
                />
                <span>
                  <strong>Todas</strong> que correspondem aos filtros abaixo (nome, código, CPF e «Apenas ativos»).
                  {loading ? '' : ` Há ${totalElements} registo(s) com os filtros atuais na API.`}
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="modoExportPessoas"
                  checked={modoExport === 'intervalo'}
                  onChange={() => setModoExport('intervalo')}
                  className="mt-0.5 text-indigo-600"
                />
                <span>
                  <strong>Intervalo de ID</strong> (código da pessoa): de{' '}
                  <input
                    type="number"
                    min={1}
                    value={exportIdDe}
                    onChange={(e) => setExportIdDe(e.target.value)}
                    disabled={modoExport !== 'intervalo'}
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                  />{' '}
                  até{' '}
                  <input
                    type="number"
                    min={1}
                    value={exportIdAte}
                    onChange={(e) => setExportIdAte(e.target.value)}
                    disabled={modoExport !== 'intervalo'}
                    className="w-24 px-2 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                  />
                </span>
              </label>
              <label className="flex items-start gap-2 text-sm text-slate-800 cursor-pointer">
                <input
                  type="radio"
                  name="modoExportPessoas"
                  checked={modoExport === 'quantidade'}
                  onChange={() => setModoExport('quantidade')}
                  className="mt-0.5 text-indigo-600"
                />
                <span className="flex flex-wrap items-center gap-2">
                  <strong>Primeiras</strong>
                  <input
                    type="number"
                    min={1}
                    max={50000}
                    value={exportQuantidade}
                    onChange={(e) => setExportQuantidade(e.target.value)}
                    disabled={modoExport !== 'quantidade'}
                    className="w-28 px-2 py-1 border border-slate-300 rounded text-sm disabled:opacity-50"
                  />
                  pessoas (por ID crescente, com os filtros abaixo).
                </span>
              </label>
              <label className="flex flex-col gap-2 text-sm text-slate-800 cursor-pointer">
                <span className="flex items-start gap-2">
                  <input
                    type="radio"
                    name="modoExportPessoas"
                    checked={modoExport === 'lista'}
                    onChange={() => setModoExport('lista')}
                    className="mt-0.5 text-indigo-600 shrink-0"
                  />
                  <span>
                    <strong>Lista de números</strong> (código da pessoa no cadastro), separados por ponto e vírgula.
                    Ex.: <code className="text-xs bg-slate-100 px-1 rounded">200; 201; 209; 404</code>
                  </span>
                </span>
                <textarea
                  value={exportListaIds}
                  onChange={(e) => setExportListaIds(e.target.value)}
                  disabled={modoExport !== 'lista'}
                  rows={3}
                  placeholder="200; 201; 209; 404"
                  className="w-full ml-6 max-w-full px-2 py-1.5 border border-slate-300 rounded text-sm font-mono disabled:opacity-50 resize-y min-h-[4.5rem]"
                />
              </label>
            </fieldset>

            <label
              className={`mt-4 flex items-start gap-2 text-sm cursor-pointer ${
                modoExport === 'lista' ? 'text-slate-400 cursor-not-allowed' : 'text-slate-700'
              }`}
            >
              <input
                type="checkbox"
                checked={exportAplicarFiltrosBusca}
                onChange={(e) => setExportAplicarFiltrosBusca(e.target.checked)}
                disabled={modoExport === 'lista'}
                className="mt-0.5 rounded border-slate-300 text-indigo-600 disabled:opacity-50"
              />
              <span>
                Aplicar filtros de <strong>nome / código / CPF</strong> do relatório (desmarque para exportar só com
                «Apenas ativos» e intervalo ou quantidade).
                {modoExport === 'lista' ? (
                  <span className="block text-xs text-slate-500 mt-1 font-normal">
                    Com lista de números, exportam-se sempre as pessoas indicadas; estes filtros não se aplicam.
                  </span>
                ) : null}
              </span>
            </label>

            {exportStatus ? (
              <p className="mt-3 text-sm text-indigo-700 flex items-center gap-2">
                <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
                {exportStatus}
              </p>
            ) : null}

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                disabled={exportando}
                onClick={() => setModalExportar(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={exportando}
                onClick={() => void executarExportacaoExcel()}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50"
              >
                {exportando ? <Loader2 className="w-4 h-4 animate-spin" aria-hidden /> : <Download className="w-4 h-4" aria-hidden />}
                Gerar Excel
              </button>
            </div>
          </div>
        </div>
      )}

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
