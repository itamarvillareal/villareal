import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { padCliente8Cadastro } from '../../data/cadastroClientesStorage.js';
import {
  loadConfigCalculoCliente,
  refreshConfigCalculoClienteFromApi,
} from '../../data/clienteConfigCalculoStorage.js';
import { featureFlags } from '../../config/featureFlags.js';
import {
  labelRegraInicio,
  maiorDiasAtrasoUnidade,
  normalizarRegraInicioCobrancaDias,
  resumoPreviasRegraInicio,
  unidadeAcionadaPelaRegra,
} from '../../domain/cobrancaRegraInicio.js';
import {
  baixarRelatorioPdf,
  extrairCobranca,
  processarCobranca,
} from '../../repositories/cobrancaRepository.js';
import { downloadPdfBlob } from '../../repositories/documentosRepository.js';
import { BlocoReversaoImportacao } from '../importacao/BlocoReversaoImportacao.jsx';

const inputClass =
  'w-full px-2 py-1.5 border border-slate-300 rounded text-sm bg-white text-slate-900';

function botaoPrimario() {
  return 'rounded-lg px-3 py-1.5 text-sm font-medium text-white bg-sky-700 hover:bg-sky-800 disabled:opacity-50 disabled:pointer-events-none shadow-sm';
}

function botaoSecundario() {
  return 'rounded-lg px-3 py-1.5 text-sm font-medium border border-slate-300 bg-white text-slate-800 hover:bg-slate-50';
}

