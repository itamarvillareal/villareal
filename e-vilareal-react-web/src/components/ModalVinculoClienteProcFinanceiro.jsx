import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Search, X, Link2, ChevronLeft, Loader2 } from 'lucide-react';
import {
  pesquisarClientesCadastroPorTermo,
  termoPermiteBuscaClienteCadastro,
} from '../data/buscaClientesCadastro.js';
import { featureFlags } from '../config/featureFlags.js';
import { padCliente8Cadastro } from '../data/cadastroClientesStorage.js';
import {
  buscarClientesUnicosPorTextoHistorico,
  buscarParesClienteProcPorCnj,
  buscarParesClienteProcPorTexto,
  filtrarProcessosVinculoPasso2,
  pareceTermoBuscaCnj,
} from '../data/buscaClienteProcFinanceiro';
import {
  carregarProcessosGradeClienteLocal,
  mapearGradeParaLinhasVinculoModal,
  mesclarProcessosGradeClienteComApi,
} from '../data/buscaProcessosGradeCliente.js';
import {
  listarClientesIndiceCadastro,
} from '../repositories/clientesRepository.js';
import { useCloseOnEscape } from '../hooks/useCloseOnEscape.js';

/**
 * Modal para vincular cod. cliente + proc. no lançamento do Financeiro.
 * Com `modoContaEscritorio`: fluxo em 2 passos (cliente → processos com partes), ideal para letra **A** (Conta Escritório).
 * Sem o modo: busca única no histórico local por texto (comportamento anterior).
 */
