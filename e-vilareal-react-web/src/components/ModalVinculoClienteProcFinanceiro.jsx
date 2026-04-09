import { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, X, Link2, ChevronLeft, Loader2 } from 'lucide-react';
import { normalizarNumeroBusca, normalizarTextoBusca } from './CadastroClientes.jsx';
import { pesquisarCadastroPessoasPorNomeOuCpf } from '../api/clientesService.js';
import { featureFlags } from '../config/featureFlags.js';
import { padCliente8Cadastro } from '../data/cadastroClientesStorage.js';
import { listarCodigosClientePorIdPessoa } from '../data/clienteCodigoHelpers.js';
import {
  buscarClientesUnicosPorTextoHistorico,
  buscarParesClienteProcPorTexto,
  listarParesPorCodigoClienteHistorico,
} from '../data/buscaClienteProcFinanceiro';
import { normalizarCodigoClienteFinanceiro } from '../data/financeiroData.js';
import {
  listarClientesCadastro,
  resolverClienteCadastroPorCodigo,
} from '../repositories/clientesRepository.js';
import {
  listarProcessosPorCodigoCliente,
  mapApiProcessoToUiShape,
} from '../repositories/processosRepository.js';

function formatDocBR(digits) {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length === 11) return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  if (d.length === 14) return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  return d || '—';
}

function digitosCorrespondemBusca(hayDigits, needleDigits) {
  if (!needleDigits) return false;
  if (!hayDigits) return false;
  return hayDigits.includes(needleDigits) || needleDigits.includes(hayDigits);
}

/**
 * Filtra linhas do passo 2 por autor/parte cliente, réu, nº processo (CNJ / antigo / interno) ou observação.
 * @param {Record<string, unknown>} p
 * @param {string} nomeClienteTitular
 * @param {string} termoRaw
 */
