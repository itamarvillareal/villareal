import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { featureFlags } from '../config/featureFlags.js';
import { padCliente8Cadastro } from '../data/cadastroClientesStorage.js';
import { listarClientesCadastro } from '../repositories/clientesRepository.js';
import {
  extrairInadimplenciaPdf,
  importarInadimplenciaConfirmado,
} from '../repositories/condominioInadimplenciaRepository.js';

const inputClass =
  'w-full px-2 py-1.5 border border-slate-300 dark:border-slate-600 rounded text-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100';

function formatBrlCentavos(centavos) {
  const n = Number(centavos);
  if (!Number.isFinite(n)) return '—';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function botaoPrimario() {
  return `rounded px-3 py-1.5 text-sm font-medium text-white bg-slate-800 hover:bg-slate-900 dark:bg-slate-600 dark:hover:bg-slate-500 disabled:opacity-50 disabled:pointer-events-none`;
}

function botaoSecundario() {
  return `rounded px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800`;
}

/** Soma valorCentavos das cobranças de uma unidade (API de extração). */
function somaCentavosUnidade(u) {
  const list = u?.cobrancas;
  if (!Array.isArray(list)) return 0;
  return list.reduce((acc, c) => acc + (Number(c?.valorCentavos) || 0), 0);
}

/**
 * Tela «Atividades em Lote» — ponto de entrada pelo menu lateral.
 */
export function AtividadesEmLote() {
  const apiOk =
    featureFlags.useApiClientes &&
    featureFlags.useApiProcessos &&
    featureFlags.useApiCalculos;

  const [fluxoAberto, setFluxoAberto] = useState(false);
  const [step, setStep] = useState(1);
  const [clientes, setClientes] = useState([]);
  const [loadingClientes, setLoadingClientes] = useState(false);
  const [buscaCliente, setBuscaCliente] = useState('');
  const [clienteSel, setClienteSel] = useState(null);
  const [arquivoPdf, setArquivoPdf] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [extracao, setExtracao] = useState(null);
  const [importResult, setImportResult] = useState(null);
  const [expandedUnidades, setExpandedUnidades] = useState(() => new Set());
  const [loadingExtrair, setLoadingExtrair] = useState(false);
  const [loadingImportar, setLoadingImportar] = useState(false);
  const [erro, setErro] = useState(null);
  /** Alinhado à arquitetura em que cliente (cadastro) e autora do processo podem ser pessoas distintas. */
  const [autorMesmaPessoaCliente, setAutorMesmaPessoaCliente] = useState(true);
  const pdfInputRef = useRef(null);

  const resetFluxoInadimplencia = useCallback(() => {
    setStep(1);
    setExtracao(null);
    setImportResult(null);
    setClienteSel(null);
    setArquivoPdf(null);
    setFileInputKey((k) => k + 1);
    setBuscaCliente('');
    setExpandedUnidades(new Set());
    setErro(null);
    setAutorMesmaPessoaCliente(true);
  }, []);

  useEffect(() => {
    if (!fluxoAberto || !apiOk) return undefined;
    let cancelled = false;
    (async () => {
      setLoadingClientes(true);
      setErro(null);
      try {
        const list = await listarClientesCadastro();
        if (!cancelled) setClientes(Array.isArray(list) ? list : []);
      } catch (e) {
        if (!cancelled) setErro(e?.message || String(e));
      } finally {
        if (!cancelled) setLoadingClientes(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [fluxoAberto, apiOk]);

  const clientesFiltrados = useMemo(() => {
    const q = buscaCliente.trim().toLowerCase();
    const digitos = q.replace(/\D/g, '');
    const base = clientes;
    if (!q) return base.slice(0, 100);
    return base
      .filter((c) => {
        const cod = String(c.codigo ?? '');
        const nome = String(c.nomeRazao ?? '').toLowerCase();
        if (digitos.length > 0 && cod.includes(digitos)) return true;
        return nome.includes(q);
      })
      .slice(0, 100);
  }, [clientes, buscaCliente]);

  const onAnalisarPdf = useCallback(async () => {
    if (!clienteSel?.codigo || !arquivoPdf) return;
    setErro(null);
    setLoadingExtrair(true);
    try {
      const data = await extrairInadimplenciaPdf(padCliente8Cadastro(clienteSel.codigo), arquivoPdf);
      setExtracao(data);
      setExpandedUnidades(new Set());
      setStep(2);
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoadingExtrair(false);
    }
  }, [clienteSel, arquivoPdf]);

  /** Com cliente já escolhido: 1.º clique abre o PDF; com arquivo, envia para análise. */
  const onClicarAnalisarOuEscolherPdf = useCallback(() => {
    if (!clienteSel?.codigo) return;
    if (!arquivoPdf) {
      pdfInputRef.current?.click();
      return;
    }
    void onAnalisarPdf();
  }, [clienteSel, arquivoPdf, onAnalisarPdf]);

  const onConfirmarImportar = useCallback(async () => {
    if (!extracao?.clienteCodigo || !Array.isArray(extracao.unidades)) return;
    setErro(null);
    setLoadingImportar(true);
    try {
      const body = {
        clienteCodigo: extracao.clienteCodigo,
        unidades: extracao.unidades,
        autorMesmaPessoaCliente,
      };
      const data = await importarInadimplenciaConfirmado(body);
      setImportResult(data);
      setStep(4);
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoadingImportar(false);
    }
  }, [extracao, autorMesmaPessoaCliente]);

  const toggleUnidade = useCallback((cod) => {
    setExpandedUnidades((prev) => {
      const next = new Set(prev);
      if (next.has(cod)) next.delete(cod);
      else next.add(cod);
      return next;
    });
  }, []);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 p-4">
      <header>
        <h1 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Atividades em Lote</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Operações em massa com confirmação antes de gravar no servidor.
        </p>
      </header>

      {!apiOk && (
        <div className="rounded border border-amber-200 bg-amber-50 dark:border-amber-900 dark:bg-amber-950/40 px-3 py-2 text-sm text-amber-900 dark:text-amber-100">
          Para usar importação de inadimplência é necessário API de clientes, processos e cálculos ativa
          (`VITE_USE_API_CLIENTES`, `VITE_USE_API_PROCESSOS`, `VITE_USE_API_CALCULOS`).
        </div>
      )}

      {apiOk && !fluxoAberto && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <button
            type="button"
            onClick={() => {
              resetFluxoInadimplencia();
              setFluxoAberto(true);
            }}
            className="flex flex-col items-start gap-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-4 text-left shadow-sm hover:border-slate-300 dark:hover:border-slate-600 transition-colors"
          >
            <span className="font-medium text-slate-800 dark:text-slate-100">
              Importar inadimplência condominial (PDF)
            </span>
            <span className="text-xs text-slate-600 dark:text-slate-400">
              Analisa o relatório, confere unidades e cobranças e grava processos + rodadas de cálculo (dimensão 0).
            </span>
          </button>
        </div>
      )}

      {apiOk && fluxoAberto && (
        <div className="rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/50 p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">
              Importar inadimplência condominial (PDF)
            </h2>
            <button
              type="button"
              className={botaoSecundario()}
              onClick={() => {
                resetFluxoInadimplencia();
                setFluxoAberto(false);
              }}
            >
              Voltar à lista
            </button>
          </div>

          {erro && (
            <div className="rounded border border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/40 px-3 py-2 text-sm text-red-800 dark:text-red-100">
              {erro}
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 1 — Configuração</span>
                : selecione o cliente (condomínio), envie o PDF e clique em Analisar.
              </p>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Buscar cliente (nome ou código)
                </label>
                <input
                  className={inputClass}
                  value={buscaCliente}
                  onChange={(e) => setBuscaCliente(e.target.value)}
                  placeholder="Ex.: 00000299 ou nome do condomínio"
                  disabled={loadingClientes}
                />
              </div>
              <div className="max-h-48 overflow-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                {loadingClientes ? (
                  <p className="p-3 text-sm text-slate-500">Carregando clientes…</p>
                ) : clientesFiltrados.length === 0 ? (
                  <p className="p-3 text-sm text-slate-500">Nenhum cliente na lista.</p>
                ) : (
                  <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                    {clientesFiltrados.map((c) => {
                      const cod = padCliente8Cadastro(c.codigo);
                      const ativo = clienteSel && padCliente8Cadastro(clienteSel.codigo) === cod;
                      return (
                        <li key={cod}>
                          <button
                            type="button"
                            className={`w-full text-left px-3 py-2 text-sm hover:bg-slate-50 dark:hover:bg-slate-900 ${
                              ativo ? 'bg-slate-100 dark:bg-slate-800 font-medium' : ''
                            }`}
                            onClick={() => setClienteSel(c)}
                          >
                            <span className="tabular-nums text-slate-500 dark:text-slate-400">{cod}</span>
                            {' — '}
                            <span className="text-slate-800 dark:text-slate-100">{c.nomeRazao || '—'}</span>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 dark:text-slate-400 mb-1">
                  Arquivo PDF
                </label>
                <input
                  ref={pdfInputRef}
                  key={fileInputKey}
                  type="file"
                  accept=".pdf,application/pdf"
                  className="block w-full text-sm text-slate-600 dark:text-slate-300"
                  onChange={(e) => setArquivoPdf(e.target.files?.[0] ?? null)}
                />
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                  Depois do cliente, use o botão abaixo para abrir a janela de seleção do PDF (ou o controle de arquivo
                  acima). O nome do arquivo só aparece depois que você escolher um PDF — antes disso o navegador mostra
                  Nenhum arquivo escolhido.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  className={botaoPrimario()}
                  disabled={!clienteSel || loadingExtrair}
                  onClick={onClicarAnalisarOuEscolherPdf}
                >
                  {loadingExtrair
                    ? 'Analisando…'
                    : !arquivoPdf
                      ? 'Escolher PDF…'
                      : 'Analisar PDF'}
                </button>
              </div>
            </div>
          )}

          {step === 2 && extracao && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 2 — Revisão do extrato</span>
                : confira os dados extraídos do PDF, as cobranças por unidade e a opção de autora. Em seguida você verá
                o resumo para confirmar antes de gravar.
              </p>
              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Condomínio (cliente)</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-100">
                    {extracao.clienteNome || '—'}{' '}
                    <span className="tabular-nums text-slate-500 font-normal">
                      ({extracao.clienteCodigo || '—'})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Nome no PDF</dt>
                  <dd className="text-slate-800 dark:text-slate-100">{extracao.condominioNome || '—'}</dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Data de referência (PDF)</dt>
                  <dd className="tabular-nums text-slate-800 dark:text-slate-100">
                    {extracao.dataReferenciaPdf || '—'}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Resumo</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    {extracao.resumo?.quantidadeUnidades ?? 0} unidades, {extracao.resumo?.quantidadeCobrancas ?? 0}{' '}
                    cobranças, total {formatBrlCentavos(extracao.resumo?.valorTotalCentavos)}
                  </dd>
                </div>
              </dl>

              <div className="space-y-2">
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300">Unidades e cobranças</h3>
                <ul className="space-y-2">
                  {(extracao.unidades || []).map((u) => {
                    const cod = u.codigoUnidade || '?';
                    const aberto = expandedUnidades.has(cod);
                    const n = Array.isArray(u.cobrancas) ? u.cobrancas.length : 0;
                    return (
                      <li
                        key={cod}
                        className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 overflow-hidden"
                      >
                        <button
                          type="button"
                          className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm font-medium text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-900"
                          onClick={() => toggleUnidade(cod)}
                        >
                          <span>
                            Unidade <span className="tabular-nums">{cod}</span>
                            <span className="font-normal text-slate-500 dark:text-slate-400">
                              {' '}
                              — {n} cobrança(s)
                            </span>
                          </span>
                          <span className="text-slate-400">{aberto ? '▼' : '▶'}</span>
                        </button>
                        {aberto && n > 0 && (
                          <div className="border-t border-slate-100 dark:border-slate-800 overflow-x-auto">
                            <table className="min-w-full text-xs">
                              <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                                <tr>
                                  <th className="text-left px-2 py-1.5 font-medium">Receita</th>
                                  <th className="text-left px-2 py-1.5 font-medium">Doc</th>
                                  <th className="text-left px-2 py-1.5 font-medium">Período</th>
                                  <th className="text-left px-2 py-1.5 font-medium">Vencimento</th>
                                  <th className="text-right px-2 py-1.5 font-medium">Valor</th>
                                  <th className="text-right px-2 py-1.5 font-medium">Multa</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {u.cobrancas.map((row, idx) => (
                                  <tr key={`${cod}-${idx}`} className="text-slate-800 dark:text-slate-200">
                                    <td className="px-2 py-1.5 max-w-[200px] truncate" title={row.receita}>
                                      {row.receita}
                                    </td>
                                    <td className="px-2 py-1.5 tabular-nums">{row.doc}</td>
                                    <td className="px-2 py-1.5 tabular-nums">{row.periodo}</td>
                                    <td className="px-2 py-1.5 tabular-nums">{row.vencimento}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{row.valor}</td>
                                    <td className="px-2 py-1.5 text-right tabular-nums">{row.multa}</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>

              <fieldset className="rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950 px-3 py-3 space-y-2">
                <legend className="px-1 text-sm font-medium text-slate-800 dark:text-slate-200">
                  Autora do processo
                </legend>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  O cadastro de cliente (condomínio) usa uma pessoa; o processo pode ter outra pessoa como autora.
                  Confirme antes de gravar.
                </p>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800 dark:text-slate-100">
                  <input
                    type="radio"
                    name="autor-mesma-pessoa"
                    className="mt-1"
                    checked={autorMesmaPessoaCliente}
                    onChange={() => setAutorMesmaPessoaCliente(true)}
                  />
                  <span>
                    Sim — a <strong>autora</strong> é a <strong>mesma pessoa</strong> vinculada a este cliente (
                    {extracao.clienteNome || 'cliente selecionado'}).
                  </span>
                </label>
                <label className="flex cursor-pointer items-start gap-2 text-sm text-slate-800 dark:text-slate-100">
                  <input
                    type="radio"
                    name="autor-mesma-pessoa"
                    className="mt-1"
                    checked={!autorMesmaPessoaCliente}
                    onChange={() => setAutorMesmaPessoaCliente(false)}
                  />
                  <span>
                    Não — são <strong>pessoas distintas</strong>. O processo será criado sem parte autora e sem nome no
                    cabeçalho do cálculo; complete depois na tela de processos.
                  </span>
                </label>
              </fieldset>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className={botaoSecundario()}
                  disabled={loadingImportar}
                  onClick={() => {
                    setStep(1);
                    setExtracao(null);
                    setExpandedUnidades(new Set());
                    setAutorMesmaPessoaCliente(true);
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="button"
                  className={botaoPrimario()}
                  disabled={!(extracao.unidades && extracao.unidades.length)}
                  onClick={() => setStep(3)}
                >
                  Continuar para confirmação final
                </button>
              </div>
            </div>
          )}

          {step === 3 && extracao && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 3 — Confirmação final</span>
                : leia o resumo abaixo. Nada será gravado até você acionar o botão de confirmação no final desta página.
              </p>

              <div className="rounded-lg border border-amber-200 bg-amber-50/90 dark:border-amber-900 dark:bg-amber-950/50 px-3 py-2 text-sm text-amber-950 dark:text-amber-100">
                Ao confirmar, serão criados ou atualizados <strong>processos</strong> e <strong>rodadas de cálculo</strong>{' '}
                conforme cada unidade listada — conforme a regra já definida para esta importação.
              </div>

              <dl className="grid gap-2 sm:grid-cols-2 text-sm">
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Cliente</dt>
                  <dd className="font-medium text-slate-800 dark:text-slate-100">
                    {extracao.clienteNome || '—'}{' '}
                    <span className="tabular-nums text-slate-500 font-normal">
                      ({extracao.clienteCodigo || '—'})
                    </span>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Referência no PDF</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    {extracao.condominioNome || '—'}
                    {extracao.dataReferenciaPdf ? (
                      <span className="tabular-nums text-slate-500"> · {extracao.dataReferenciaPdf}</span>
                    ) : null}
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Totais a importar</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    <strong>{extracao.resumo?.quantidadeUnidades ?? 0}</strong> unidades ·{' '}
                    <strong>{extracao.resumo?.quantidadeCobrancas ?? 0}</strong> cobranças · total{' '}
                    <strong>{formatBrlCentavos(extracao.resumo?.valorTotalCentavos)}</strong>
                  </dd>
                </div>
                <div>
                  <dt className="text-slate-500 dark:text-slate-400">Autora do processo</dt>
                  <dd className="text-slate-800 dark:text-slate-100">
                    {autorMesmaPessoaCliente ? (
                      <>
                        Mesma pessoa do cliente — <span className="font-medium">{extracao.clienteNome || '—'}</span>{' '}
                        (parte AUTOR e nome no cabeçalho do cálculo).
                      </>
                    ) : (
                      <>
                        <strong>Pessoa distinta</strong> do cliente — processos sem parte autora e sem nome no
                        cabeçalho do cálculo até cadastro manual.
                      </>
                    )}
                  </dd>
                </div>
              </dl>

              <div>
                <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                  Resumo por unidade (o que será importado)
                </h3>
                <div className="overflow-x-auto rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-950">
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 dark:bg-slate-900 text-slate-600 dark:text-slate-400">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Unidade</th>
                        <th className="text-right px-3 py-2 font-medium">Cobranças</th>
                        <th className="text-right px-3 py-2 font-medium">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {(extracao.unidades || []).map((u) => {
                        const cod = u.codigoUnidade || '—';
                        const n = Array.isArray(u.cobrancas) ? u.cobrancas.length : 0;
                        const sub = somaCentavosUnidade(u);
                        return (
                          <tr key={cod} className="text-slate-800 dark:text-slate-200">
                            <td className="px-3 py-2 font-mono text-xs sm:text-sm">{cod}</td>
                            <td className="px-3 py-2 text-right tabular-nums">{n}</td>
                            <td className="px-3 py-2 text-right tabular-nums font-medium">
                              {formatBrlCentavos(sub)}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-slate-200 dark:border-slate-700 bg-slate-50/80 dark:bg-slate-900/80">
                      <tr className="font-medium text-slate-900 dark:text-slate-100">
                        <td className="px-3 py-2">Total</td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {extracao.resumo?.quantidadeCobrancas ?? '—'}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {formatBrlCentavos(extracao.resumo?.valorTotalCentavos)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  className={botaoSecundario()}
                  disabled={loadingImportar}
                  onClick={() => setStep(2)}
                >
                  Voltar
                </button>
                <button
                  type="button"
                  className={botaoPrimario()}
                  disabled={loadingImportar || !(extracao.unidades && extracao.unidades.length)}
                  onClick={onConfirmarImportar}
                >
                  {loadingImportar ? 'Importando…' : 'Confirmar importação'}
                </button>
              </div>
            </div>
          )}

          {step === 4 && importResult && (
            <div className="space-y-4">
              <p className="text-sm text-slate-600 dark:text-slate-400">
                <span className="font-medium text-slate-700 dark:text-slate-300">Passo 4 — Resultado</span>
              </p>
              <p className="text-sm text-slate-800 dark:text-slate-100">
                Processos novos: <strong>{importResult.processosCriados ?? 0}</strong>
                {' · '}
                Cobranças lançadas (total): <strong>{importResult.cobrancasLancadasTotal ?? 0}</strong>
              </p>

              {(importResult.itens || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                    Por unidade / processo
                  </h3>
                  <ul className="space-y-1 text-sm">
                    {importResult.itens.map((it, i) => (
                      <li
                        key={`${it.codigoUnidade}-${i}`}
                        className="flex flex-wrap gap-x-3 gap-y-1 text-slate-800 dark:text-slate-200"
                      >
                        <span className="tabular-nums font-medium">{it.codigoUnidade}</span>
                        <span className="text-slate-500 dark:text-slate-400">
                          proc. interno {it.numeroInterno ?? '—'}
                          {it.processoCriado ? ' (novo)' : ''}
                        </span>
                        <span>
                          {it.cobrancasLancadas ?? 0} cobrança(s) lançada(s)
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {(importResult.erros || []).length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-700 dark:text-red-300 mb-2">Erros</h3>
                  <ul className="space-y-1 text-sm text-red-800 dark:text-red-200">
                    {importResult.erros.map((e, i) => (
                      <li key={i}>
                        <span className="tabular-nums font-medium">{e.codigoUnidade}</span>: {e.mensagem}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              <button
                type="button"
                className={botaoPrimario()}
                onClick={resetFluxoInadimplencia}
              >
                Nova importação
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