function formatBrlCentavos(centavos) {
  const n = Number(centavos);
  if (!Number.isFinite(n)) return '—';
  return (n / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatDocDigitos(doc) {
  const d = String(doc ?? '').replace(/\D/g, '');
  if (d.length === 11) {
    return `${d.slice(0, 3)}.${d.slice(3, 6)}.${d.slice(6, 9)}-${d.slice(9)}`;
  }
  if (d.length === 14) {
    return `${d.slice(0, 2)}.${d.slice(2, 5)}.${d.slice(5, 8)}/${d.slice(8, 12)}-${d.slice(12)}`;
  }
  return d || '—';
}

function somaCentavosUnidade(u) {
  const list = u?.cobrancas;
  if (!Array.isArray(list)) return 0;
  return list.reduce((acc, c) => acc + (Number(c?.valorCentavos) || 0), 0);
}

function contarPfPjDasUnidades(unidades) {
  let pf = 0;
  let pj = 0;
  for (const u of unidades || []) {
    const n = String(u?.proprietarioDocDigitos ?? '').replace(/\D/g, '').length;
    if (n === 11) pf += 1;
    else if (n === 14) pj += 1;
  }
  return { pf, pj };
}

function resumoExtracaoCobranca(extracao) {
  const unidades = extracao?.unidades || [];
  const debitos = unidades.reduce((acc, u) => acc + (Array.isArray(u.cobrancas) ? u.cobrancas.length : 0), 0);
  const { pf, pj } = contarPfPjDasUnidades(unidades);
  const t = extracao?.totais || extracao?.resumo || {};
  return {
    unidades: t.unidades ?? t.quantidadeUnidades ?? unidades.length,
    debitos: t.debitos ?? t.quantidadeDebitos ?? t.quantidadeCobrancas ?? debitos,
    pf: t.pf ?? t.quantidadePf ?? pf,
    pj: t.pj ?? t.quantidadePj ?? pj,
    valorTotalCentavos:
      t.valorTotalCentavos ?? unidades.reduce((acc, u) => acc + somaCentavosUnidade(u), 0),
  };
}

function montarTextoResumoProcessamentoCobranca(resultado, clienteCodigo, clienteNome) {
  const linhas = [
    'Cobrança automática — resumo do processamento',
    `Cliente: ${clienteNome || '—'} (${clienteCodigo || '—'})`,
    `importacaoId: ${resultado?.importacaoId ?? '—'}`,
    '',
  ];
  for (const it of resultado?.itens || []) {
    const cod = it.codigoUnidade ?? it.codigoUnidadeNormalizada ?? '?';
    linhas.push(
      [
        `Unidade ${cod}`,
        `processoCriado=${it.processoCriado ?? false}`,
        `numeroInterno=${it.numeroInterno ?? '—'}`,
        `debitosInseridos=${it.debitosInseridos ?? 0}`,
        `debitosIgnorados=${it.debitosIgnorados ?? 0}`,
        `dimensao=${it.dimensao ?? '—'}`,
        `revisaoTrocaDono=${it.revisaoTrocaDono ?? false}`,
      ].join(' | '),
    );
  }
  const erros = resultado?.erros || [];
  if (erros.length) {
    linhas.push('', 'Erros:');
    for (const e of erros) {
      linhas.push(`${e.codigoUnidade ?? e.codigoUnidadeNormalizada ?? '?'}: ${e.mensagem}`);
    }
  }
  return linhas.join('\n');
}

function downloadTextoArquivo(texto, nomeArquivo) {
  const blob = new Blob([texto], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nomeArquivo;
  a.click();
  URL.revokeObjectURL(url);
}

function contagemDebitosItem(it, campoContagem, campoLista) {
  const n = it?.[campoContagem];
  if (Number.isFinite(Number(n))) return Number(n);
  const lista = it?.[campoLista];
  return Array.isArray(lista) ? lista.length : 0;
}

function reconciliacaoCobranca(resultado) {
  const doc = resultado?.totaisDocumento;
  const exec = resultado?.totaisExecucao;
  const titulosDoc = doc?.titulos ?? doc?.debitos ?? 0;
  const inseridos = exec?.titulosInseridos ?? 0;
  const ignorados = exec?.titulosIgnorados ?? 0;
  const falhados = exec?.titulosFalhados ?? 0;
  const soma = inseridos + ignorados + falhados;
  return { titulosDoc, inseridos, ignorados, falhados, soma, fecha: titulosDoc === soma };
}

function normalizarNomeComparacao(s) {
  return String(s ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function condominioDivergeDoCliente(condominioNome, clienteNome) {
  const a = normalizarNomeComparacao(condominioNome);
  const b = normalizarNomeComparacao(clienteNome);
  if (!a || !b) return false;
  if (a === b) return false;
  if (a.includes(b) || b.includes(a)) return false;
  return true;
}

/**
 * Fluxo de cobrança automática (.xls) embutido na ficha do cliente.
 * @param {{ clienteCodigo: string, clienteNome?: string }} props
 */
export function CobrancaAutomaticaPanel({ clienteCodigo, clienteNome }) {
  const codigoCliente = padCliente8Cadastro(clienteCodigo);
  const nomeCliente = String(clienteNome ?? '').trim();

  const [step, setStep] = useState(1);
  const [arquivoXls, setArquivoXls] = useState(null);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [extracao, setExtracao] = useState(null);
  const [processResult, setProcessResult] = useState(null);
  const [loadingExtrair, setLoadingExtrair] = useState(false);
  const [loadingProcessar, setLoadingProcessar] = useState(false);
  const [erro, setErro] = useState(null);
  const [copiado, setCopiado] = useState(false);
  const [regraInicioDias, setRegraInicioDias] = useState(1);
  const xlsInputRef = useRef(null);

  const recarregarRegraCliente = useCallback(async () => {
    if (featureFlags.useApiCalculos) {
      await refreshConfigCalculoClienteFromApi(codigoCliente);
    }
    const c = loadConfigCalculoCliente(codigoCliente);
    setRegraInicioDias(normalizarRegraInicioCobrancaDias(c.regraInicioCobrancaDias));
  }, [codigoCliente]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await recarregarRegraCliente();
      if (cancelled) return;
    })();
    return () => {
      cancelled = true;
    };
  }, [recarregarRegraCliente]);

  useEffect(() => {
    const onAtualizado = () => void recarregarRegraCliente();
    window.addEventListener('vilareal:cliente-config-calculo-atualizado', onAtualizado);
    return () => window.removeEventListener('vilareal:cliente-config-calculo-atualizado', onAtualizado);
  }, [recarregarRegraCliente]);

  const resetFluxo = useCallback(() => {
    setStep(1);
    setArquivoXls(null);
    setFileInputKey((k) => k + 1);
    setExtracao(null);
    setProcessResult(null);
    setErro(null);
    setCopiado(false);
  }, []);

  useEffect(() => {
    resetFluxo();
  }, [codigoCliente, resetFluxo]);

  const resumoExtracao = useMemo(() => (extracao ? resumoExtracaoCobranca(extracao) : null), [extracao]);

  const avisoCondominio = useMemo(() => {
    if (!extracao) return false;
    return condominioDivergeDoCliente(extracao.condominioNome, nomeCliente);
  }, [extracao, nomeCliente]);

  const onExtrair = useCallback(async () => {
    if (!arquivoXls) return;
    setErro(null);
    setLoadingExtrair(true);
    try {
      const data = await extrairCobranca(arquivoXls);
      setExtracao(data);
      setProcessResult(null);
      setStep(2);
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoadingExtrair(false);
    }
  }, [arquivoXls]);

  const onClicarExtrairOuEscolher = useCallback(() => {
    if (!arquivoXls) {
      xlsInputRef.current?.click();
      return;
    }
    void onExtrair();
  }, [arquivoXls, onExtrair]);

  const onProcessar = useCallback(async () => {
    if (!Array.isArray(extracao?.unidades)) return;
    setErro(null);
    setLoadingProcessar(true);
    try {
      const data = await processarCobranca({
        clienteCodigo: codigoCliente,
        unidades: extracao.unidades,
        arquivoNome: arquivoXls?.name || undefined,
      });
      setProcessResult(data);
      setStep(3);
      if (data?.importacaoId) {
        try {
          const { blob, filename } = await baixarRelatorioPdf(data.importacaoId);
          downloadPdfBlob(blob, filename);
        } catch (pdfErr) {
          setErro(
            (prev) =>
              prev ||
              `Processamento OK, mas o PDF não foi baixado: ${pdfErr?.message || String(pdfErr)}`,
          );
        }
      }
    } catch (e) {
      setErro(e?.message || String(e));
    } finally {
      setLoadingProcessar(false);
    }
  }, [codigoCliente, extracao, arquivoXls]);

  const onBaixarPdf = useCallback(async () => {
    const id = processResult?.importacaoId;
    if (!id) return;
    setErro(null);
    try {
      const { blob, filename } = await baixarRelatorioPdf(id);
      downloadPdfBlob(blob, filename);
    } catch (e) {
      setErro(e?.message || String(e));
    }
  }, [processResult?.importacaoId]);

  const textoResumo = useMemo(() => {
    if (!processResult) return '';
    return montarTextoResumoProcessamentoCobranca(processResult, codigoCliente, nomeCliente);
  }, [processResult, codigoCliente, nomeCliente]);

  const reconc = useMemo(
    () => (processResult ? reconciliacaoCobranca(processResult) : null),
    [processResult],
  );

  const regraLabel = useMemo(() => labelRegraInicio(regraInicioDias), [regraInicioDias]);

  const previaRegra = useMemo(() => {
    if (!extracao?.unidades?.length) return null;
    return resumoPreviasRegraInicio(extracao.unidades, regraInicioDias);
  }, [extracao, regraInicioDias]);

  const copiarResumo = useCallback(async () => {
    if (!textoResumo) return;
    try {
      await navigator.clipboard.writeText(textoResumo);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      setErro('Não foi possível copiar para a área de transferência.');
    }
  }, [textoResumo]);

  const rotuloRelatorio =
    extracao?.condominioNome || extracao?.dataReferencia
      ? `Relatório: ${extracao?.condominioNome || '—'} — ref ${extracao?.dataReferencia || '—'}`
      : null;

  return (
    <div className="space-y-4">
      {erro && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">{erro}</div>
      )}

      {step === 1 && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">Passo 1 — Relatório .xls</span>: envie o arquivo exportado
            pelo sistema do condomínio e clique em Extrair.
          </p>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Arquivo .xls / .xlsx</label>
            <input
              ref={xlsInputRef}
              key={fileInputKey}
              type="file"
              accept=".xls,.xlsx,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              className="block w-full text-sm text-slate-600"
              onChange={(e) => setArquivoXls(e.target.files?.[0] ?? null)}
            />
          </div>
          <button
            type="button"
            className={botaoPrimario()}
            disabled={loadingExtrair}
            onClick={onClicarExtrairOuEscolher}
          >
            {loadingExtrair ? 'Extraindo…' : !arquivoXls ? 'Escolher arquivo…' : 'Extrair relatório'}
          </button>
        </div>
      )}

      {step === 2 && extracao && resumoExtracao && (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            <span className="font-medium text-slate-800">Passo 2 — Revisão</span>: confira o relatório e as unidades
            antes de processar para o cliente <span className="font-mono text-xs">{codigoCliente}</span>
            {nomeCliente ? ` (${nomeCliente})` : ''}.
          </p>
          {rotuloRelatorio && (
            <p className="text-sm font-medium text-slate-800">{rotuloRelatorio}</p>
          )}
          <p className="text-sm text-slate-700">
            <span className="font-medium text-slate-800">Regra:</span> {regraLabel}
            <span className="text-slate-500 text-xs ml-1">
              (prévia com base na data de hoje; a decisão oficial é no processamento)
            </span>
          </p>
          {previaRegra && previaRegra.descartados > 0 && (
            <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              Prévia: {previaRegra.descartados} devedor(es) / {previaRegra.titulosDescartados} taxa(s) seriam
              descartados pela regra {previaRegra.regraLabel}.
            </p>
          )}
          {avisoCondominio && (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
              O nome do condomínio no relatório (
              <strong>{extracao.condominioNome || '—'}</strong>) parece diferente do cliente selecionado (
              <strong>{nomeCliente || '—'}</strong>). Confira se o arquivo pertence a este cliente antes de processar.
            </div>
          )}
          <dl className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 text-sm">
            <div>
              <dt className="text-slate-500">Unidades</dt>
              <dd className="font-medium tabular-nums text-slate-800">{resumoExtracao.unidades}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Débitos</dt>
              <dd className="font-medium tabular-nums text-slate-800">{resumoExtracao.debitos}</dd>
            </div>
            <div>
              <dt className="text-slate-500">PF / PJ</dt>
              <dd className="font-medium tabular-nums text-slate-800">
                {resumoExtracao.pf} / {resumoExtracao.pj}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Valor total</dt>
              <dd className="font-medium tabular-nums text-slate-800">
                {formatBrlCentavos(resumoExtracao.valorTotalCentavos)}
              </dd>
            </div>
          </dl>
          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50 text-slate-600">
                <tr>
                  <th className="text-left px-3 py-2 font-medium">Unidade</th>
                  <th className="text-left px-3 py-2 font-medium">Proprietário</th>
                  <th className="text-left px-3 py-2 font-medium">CPF/CNPJ</th>
                  <th className="text-right px-3 py-2 font-medium">Cobranças</th>
                  <th className="text-right px-3 py-2 font-medium">Maior atraso</th>
                  <th className="text-center px-3 py-2 font-medium">Regra</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(extracao.unidades || []).map((u) => {
                  const cod = u.codigoUnidadeNormalizada || u.codigoUnidade || '—';
                  const n = Array.isArray(u.cobrancas) ? u.cobrancas.length : 0;
                  const maiorDias = maiorDiasAtrasoUnidade(u);
                  const acionado = unidadeAcionadaPelaRegra(u, regraInicioDias);
                  return (
                    <tr key={cod} className="text-slate-800">
                      <td className="px-3 py-2 font-mono text-xs">{cod}</td>
                      <td className="px-3 py-2 max-w-[240px] truncate" title={u.proprietarioNome}>
                        {u.proprietarioNome || '—'}
                      </td>
                      <td className="px-3 py-2 tabular-nums text-xs">
                        {formatDocDigitos(u.proprietarioDocDigitos)}
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums">{n}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-600">
                        {maiorDias != null ? `${maiorDias} d` : '—'}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {acionado ? (
                          <span className="inline-block rounded-full bg-emerald-100 px-2 py-0.5 text-xs font-medium text-emerald-800">
                            acionado
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                            descartado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button
              type="button"
              className={botaoSecundario()}
              disabled={loadingProcessar}
              onClick={() => {
                setStep(1);
                setExtracao(null);
              }}
            >
              Voltar
            </button>
            <button
              type="button"
              className={botaoPrimario()}
              disabled={loadingProcessar || !(extracao.unidades && extracao.unidades.length)}
              onClick={() => void onProcessar()}
            >
              {loadingProcessar ? 'Processando…' : 'Processar'}
            </button>
          </div>
        </div>
      )}

      {step === 3 && processResult && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-800">Processamento concluído</p>
          {processResult.regraInicio && (
            <p className="text-sm text-slate-700">
              Regra aplicada:{' '}
              <span className="font-medium">{processResult.regraInicio.regraAplicada ?? regraLabel}</span>
              {processResult.regraInicio.dataImportacao ? (
                <span className="text-slate-500 text-xs ml-1">
                  (importação {processResult.regraInicio.dataImportacao})
                </span>
              ) : null}
            </p>
          )}
          {processResult.regraInicio &&
            (processResult.regraInicio.devedoresDescartados > 0 ||
              processResult.regraInicio.titulosDescartados > 0) && (
              <p className="text-sm text-amber-950 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                Descartados pela regra {processResult.regraInicio.regraAplicada ?? regraLabel}:{' '}
                {processResult.regraInicio.devedoresDescartados ?? 0} devedor(es) /{' '}
                {processResult.regraInicio.titulosDescartados ?? 0} taxa(s)
              </p>
            )}
          {reconc && (
            <p
              className={`text-sm tabular-nums ${
                reconc.fecha ? 'text-slate-700' : 'font-medium text-red-700'
              }`}
            >
              Documento {reconc.titulosDoc} = Inseridos {reconc.inseridos} + Ignorados {reconc.ignorados} + Falhados{' '}
              {reconc.falhados}
            </p>
          )}
          {(processResult.pontosAtencao || []).length > 0 && (
            <div
              className={`rounded-lg border px-3 py-2 text-sm space-y-1 ${
                (processResult.pontosAtencao || []).some((p) => String(p).includes('DIVERGÊNCIA'))
                  ? 'border-red-300 bg-red-50 text-red-900'
                  : 'border-amber-300 bg-amber-50 text-amber-950'
              }`}
            >
              <p className="font-medium">Pontos de atenção</p>
              <ul className="list-disc pl-5 space-y-0.5">
                {processResult.pontosAtencao.map((p, i) => (
                  <li key={i}>{p}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="break-all text-xs text-slate-500">
            <span className="font-medium">importacaoId</span>{' '}
            <span className="font-mono">{processResult.importacaoId ?? '—'}</span>
          </p>
          {(processResult.itens || []).length > 0 && (
            <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-slate-600">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium">Unidade</th>
                    <th className="text-left px-3 py-2 font-medium">Processo</th>
                    <th className="text-right px-3 py-2 font-medium">Inseridos</th>
                    <th className="text-right px-3 py-2 font-medium">Ignorados</th>
                    <th className="text-right px-3 py-2 font-medium">Dim.</th>
                    <th className="text-center px-3 py-2 font-medium">Troca dono</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {processResult.itens.map((it, i) => {
                    const cod = it.codigoUnidade ?? it.codigoUnidadeNormalizada ?? '—';
                    return (
                      <tr key={`${cod}-${i}`} className="text-slate-800">
                        <td className="px-3 py-2 font-mono text-xs">{cod}</td>
                        <td className="px-3 py-2 text-xs">
                          {it.numeroInterno != null ? (
                            <>
                              nº {it.numeroInterno}
                              {it.processoCriado ? ' (novo)' : ''}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {contagemDebitosItem(it, 'debitosInseridos', 'inseridos')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">
                          {contagemDebitosItem(it, 'debitosIgnorados', 'ignorados')}
                        </td>
                        <td className="px-3 py-2 text-right tabular-nums">{it.dimensao ?? '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {it.revisaoTrocaDono ? (
                            <span className="text-amber-700">Sim</span>
                          ) : (
                            <span className="text-slate-400">—</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {(processResult.erros || []).length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-red-700">Erros</h3>
              <ul className="space-y-1 text-sm text-red-800">
                {processResult.erros.map((e, i) => (
                  <li key={i}>
                    <span className="font-medium">{e.codigoUnidade ?? e.codigoUnidadeNormalizada ?? '?'}</span>:{' '}
                    {e.mensagem}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <div className="flex flex-wrap gap-2">
            {processResult.importacaoId ? (
              <button type="button" className={botaoSecundario()} onClick={() => void onBaixarPdf()}>
                Baixar relatório (PDF)
              </button>
            ) : null}
            <button type="button" className={botaoSecundario()} onClick={() => void copiarResumo()}>
              {copiado ? 'Copiado!' : 'Copiar resumo'}
            </button>
            <button
              type="button"
              className={botaoSecundario()}
              onClick={() => downloadTextoArquivo(textoResumo, `cobranca-${processResult.importacaoId || 'resumo'}.txt`)}
            >
              Baixar resumo (.txt)
            </button>
            <button type="button" className={botaoPrimario()} onClick={resetFluxo}>
              Nova cobrança
            </button>
          </div>
          {processResult.importacaoId ? (
            <BlocoReversaoImportacao importacaoId={processResult.importacaoId} />
          ) : null}
        </div>
      )}
    </div>
  );
}