function processoCorrespondeFiltroPasso2(p, nomeClienteTitular, termoRaw) {
  const t = String(termoRaw ?? '').trim();
  if (!t) return true;
  const parteAutor = String(p.parteClienteAutor ?? nomeClienteTitular ?? '');
  const reu = String(p.parteOposta ?? '');
  const cnj = String(p.numeroProcessoNovo ?? '');
  const velho = String(p.numeroProcessoVelho ?? '');
  const procInt = String(p.numeroInterno ?? '');
  const obs = String(p.observacao ?? '');

  const termoTxt = normalizarTextoBusca(t);
  const termoNum = normalizarNumeroBusca(t);

  const blobTxt = [
    normalizarTextoBusca(parteAutor),
    normalizarTextoBusca(reu),
    normalizarTextoBusca(cnj),
    normalizarTextoBusca(velho),
    normalizarTextoBusca(obs),
    normalizarTextoBusca(procInt),
  ].join(' ');

  const txtOk = termoTxt.length >= 1 && blobTxt.includes(termoTxt);

  let numOk = false;
  if (termoNum.length >= 2) {
    const cnjD = normalizarNumeroBusca(cnj);
    const velD = normalizarNumeroBusca(velho);
    const intD = normalizarNumeroBusca(procInt);
    numOk =
      digitosCorrespondemBusca(cnjD, termoNum) ||
      digitosCorrespondemBusca(velD, termoNum) ||
      digitosCorrespondemBusca(intD, termoNum) ||
      digitosCorrespondemBusca(`${cnjD}${velD}${intD}`, termoNum);
  }

  return txtOk || numOk;
}

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
}) {
  const [termo, setTermo] = useState('');
  const [passo, setPasso] = useState(1);
  /** @type {null | { codCliente: string, codigoPadded: string, nomeCliente: string, cpfLabel: string }} */
  const [clienteSel, setClienteSel] = useState(null);
  const [clientesPasso1, setClientesPasso1] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [processosPasso2, setProcessosPasso2] = useState([]);
  const [termoBuscaProcesso, setTermoBuscaProcesso] = useState('');
  const [loadingProcessos, setLoadingProcessos] = useState(false);
  const [erro, setErro] = useState('');

  const resetWizard = useCallback(() => {
    setTermo('');
    setPasso(1);
    setClienteSel(null);
    setClientesPasso1([]);
    setProcessosPasso2([]);
    setTermoBuscaProcesso('');
    setLoadingClientes(false);
    setLoadingProcessos(false);
    setErro('');
  }, []);

  useEffect(() => {
    if (aberto) {
      if (modoContaEscritorio) resetWizard();
      else setTermo('');
    }
  }, [aberto, modoContaEscritorio, resetWizard]);

  useEffect(() => {
    if (!aberto || !modoContaEscritorio || passo !== 1) return;
    const t = termo.trim();
    if (t.length < 2) {
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
            const hasLetters = /[a-zA-ZÀ-ÿ\u00C0-\u024F]/.test(t);
            const digits = t.replace(/\D/g, '');
            const pareceCpfCnpj = digits.length === 11 || digits.length === 14;
            if (!hasLetters && digits.length > 0 && !pareceCpfCnpj) {
              const resolved = await resolverClienteCadastroPorCodigo(digits);
              if (cancelled) return;
              if (resolved) {
                const pid = Number(String(resolved.pessoa ?? '').replace(/\D/g, ''));
                if (Number.isFinite(pid) && pid >= 1) {
                  const codigoPadded = String(resolved.codigo ?? '').trim() || padCliente8Cadastro(digits);
                  const nCod = Number(String(codigoPadded).replace(/\D/g, ''));
                  const codCliente = normalizarCodigoClienteFinanceiro(Number.isFinite(nCod) && nCod >= 1 ? nCod : '');
                  if (codCliente) {
                    setClientesPasso1([
                      {
                        codCliente,
                        codigoPadded,
                        nomeCliente: String(resolved.nomeRazao ?? '').trim() || `Pessoa ${pid}`,
                        cpfLabel: formatDocBR(resolved.cnpjCpf),
                      },
                    ]);
                    return;
                  }
                }
              }
            }

            const pessoas = await pesquisarCadastroPessoasPorNomeOuCpf(t, { limite: 60 });
            if (cancelled) return;
            const listaCli = await listarClientesCadastro();
            const rows = [];
            for (const p of pessoas || []) {
              const pid = Number(p?.id);
              if (!Number.isFinite(pid) || pid < 1) continue;
              const cods = listarCodigosClientePorIdPessoa(pid, listaCli);
              const codigoPadded = cods[0] ?? padCliente8Cadastro(pid);
              const nCod = Number(String(codigoPadded).replace(/\D/g, ''));
              const codCliente = normalizarCodigoClienteFinanceiro(nCod);
              if (!codCliente) continue;
              rows.push({
                codCliente,
                codigoPadded,
                nomeCliente: String(p?.nome ?? '').trim() || `Pessoa ${pid}`,
                cpfLabel: formatDocBR(p?.cpf),
              });
            }
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
  }, [aberto, modoContaEscritorio, passo, termo]);

  useEffect(() => {
    if (!aberto || !modoContaEscritorio || passo !== 2 || !clienteSel) return;
    let cancelled = false;
    void (async () => {
      setLoadingProcessos(true);
      setErro('');
      setProcessosPasso2([]);
      try {
        if (featureFlags.useApiProcessos) {
          const raw = await listarProcessosPorCodigoCliente(clienteSel.codigoPadded);
          if (cancelled) return;
          setProcessosPasso2(
            (raw || []).map((row) => {
              const m = mapApiProcessoToUiShape(row);
              return {
                ...m,
                parteClienteAutor: clienteSel.nomeCliente,
              };
            })
          );
        } else {
          if (cancelled) return;
          const hist = listarParesPorCodigoClienteHistorico(clienteSel.codCliente, { maxResults: 200 });
          setProcessosPasso2(
            hist.map((r) => ({
              numeroInterno: Number(r.proc),
              numeroProcessoNovo: r.processoNovo || '',
              numeroProcessoVelho: r.processoVelho || '',
              parteOposta: r.reu || '',
              parteClienteAutor: String(r.autor ?? '').trim() || clienteSel.nomeCliente,
              observacao: r.tipoAcao || '',
              codigoCliente: padCliente8Cadastro(r.codCliente),
            }))
          );
        }
      } catch (e) {
        if (!cancelled) {
          setErro(e?.message || 'Falha ao listar processos do cliente.');
          setProcessosPasso2([]);
        }
      } finally {
        if (!cancelled) setLoadingProcessos(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [aberto, modoContaEscritorio, passo, clienteSel]);

  const resultadosBuscaLivre = useMemo(
    () => buscarParesClienteProcPorTexto(termo, { maxResults: 150 }),
    [termo]
  );

  const processosPasso2Filtrados = useMemo(() => {
    if (!clienteSel) return processosPasso2;
    return processosPasso2.filter((p) =>
      processoCorrespondeFiltroPasso2(p, clienteSel.nomeCliente, termoBuscaProcesso)
    );
  }, [processosPasso2, clienteSel, termoBuscaProcesso]);

  if (!aberto) return null;

  const tituloWizard = 'Vincular (Conta Escritório — letra A)';
  const tituloLivre = 'Vincular cliente e processo';

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
                <strong>1.</strong> Pesquise o cliente por <strong>nome</strong> ou <strong>código</strong>.{' '}
                <strong>2.</strong> Escolha o processo (use a busca por <strong>autor</strong>, <strong>réu</strong> ou{' '}
                <strong>nº do processo</strong> quando houver muitos). Depois clique na linha para vincular{' '}
                <strong>Cod. cliente</strong> e <strong>Proc.</strong>
              </p>
            ) : (
              <p className="text-xs text-slate-600 mt-1">
                Pesquise pelo <strong>nome do cliente</strong>, <strong>CPF/CNPJ</strong>, <strong>autor</strong>,{' '}
                <strong>réu</strong>, tipo de ação ou trecho do <strong>nº do processo</strong> (histórico local). Depois
                clique na linha para gravar <strong>Cod. cliente</strong> e <strong>Proc.</strong> neste lançamento.
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
                      type="search"
                      value={termo}
                      onChange={(e) => setTermo(e.target.value)}
                      placeholder="Nome do cliente ou código (mín. 2 caracteres)…"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      autoFocus
                    />
                    {loadingClientes ? <Loader2 className="w-5 h-5 text-indigo-500 animate-spin shrink-0" /> : null}
                  </div>
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  {termo.trim().length < 2 ? (
                    <p className="text-sm text-slate-500 text-center py-8">
                      Digite pelo menos 2 caracteres para buscar clientes.
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
                          {clientesPasso1.map((c, idx) => (
                            <tr
                              key={`${c.codigoPadded}-${idx}`}
                              className="border-b border-slate-100 hover:bg-indigo-50/80 cursor-pointer"
                              onClick={() => {
                                setClienteSel(c);
                                setTermoBuscaProcesso('');
                                setPasso(2);
                              }}
                              title="Clique para listar os processos deste cliente"
                            >
                              <td className="px-3 py-2 tabular-nums text-slate-900 font-medium">{c.codigoPadded}</td>
                              <td className="px-3 py-2 text-slate-800 font-medium">{c.nomeCliente}</td>
                              <td className="px-3 py-2 text-slate-600 text-xs">{c.cpfLabel}</td>
                            </tr>
                          ))}
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
                      setProcessosPasso2([]);
                      setTermoBuscaProcesso('');
                    }}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 text-xs text-slate-700 hover:bg-slate-50"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    Voltar aos clientes
                  </button>
                  {loadingProcessos ? (
                    <span className="inline-flex items-center gap-1 text-xs text-slate-500">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Carregando processos…
                    </span>
                  ) : null}
                </div>
                <div className="px-4 py-3 border-b border-slate-200 shrink-0">
                  <div className="flex items-center gap-2">
                    <Search className="w-4 h-4 text-slate-500 shrink-0" />
                    <input
                      type="search"
                      value={termoBuscaProcesso}
                      onChange={(e) => setTermoBuscaProcesso(e.target.value)}
                      placeholder="Filtrar: autor, réu, CNJ, nº antigo ou proc. interno…"
                      className="flex-1 px-3 py-2 border border-slate-300 rounded-lg text-sm bg-white"
                      disabled={loadingProcessos}
                    />
                  </div>
                  {!loadingProcessos && processosPasso2.length > 0 ? (
                    <p className="text-[11px] text-slate-500 mt-1.5">
                      Mostrando <strong>{processosPasso2Filtrados.length}</strong> de {processosPasso2.length} processo(s)
                      {termoBuscaProcesso.trim() ? ' (filtro ativo)' : ''}.
                    </p>
                  ) : null}
                </div>
                <div className="flex-1 min-h-0 overflow-auto p-4">
                  {loadingProcessos ? (
                    <p className="text-sm text-slate-500 text-center py-8">Carregando lista de processos…</p>
                  ) : processosPasso2.length === 0 ? (
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
                            return (
                              <tr
                                key={`${p.processoId ?? 'h'}-${procStr}-${idx}`}
                                className="border-b border-slate-100 hover:bg-indigo-50/80 cursor-pointer"
                                onClick={() => {
                                  if (!clienteSel || !procStr) return;
                                  onAplicar({
                                    codCliente: clienteSel.codCliente,
                                    proc: procStr,
                                  });
                                }}
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
                  type="search"
                  value={termo}
                  onChange={(e) => setTermo(e.target.value)}
                  placeholder="Ex.: nome da parte, réu, CPF ou nº do processo…"
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
                      {resultadosBuscaLivre.map((r, idx) => (
                        <tr
                          key={`${r.codCliente}-${r.proc}-${r.processoNovo}-${idx}`}
                          className="border-b border-slate-100 hover:bg-indigo-50/80 cursor-pointer"
                          onClick={() => onAplicar({ codCliente: r.codCliente, proc: r.proc })}
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
                      ))}
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