export function ModalVinculoClienteProcFinanceiro({
  aberto,
  onFechar,
  resumoLancamento,
  onAplicar,
  modoContaEscritorio = false,
  titulo = null,
  placeholderBuscaCliente = null,
}) {
  const [termo, setTermo] = useState('');
  const [passo, setPasso] = useState(1);
  /** @type {null | { codCliente: string, codigoPadded: string, nomeCliente: string, cpfLabel: string }} */
  const [clienteSel, setClienteSel] = useState(null);
  const [clientesPasso1, setClientesPasso1] = useState([]);
  const [paresCnjPasso1, setParesCnjPasso1] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [processosGrade, setProcessosGrade] = useState([]);
  const [termoBuscaProcesso, setTermoBuscaProcesso] = useState('');
  const [processosApiCarregando, setProcessosApiCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [clientesIndiceApi, setClientesIndiceApi] = useState([]);

  const refBuscaCliente = useRef(null);
  const refPrimeiroCliente = useRef(null);
  const refPrimeiroCnj = useRef(null);
  const refBuscaProcesso = useRef(null);
  const refPrimeiroProcesso = useRef(null);
  const refBuscaLivre = useRef(null);
  const refPrimeiroLivre = useRef(null);

  useCloseOnEscape(aberto, onFechar);

  const focarPrimeiroDaLista = useCallback((refPrimeiro) => {
    refPrimeiro.current?.focus();
  }, []);

  const aoTabSairCampoBusca = useCallback((e, refPrimeiro, temItens) => {
    if (e.key !== 'Tab' || e.shiftKey || !temItens) return;
    e.preventDefault();
    focarPrimeiroDaLista(refPrimeiro);
  }, [focarPrimeiroDaLista]);

  const aoAtivarLinhaTeclado = useCallback((e, acao) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      acao();
    }
  }, []);

  const avancarComClientePasso1 = useCallback((c) => {
    if (!c) return;
    setClienteSel(c);
    setTermoBuscaProcesso('');
    setPasso(2);
  }, []);

  const selecionarPrimeiroClientePasso1 = useCallback(() => {
    if (loadingClientes) return;
    if (paresCnjPasso1.length > 0) {
      const r = paresCnjPasso1[0];
      onAplicar({ codCliente: r.codCliente, proc: r.proc });
      return;
    }
    if (clientesPasso1.length === 0) return;
    avancarComClientePasso1(clientesPasso1[0]);
  }, [loadingClientes, paresCnjPasso1, clientesPasso1, avancarComClientePasso1, onAplicar]);

  const aoKeyDownBuscaClientePasso1 = useCallback(
    (e) => {
      if (e.key === 'Enter') {
        if ((clientesPasso1.length > 0 || paresCnjPasso1.length > 0) && !loadingClientes) {
          e.preventDefault();
          selecionarPrimeiroClientePasso1();
        }
        return;
      }
      const refPrimeiro = paresCnjPasso1.length > 0 ? refPrimeiroCnj : refPrimeiroCliente;
      const temItens = paresCnjPasso1.length > 0 || clientesPasso1.length > 0;
      aoTabSairCampoBusca(e, refPrimeiro, temItens);
    },
    [
      clientesPasso1.length,
      paresCnjPasso1.length,
      loadingClientes,
      selecionarPrimeiroClientePasso1,
      aoTabSairCampoBusca,
    ],
  );

  const resetWizard = useCallback(() => {
    setTermo('');
    setPasso(1);
    setClienteSel(null);
    setClientesPasso1([]);
    setParesCnjPasso1([]);
    setProcessosGrade([]);
    setTermoBuscaProcesso('');
    setLoadingClientes(false);
    setProcessosApiCarregando(false);
    setErro('');
  }, []);

  useEffect(() => {
    if (aberto) {
      if (modoContaEscritorio) resetWizard();
      else setTermo('');
    }
  }, [aberto, modoContaEscritorio, resetWizard]);

  useEffect(() => {
    if (!aberto || !modoContaEscritorio || !featureFlags.useApiClientes) return;
    let cancelled = false;
    void listarClientesIndiceCadastro()
      .then((data) => {
        if (!cancelled) setClientesIndiceApi(Array.isArray(data) ? data : []);
      })
      .catch(() => {
        if (!cancelled) setClientesIndiceApi([]);
      });
    return () => {
      cancelled = true;
    };
  }, [aberto, modoContaEscritorio]);

  useEffect(() => {
    if (!aberto || !modoContaEscritorio || passo !== 1) return;
    const t = termo.trim();

    if (pareceTermoBuscaCnj(t)) {
      let cancelled = false;
      const id = window.setTimeout(() => {
        void (async () => {
          setLoadingClientes(true);
          setErro('');
          setClientesPasso1([]);
          try {
            const pares = await buscarParesClienteProcPorCnj(t, { maxResults: 30 });
            if (!cancelled) setParesCnjPasso1(pares);
          } catch (e) {
            if (!cancelled) {
              setErro(e?.message || 'Falha ao buscar processo por CNJ.');
              setParesCnjPasso1([]);
            }
          } finally {
            if (!cancelled) setLoadingClientes(false);
          }
        })();
      }, 320);
      return () => {
        cancelled = true;
        window.clearTimeout(id);
      };
    }

    setParesCnjPasso1([]);
    if (!termoPermiteBuscaClienteCadastro(t)) {
      setClientesPasso1([]);
      setLoadingClientes(false);
      return;
    }
    let cancelled = false;
    const id = window.setTimeout(() => {
      void (async () => {
        setLoadingClientes(true);
        setErro('');
        try {
          if (featureFlags.useApiClientes) {
            const rows = await pesquisarClientesCadastroPorTermo(t, clientesIndiceApi, { limite: 80 });
            if (cancelled) return;
            setClientesPasso1(rows);
          } else {
            if (cancelled) return;
            const hist = buscarClientesUnicosPorTextoHistorico(t, { maxResults: 80 });
            setClientesPasso1(
              hist.map((h) => ({
                codCliente: h.codCliente,
                codigoPadded: padCliente8Cadastro(h.codCliente),
                nomeCliente: h.nomeCliente,
                cpfLabel: h.cnpjCpf || '—',
              }))
            );
          }
        } catch (e) {
          if (!cancelled) {
            setErro(e?.message || 'Falha ao buscar clientes.');
            setClientesPasso1([]);
          }
        } finally {
          if (!cancelled) setLoadingClientes(false);
        }
      })();
    }, 320);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [aberto, modoContaEscritorio, passo, termo, clientesIndiceApi]);

  useEffect(() => {
    if (!aberto || !modoContaEscritorio || passo !== 2 || !clienteSel) return;
    let cancelled = false;
    const codPad = clienteSel.codigoPadded;
    setErro('');
    const local = carregarProcessosGradeClienteLocal(codPad);
    setProcessosGrade(local);

    if (!featureFlags.useApiProcessos) {
      setProcessosApiCarregando(false);
      return () => {
        cancelled = true;
      };
    }

    setProcessosApiCarregando(true);
    void mesclarProcessosGradeClienteComApi(codPad, local, { comPartesNaApi: true })
      .then((merged) => {
        if (!cancelled) setProcessosGrade(merged);
      })
      .catch((e) => {
        if (!cancelled) {
          setErro(e?.message || 'Não foi possível atualizar processos na API.');
        }
      })
      .finally(() => {
        if (!cancelled) setProcessosApiCarregando(false);
      });

    return () => {
      cancelled = true;
    };
  }, [aberto, modoContaEscritorio, passo, clienteSel]);

  const processosPasso2Linhas = useMemo(() => {
    if (!clienteSel) return [];
    return mapearGradeParaLinhasVinculoModal(
      processosGrade,
      clienteSel.nomeCliente,
      clienteSel.codigoPadded
    );
  }, [processosGrade, clienteSel]);

  const processosPasso2Filtrados = useMemo(
    () =>
      filtrarProcessosVinculoPasso2(
        processosPasso2Linhas,
        clienteSel?.nomeCliente ?? '',
        termoBuscaProcesso,
        clienteSel?.codigoPadded ?? ''
      ),
    [processosPasso2Linhas, clienteSel, termoBuscaProcesso]
  );

  const resultadosBuscaLivre = useMemo(
    () => buscarParesClienteProcPorTexto(termo, { maxResults: 150 }),
    [termo]
  );

  if (!aberto) return null;

  const buscaCnjPasso1 = modoContaEscritorio && passo === 1 && pareceTermoBuscaCnj(termo);

  const tituloWizard = titulo ?? 'Vincular (Conta Escritório — letra A)';
  const tituloLivre = titulo ?? 'Vincular cliente e processo';
  const placeholderCliente =
    placeholderBuscaCliente ??
    (modoContaEscritorio
      ? 'Nome, código (8 dígitos), nº interno ou CNJ do processo…'
      : 'Ex.: nome da parte, réu, CPF, CNJ ou nº do processo…');

  return (
    <div
      className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-vinculo-financeiro-titulo"
      onClick={onFechar}
    >
      <div
        className="bg-white rounded-lg shadow-xl border border-indigo-200 w-full max-w-4xl max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4 py-3 border-b border-indigo-200 flex items-start justify-between gap-3 shrink-0">
          <div>
            <h2
              id="modal-vinculo-financeiro-titulo"
              className="text-base font-bold text-slate-800 flex items-center gap-2"
            >
              <Link2 className="w-5 h-5 text-indigo-600 shrink-0" aria-hidden />
              {modoContaEscritorio ? tituloWizard : tituloLivre}
            </h2>
            {modoContaEscritorio ? (
              <p className="text-xs text-slate-600 mt-1">
                <strong>1.</strong> Pesquise por <strong>nome</strong>, <strong>código (8 dígitos)</strong>,{' '}
                <strong>nº interno</strong> ou <strong>CNJ</strong>. Com CNJ, clique na linha para vincular de
                imediato; com cliente, avance ao passo 2 e filtre por autor, réu ou nº do processo. Clique na linha
                para vincular <strong>código</strong> e <strong>proc.</strong> ao lançamento.
              </p>
            ) : (
              <p className="text-xs text-slate-600 mt-1">
                Pesquise pelo <strong>nome do cliente</strong>, <strong>CPF/CNPJ</strong>, <strong>autor</strong>,{' '}
                <strong>réu</strong>, <strong>CNJ</strong>, tipo de ação ou trecho do <strong>nº do processo</strong>{' '}
                (histórico local). Depois clique na linha para gravar <strong>Cod. cliente</strong> e{' '}
                <strong>Proc.</strong> neste lançamento.
              </p>
            )}
            {resumoLancamento ? (
              <p className="text-xs text-indigo-900 bg-indigo-50 border border-indigo-100 rounded px-2 py-1 mt-2">
                {resumoLancamento}
              </p>
            ) : null}
            {erro ? (
              <p className="text-xs text-red-700 bg-red-50 border border-red-100 rounded px-2 py-1 mt-2">{erro}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onFechar}
            className="p-2 rounded text-slate-500 hover:bg-slate-100 shrink-0"
            aria-label="Fechar"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {modoContaEscritorio ? (
          <>
            <div className="px-4 py-2 border-b border-slate-200 bg-slate-50 text-xs text-slate-600 shrink-0">
              Passo <strong>{passo}</strong> de 2
              {passo === 2 && clienteSel ? (
                <>
                  {' '}
                  — Cliente: <strong className="text-slate-800">{clienteSel.nomeCliente}</strong> (cód.{' '}
                  <span className="tabular-nums font-medium">{clienteSel.codigoPadded}</span>)
                </>
              ) : null}
            </div>

            {passo === 1 ? (
              <>
                <div className="px-4 py-3 border-b border-slate-200 shrink-0">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      ref={refBuscaCliente}
                      type="search"
                      value={termo}
                      onChange={(e) => setTermo(e.target.value)}
                      onKeyDown={aoKeyDownBuscaClientePasso1}
                      placeholder={placeholderCliente}
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      autoFocus
                    />
                    {loadingClientes ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" /> : null}
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  {buscaCnjPasso1 ? (
                    paresCnjPasso1.length === 0 && !loadingClientes ? (
                      <p className="text-sm text-slate-600 text-center py-8">
                        Nenhum processo encontrado com CNJ &quot;{termo.trim()}&quot;.
                      </p>
                    ) : (
                      <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm border-collapse">
                          <thead>
                            <tr className="bg-slate-100 text-left">
                              <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 w-24">
                                Cod.
                              </th>
                              <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 w-14">
                                Proc.
                              </th>
                              <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[140px]">
                                Cliente
                              </th>
                              <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[160px]">
                                CNJ
                              </th>
                              <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[120px]">
                                Autor / réu
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {paresCnjPasso1.map((r, idx) => {
                              const vincularPar = () => onAplicar({ codCliente: r.codCliente, proc: r.proc });
                              return (
                                <tr
                                  key={`${r.codCliente}-${r.proc}-${r.processoNovo}-${idx}`}
                                  ref={idx === 0 ? refPrimeiroCnj : undefined}
                                  tabIndex={0}
                                  role="button"
                                  className="border-b border-slate-100 hover:bg-indigo-50/80 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                                  onClick={vincularPar}
                                  onKeyDown={(e) => aoAtivarLinhaTeclado(e, vincularPar)}
                                  title="Clique para vincular este processo ao lançamento"
                                >
                                  <td className="px-3 py-2 tabular-nums font-medium text-slate-900">{r.codCliente}</td>
                                  <td className="px-3 py-2 tabular-nums text-slate-800">{r.proc}</td>
                                  <td className="px-3 py-2 text-slate-800 font-medium">{r.nomeCliente || '—'}</td>
                                  <td className="px-3 py-2 text-slate-700 text-xs break-words">{r.processoNovo || '—'}</td>
                                  <td className="px-3 py-2 text-slate-600 text-xs break-words">
                                    {[r.autor, r.reu].filter(Boolean).join(' / ') || '—'}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )
                  ) : !termoPermiteBuscaClienteCadastro(termo) ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      Digite pelo menos 2 letras no nome, ou use números para código (8 dígitos), CPF/CNPJ, nº interno
                      ou CNJ (mín. 7 dígitos).
                    </p>
                  ) : clientesPasso1.length === 0 && !loadingClientes ? (
                    <p className="text-sm text-slate-600 text-center py-8">
                      Nenhum cliente encontrado para &quot;{termo.trim()}&quot;.
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-left">
                            <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 w-28">
                              Código
                            </th>
                            <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[160px]">
                              Cliente
                            </th>
                            <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 w-36">
                              CPF / doc.
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {clientesPasso1.map((c, idx) => {
                            const selecionarCliente = () => avancarComClientePasso1(c);
                            return (
                            <tr
                              key={`${c.codigoPadded}-${idx}`}
                              ref={idx === 0 ? refPrimeiroCliente : undefined}
                              tabIndex={0}
                              role="button"
                              className="border-b border-slate-100 hover:bg-indigo-50/80 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                              onClick={selecionarCliente}
                              onKeyDown={(e) => aoAtivarLinhaTeclado(e, selecionarCliente)}
                              title="Clique para listar os processos deste cliente"
                            >
                              <td className="px-3 py-2 tabular-nums text-slate-900 font-medium">{c.codigoPadded}</td>
                              <td className="px-3 py-2 text-slate-800 font-medium">{c.nomeCliente}</td>
                              <td className="px-3 py-2 text-slate-600 text-xs">{c.cpfLabel}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="px-4 py-2 border-b border-slate-200 shrink-0 flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPasso(1);
                      setProcessosGrade([]);
                      setTermoBuscaProcesso('');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Voltar aos clientes
                  </button>
                  {processosApiCarregando ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Atualizando lista na API…
                    </span>
                  ) : null}
                </div>
                <div className="px-4 py-3 border-b border-slate-200 shrink-0">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      ref={refBuscaProcesso}
                      type="search"
                      value={termoBuscaProcesso}
                      onChange={(e) => setTermoBuscaProcesso(e.target.value)}
                      onKeyDown={(e) =>
                        aoTabSairCampoBusca(e, refPrimeiroProcesso, processosPasso2Filtrados.length > 0)
                      }
                      placeholder="Filtrar: autor, réu, CNJ, nº antigo ou proc. interno…"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                    />
                  </div>
                  {processosGrade.length > 0 ? (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Mostrando <strong>{processosPasso2Filtrados.length}</strong> de {processosGrade.length} processo(s)
                      {termoBuscaProcesso.trim() ? ' (filtro ativo)' : ''}
                      {processosApiCarregando ? ' — complementando na API…' : ''}.
                    </p>
                  ) : null}
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  {processosGrade.length === 0 && processosApiCarregando ? (
                    <p className="text-sm text-slate-500 text-center py-8">Carregando processos do cliente…</p>
                  ) : processosGrade.length === 0 ? (
                    <p className="text-sm text-slate-600 text-center py-8">
                      Nenhum processo encontrado para este cliente.
                    </p>
                  ) : processosPasso2Filtrados.length === 0 ? (
                    <p className="text-sm text-slate-600 text-center py-8">
                      Nenhum processo corresponde a &quot;{termoBuscaProcesso.trim()}&quot;. Ajuste o filtro ou limpe o
                      campo para ver todos.
                    </p>
                  ) : (
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                      <table className="w-full text-sm border-collapse">
                        <thead>
                          <tr className="bg-slate-100 text-left">
                            <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 w-14">
                              Proc.
                            </th>
                            <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[140px]">
                              Processo (CNJ / nº novo)
                            </th>
                            <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[120px]">
                              Autor / parte cliente
                            </th>
                            <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[140px]">
                              Réu / partes opostas
                            </th>
                            <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[100px]">
                              Ação / obs.
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {processosPasso2Filtrados.map((p, idx) => {
                            const procNum = Number(p.numeroInterno);
                            const procStr = Number.isFinite(procNum) && procNum >= 0 ? String(procNum) : '';
                            const exibeAutor = String(p.parteClienteAutor ?? '').trim() || clienteSel?.nomeCliente || '—';
                            const vincularProcesso = () => {
                              if (!clienteSel || !procStr) return;
                              onAplicar({
                                codCliente: clienteSel.codCliente,
                                proc: procStr,
                              });
                            };
                            return (
                              <tr
                                key={`${p.processoId ?? 'h'}-${procStr}-${idx}`}
                                ref={idx === 0 ? refPrimeiroProcesso : undefined}
                                tabIndex={procStr ? 0 : -1}
                                role="button"
                                className="border-b border-slate-100 hover:bg-indigo-50/80 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                                onClick={vincularProcesso}
                                onKeyDown={(e) => aoAtivarLinhaTeclado(e, vincularProcesso)}
                                title="Clique para vincular este processo ao lançamento"
                              >
                                <td className="px-3 py-2 tabular-nums font-medium text-slate-900">{procStr}</td>
                                <td className="px-3 py-2 text-slate-700 text-xs break-words">
                                  <div>{p.numeroProcessoNovo || '—'}</div>
                                  {p.numeroProcessoVelho ? (
                                    <div className="text-slate-500 mt-0.5">Antigo: {p.numeroProcessoVelho}</div>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 text-slate-700 text-xs break-words">{exibeAutor}</td>
                                <td className="px-3 py-2 text-slate-600 text-xs break-words">
                                  {p.parteOposta || '—'}
                                </td>
                                <td className="px-3 py-2 text-slate-500 text-xs">{p.observacao || '—'}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <div className="px-4 py-3 border-b border-slate-200 shrink-0">
              <div className="flex items-center gap-2">
                <Search className="w-4 h-4 text-slate-500 shrink-0" />
                <input
                  ref={refBuscaLivre}
                  type="search"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  onKeyDown={(e) =>
                    aoTabSairCampoBusca(e, refPrimeiroLivre, resultadosBuscaLivre.length > 0)
                  }
                  placeholder="Ex.: nome da parte, réu, CPF, CNJ ou nº do processo…"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                  autoFocus
                />
              </div>
            </div>
            <div className="flex-1 min-h-0 overflow-auto p-4">
              {termo.trim().length < 2 ? (
                <p className="text-sm text-slate-500 text-center py-8">Digite pelo menos 2 caracteres para buscar.</p>
              ) : resultadosBuscaLivre.length === 0 ? (
                <p className="text-sm text-slate-600 text-center py-8">
                  Nenhum cliente/processo encontrado para &quot;{termo.trim()}&quot;.
                </p>
              ) : (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <table className="w-full text-sm border-collapse">
                    <thead>
                      <tr className="bg-slate-100 text-left">
                        <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 w-24">Cod.</th>
                        <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 w-14">Proc.</th>
                        <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[140px]">
                          Cliente
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[120px]">
                          Autor
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[120px]">
                          Réu
                        </th>
                        <th className="px-3 py-2 font-semibold text-slate-700 border-b border-slate-200 min-w-[160px]">
                          Processo / ação
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {resultadosBuscaLivre.map((r, idx) => {
                        const vincularPar = () => onAplicar({ codCliente: r.codCliente, proc: r.proc });
                        return (
                        <tr
                          key={`${r.codCliente}-${r.proc}-${r.processoNovo}-${idx}`}
                          ref={idx === 0 ? refPrimeiroLivre : undefined}
                          tabIndex={0}
                          role="button"
                          className="border-b border-slate-100 hover:bg-indigo-50/80 cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-indigo-500"
                          onClick={vincularPar}
                          onKeyDown={(e) => aoAtivarLinhaTeclado(e, vincularPar)}
                          title="Clique para vincular a este lançamento"
                        >
                          <td className="px-3 py-2 tabular-nums text-slate-900 font-medium">{r.codCliente}</td>
                          <td className="px-3 py-2 tabular-nums text-slate-800">{r.proc}</td>
                          <td className="px-3 py-2 text-slate-800">
                            <div className="font-medium">{r.nomeCliente || '—'}</div>
                            {r.cnpjCpf && r.cnpjCpf !== '—' ? (
                              <div className="text-xs text-slate-500">{r.cnpjCpf}</div>
                            ) : null}
                          </td>
                          <td className="px-3 py-2 text-slate-700 text-xs">{r.autor || '—'}</td>
                          <td className="px-3 py-2 text-slate-700 text-xs">{r.reu || '—'}</td>
                          <td className="px-3 py-2 text-slate-600 text-xs">
                            <div className="break-words">{r.processoNovo || '—'}</div>
                            {r.tipoAcao ? <div className="text-slate-500 mt-0.5">{r.tipoAcao}</div> : null}
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}

        <div className="px-4 py-3 border-t border-slate-200 flex justify-end shrink-0">
          <button
            type="button"
            onClick={onFechar}
            className="px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-700 text-sm hover:bg-slate-50"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  );
}
