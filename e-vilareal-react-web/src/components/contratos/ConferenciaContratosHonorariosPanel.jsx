import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Loader2,
  Search,
  Shield,
  SkipForward,
  Wallet,
  X,
} from 'lucide-react';
import {
  TIPOS_REMUNERACAO,
  TIPO_REMUNERACAO_PERCENTUAL,
  TIPO_REMUNERACAO_MISTO,
  clausula3FormParaApi,
  formatarMoedaCampo,
} from '../../pages/documentos/contratoHonorariosClausula3.js';
import {
  aprovarImportacao,
  conciliarRetroativoImportacao,
  listarFilaImportacaoTodas,
  obterImportacao,
  obterPdfImportacao,
  rejeitarImportacao,
  relatorioCensoHonorarios,
  salvarRevisaoImportacao,
} from '../../repositories/contratosHonorariosImportacaoRepository.js';
import {
  carregarResumoContaCorrenteProcesso,
  listarLancamentosFinanceiro,
} from '../../repositories/financeiroRepository.js';
import {
  avaliarQualidadeImportacao,
  badgeConfiancaClasse,
  classeRecomendacao,
  extracaoParaFormConferencia,
  flagsNomeArquivoImportacao,
  inputClassConferencia,
  labelRecomendacao,
  recomendacaoConferencia,
  scoreConferenciaItem,
} from './conferenciaImportacaoHonorariosUtils.js';

function formatMoeda(valor) {
  const n = Number(valor);
  if (!Number.isFinite(n)) return '—';
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

/**
 * Painel de conferência em lote — fila EM_REVISAO, preview PDF, financeiro e aprovação.
 */
export function ConferenciaContratosHonorariosPanel({ codigoClienteFiltro, onFechar }) {
  const [fila, setFila] = useState([]);
  const [indice, setIndice] = useState(0);
  const [itemAtual, setItemAtual] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [carregandoLista, setCarregandoLista] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [busca, setBusca] = useState('');
  const [filtroRec, setFiltroRec] = useState('TODOS');
  const [censo, setCenso] = useState(null);
  const [pdfUrl, setPdfUrl] = useState('');
  const [financeiro, setFinanceiro] = useState({ resumo: null, creditos: [] });
  const [conciliacao, setConciliacao] = useState(null);

  const [roteamento, setRoteamento] = useState('HONORARIOS');
  const [formClausula, setFormClausula] = useState(extracaoParaFormConferencia());
  const [dataContrato, setDataContrato] = useState('');
  const [objetoContrato, setObjetoContrato] = useState('');
  const [processoIdRev, setProcessoIdRev] = useState('');
  const [numeroInternoRev, setNumeroInternoRev] = useState('');
  const [expectativaValor, setExpectativaValor] = useState('');
  const [forcarAtualizacao, setForcarAtualizacao] = useState(false);

  const filaEnriquecida = useMemo(() => {
    return fila.map((it) => {
      const flags = flagsNomeArquivoImportacao(it.pdfNomeArquivo);
      const qual = avaliarQualidadeImportacao(it.dadosAprovados || it.dadosExtraidos, it);
      const score = scoreConferenciaItem(it, qual, flags);
      const rec = recomendacaoConferencia(score, qual, flags);
      return { ...it, _flags: flags, _qual: qual, _score: score, _rec: rec };
    });
  }, [fila]);

  const filaVisivel = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return filaEnriquecida.filter((it) => {
      if (filtroRec !== 'TODOS' && it._rec !== filtroRec) return false;
      if (!q) return true;
      const hay = [
        it.codigoCliente,
        it.pdfNomeArquivo,
        it.dadosAprovados?.objetoContrato,
        it.processoSugerido?.numeroCnj,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [filaEnriquecida, busca, filtroRec]);

  const itemVisivel = filaVisivel[indice] ?? null;

  const carregarFila = useCallback(async () => {
    setCarregandoLista(true);
    setErro('');
    try {
      const [rev, ext, cen] = await Promise.all([
        listarFilaImportacaoTodas({
          status: 'EM_REVISAO',
          codigoCliente: codigoClienteFiltro || undefined,
        }),
        listarFilaImportacaoTodas({
          status: 'EXTRAIDO',
          codigoCliente: codigoClienteFiltro || undefined,
        }),
        relatorioCensoHonorarios().catch(() => null),
      ]);
      setFila([...rev, ...ext]);
      setCenso(cen);
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar fila.');
    } finally {
      setCarregandoLista(false);
    }
  }, [codigoClienteFiltro]);

  useEffect(() => {
    void carregarFila();
  }, [carregarFila]);

  useEffect(() => {
    if (indice >= filaVisivel.length && filaVisivel.length > 0) {
      setIndice(filaVisivel.length - 1);
    }
  }, [filaVisivel.length, indice]);

  const carregarFinanceiro = useCallback(async (processoId, codigoCliente) => {
    if (!processoId) {
      setFinanceiro({ resumo: null, creditos: [] });
      return;
    }
    try {
      const [resumo, lancs] = await Promise.all([
        carregarResumoContaCorrenteProcesso(Number(processoId)),
        listarLancamentosFinanceiro({ processoId: Number(processoId) }),
      ]);
      const creditos = (lancs || []).filter((l) => l.natureza === 'CREDITO').slice(0, 8);
      setFinanceiro({ resumo, creditos });
    } catch {
      setFinanceiro({ resumo: null, creditos: [] });
    }
  }, []);

  const carregarItem = useCallback(
    async (item) => {
      if (!item?.importacaoId) return;
      setCarregando(true);
      setErro('');
      setConciliacao(null);
      setSucesso('');
      setPdfUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return '';
      });
      try {
        const full = await obterImportacao(item.importacaoId);
        setItemAtual(full);
        const dados = full.dadosAprovados || full.dadosExtraidos;
        setFormClausula(extracaoParaFormConferencia(dados));
        setDataContrato(dados?.dataContrato || '');
        setObjetoContrato(dados?.objetoContrato || '');
        setRoteamento(
          dados?.temCasoVinculado === false ? 'MENSALISTA' : full.roteamentoTipo || 'HONORARIOS',
        );
        const pid = full.processoId || full.processoSugerido?.processoId;
        setProcessoIdRev(pid ? String(pid) : '');
        setNumeroInternoRev(
          full.processoSugerido?.numeroInterno != null
            ? String(full.processoSugerido.numeroInterno)
            : '',
        );
        if (dados?.percentualProveito && dados?.valorCausaExtraido) {
          const est = (Number(dados.valorCausaExtraido) * Number(dados.percentualProveito)) / 100;
          setExpectativaValor(formatarMoedaCampo(String(est.toFixed(2))));
        } else {
          setExpectativaValor('');
        }
        try {
          const { blob } = await obterPdfImportacao(full.importacaoId);
          setPdfUrl(URL.createObjectURL(blob));
        } catch {
          /* PDF temp pode não existir em itens antigos */
        }
        await carregarFinanceiro(pid, full.codigoCliente);
      } catch (e) {
        setErro(e?.message || 'Falha ao carregar item.');
      } finally {
        setCarregando(false);
      }
    },
    [carregarFinanceiro],
  );

  useEffect(() => {
    if (itemVisivel?.importacaoId) void carregarItem(itemVisivel);
  }, [itemVisivel?.importacaoId, carregarItem]);

  useEffect(
    () => () => {
      if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    },
    [pdfUrl],
  );

  const dadosRevisaoApi = useMemo(() => {
    const clausula3 = clausula3FormParaApi(formClausula);
    return {
      tipoRemuneracao: clausula3.tipoRemuneracao,
      percentualProveito: clausula3.percentualProveito,
      valorFixo: clausula3.valorFixo,
      temParcelamento: clausula3.temParcelamento,
      gerarRecebiveis: true,
      quantidadeParcelas: clausula3.quantidadeParcelas,
      valorTotalParcelas: clausula3.valorTotalParcelas,
      primeiroVencimento: clausula3.primeiroVencimento,
      intervaloParcelas: clausula3.intervaloParcelas,
      formaPagamento: clausula3.formaPagamento,
      parcelas: clausula3.parcelas,
      dataContrato: dataContrato || null,
      objetoContrato: objetoContrato || null,
      formaAssinatura: 'duas_vias',
      numeroCnjExtraido: itemAtual?.dadosExtraidos?.numeroCnjExtraido || null,
      partesExtraidas: itemAtual?.dadosExtraidos?.partesExtraidas || null,
      valorCausaExtraido: itemAtual?.dadosExtraidos?.valorCausaExtraido || null,
      temCasoVinculado: roteamento !== 'MENSALISTA',
    };
  }, [formClausula, dataContrato, objetoContrato, roteamento, itemAtual]);

  async function salvarRascunho() {
    if (!itemAtual?.importacaoId) return;
    setCarregando(true);
    setErro('');
    try {
      await salvarRevisaoImportacao(itemAtual.importacaoId, {
        dadosAprovados: dadosRevisaoApi,
        roteamentoTipo: roteamento,
        processoId: processoIdRev ? Number(processoIdRev) : null,
      });
      setSucesso('Rascunho salvo.');
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar.');
    } finally {
      setCarregando(false);
    }
  }

  async function aprovar() {
    if (!itemAtual?.importacaoId) return;
    setCarregando(true);
    setErro('');
    try {
      await salvarRevisaoImportacao(itemAtual.importacaoId, {
        dadosAprovados: dadosRevisaoApi,
        roteamentoTipo: roteamento,
        processoId: processoIdRev ? Number(processoIdRev) : null,
      });
      await aprovarImportacao(itemAtual.importacaoId, {
        roteamentoTipo: roteamento,
        processoId: processoIdRev ? Number(processoIdRev) : null,
        processoStub: {
          codigoCliente: itemAtual.codigoCliente,
          numeroInterno: numeroInternoRev ? Number(numeroInternoRev) : null,
          numeroCnj: itemAtual.dadosExtraidos?.numeroCnjExtraido || null,
          descricao: objetoContrato || 'Contrato importado',
          pessoaId: null,
        },
        dadosAprovados: dadosRevisaoApi,
        forcarAtualizacao,
        expectativaValorEstimado: expectativaValor
          ? Number(expectativaValor.replace(/\./g, '').replace(',', '.'))
          : null,
        expectativaBaseTipo: 'ESTIMATIVA',
        expectativaValorCausaRef: itemAtual.dadosExtraidos?.valorCausaExtraido || null,
      });
      if (roteamento === 'HONORARIOS') {
        const conc = await conciliarRetroativoImportacao(itemAtual.importacaoId);
        setConciliacao(conc);
        setSucesso('Contrato aprovado. Conciliação retroativa analisada.');
      } else {
        setSucesso('Contrato aprovado.');
        avancarProximo();
        await carregarFila();
      }
    } catch (e) {
      setErro(e?.message || 'Falha na aprovação.');
    } finally {
      setCarregando(false);
    }
  }

  async function rejeitar() {
    if (!itemAtual?.importacaoId) return;
    setCarregando(true);
    try {
      await rejeitarImportacao(itemAtual.importacaoId);
      setSucesso('Rejeitado.');
      avancarProximo();
      await carregarFila();
    } catch (e) {
      setErro(e?.message || 'Falha ao rejeitar.');
    } finally {
      setCarregando(false);
    }
  }

  function avancarProximo() {
    setIndice((i) => Math.min(i + 1, Math.max(0, filaVisivel.length - 1)));
  }

  function voltarAnterior() {
    setIndice((i) => Math.max(0, i - 1));
  }

  const qualAtual = itemVisivel
    ? avaliarQualidadeImportacao(dadosRevisaoApi, {
        ...itemAtual,
        codigoCliente: itemAtual?.codigoCliente,
        processoId: processoIdRev ? Number(processoIdRev) : null,
        processoSugerido: itemAtual?.processoSugerido,
      })
    : { alertas: [], bloqueios: [] };

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden p-2 sm:p-3">
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <div className="relative min-w-[140px] flex-1 max-w-xs">
            <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400" />
            <input
              className={`${inputClassConferencia} pl-8`}
              placeholder="Buscar cliente, arquivo, CNJ…"
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value);
                setIndice(0);
              }}
            />
          </div>
          <select
            className={`${inputClassConferencia} w-auto`}
            value={filtroRec}
            onChange={(e) => {
              setFiltroRec(e.target.value);
              setIndice(0);
            }}
          >
            <option value="TODOS">Todos</option>
            <option value="APROVAR">Prontos</option>
            <option value="REVISAR">Revisar</option>
            <option value="BLOQUEADO">Bloqueados</option>
            <option value="REJEITAR">Rejeitar</option>
          </select>
          <button
            type="button"
            className="text-xs text-indigo-700 hover:underline"
            onClick={() => void carregarFila()}
            disabled={carregandoLista}
          >
            {carregandoLista ? 'Atualizando…' : 'Atualizar'}
          </button>
        </div>
        <p className="text-xs text-slate-500">
          {filaVisivel.length} na fila
          {censo ? ` · ${censo.totalAprovados ?? 0} aprovados` : ''}
        </p>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 lg:grid-cols-[220px_1fr]">
        <aside className="flex min-h-0 flex-col rounded-lg border border-slate-200 bg-slate-50">
          <p className="shrink-0 border-b border-slate-200 px-2 py-1.5 text-xs font-semibold uppercase text-slate-500">
            Fila de conferência
          </p>
          <ul className="min-h-0 flex-1 overflow-y-auto text-xs">
            {filaVisivel.map((it, idx) => (
              <li key={it.importacaoId}>
                <button
                  type="button"
                  onClick={() => setIndice(idx)}
                  className={`w-full border-b border-slate-100 px-2 py-2 text-left hover:bg-white ${
                    idx === indice ? 'bg-indigo-50 ring-1 ring-inset ring-indigo-200' : ''
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <span className="font-mono text-[10px] text-slate-500">#{it.importacaoId}</span>
                    <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${classeRecomendacao(it._rec)}`}>
                      {labelRecomendacao(it._rec)}
                    </span>
                  </div>
                  <p className="truncate font-medium text-slate-800">{it.codigoCliente || '—'}</p>
                  <p className="truncate text-slate-600" title={it.pdfNomeArquivo}>
                    {it.pdfNomeArquivo}
                  </p>
                </button>
              </li>
            ))}
          </ul>
        </aside>

        <div className="flex min-h-0 flex-col gap-2 overflow-hidden">
          {!itemVisivel ? (
            <p className="p-4 text-sm text-slate-500">Nenhum item na fila com os filtros atuais.</p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-semibold text-slate-900">
                    #{itemAtual?.importacaoId ?? itemVisivel.importacaoId} ·{' '}
                    {itemAtual?.codigoCliente ?? itemVisivel.codigoCliente}
                    {numeroInternoRev ? ` · Proc. ${numeroInternoRev}` : ''}
                  </h3>
                  <p className="truncate text-xs text-slate-500">{itemVisivel.pdfNomeArquivo}</p>
                </div>
                <div className="flex items-center gap-1 text-xs">
                  <span className={`rounded px-1.5 py-0.5 font-medium ${badgeConfiancaClasse(itemVisivel._score)}`}>
                    Score {itemVisivel._score}
                  </span>
                  <span className={`rounded px-1.5 py-0.5 font-medium ${classeRecomendacao(itemVisivel._rec)}`}>
                    {labelRecomendacao(itemVisivel._rec)}
                  </span>
                </div>
              </div>

              {(qualAtual.bloqueios.length > 0 || qualAtual.alertas.length > 0) && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-950">
                  {qualAtual.bloqueios.map((b) => (
                    <p key={b}>
                      <AlertTriangle className="mr-1 inline h-3.5 w-3.5" />
                      {b}
                    </p>
                  ))}
                  {qualAtual.alertas.map((a) => (
                    <p key={a} className="text-amber-800">
                      · {a}
                    </p>
                  ))}
                </div>
              )}

              {itemAtual?.conflitoContratoExistente ? (
                <label className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
                  <input
                    type="checkbox"
                    checked={forcarAtualizacao}
                    onChange={(e) => setForcarAtualizacao(e.target.checked)}
                  />
                  Atualizar contrato existente (id {itemAtual.contratoExistenteId})
                </label>
              ) : null}

              <div className="grid min-h-0 flex-1 grid-cols-1 gap-2 xl:grid-cols-2">
                <div className="flex min-h-[240px] flex-col rounded-lg border border-slate-200 bg-slate-50">
                  <p className="shrink-0 border-b border-slate-200 px-2 py-1 text-xs font-bold uppercase text-slate-500">
                    PDF
                  </p>
                  {pdfUrl ? (
                    <iframe title="Preview contrato" src={pdfUrl} className="min-h-0 flex-1 w-full" />
                  ) : (
                    <div className="flex flex-1 flex-col overflow-y-auto p-2">
                      <FileText className="mb-2 h-6 w-6 text-slate-400" />
                      <pre className="whitespace-pre-wrap text-xs text-slate-700">
                        {itemAtual?.clausulaExtraidaTexto || 'Sem preview PDF — veja cláusula abaixo.'}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="flex min-h-0 flex-col gap-2 overflow-y-auto rounded-lg border border-indigo-200 bg-white p-3">
                  <p className="text-xs font-bold uppercase text-indigo-600">Dados para aprovação</p>
                  <div className="grid grid-cols-2 gap-2">
                    <label className="text-xs">
                      Roteamento
                      <select
                        className={inputClassConferencia}
                        value={roteamento}
                        onChange={(e) => setRoteamento(e.target.value)}
                      >
                        <option value="HONORARIOS">Honorários (processo)</option>
                        <option value="MENSALISTA">Mensalista</option>
                      </select>
                    </label>
                    <label className="text-xs">
                      Tipo
                      <select
                        className={inputClassConferencia}
                        value={formClausula.tipoRemuneracao}
                        onChange={(e) =>
                          setFormClausula((f) => ({ ...f, tipoRemuneracao: e.target.value }))
                        }
                      >
                        {TIPOS_REMUNERACAO.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-xs">
                      Data contrato
                      <input
                        type="date"
                        className={inputClassConferencia}
                        value={dataContrato}
                        onChange={(e) => setDataContrato(e.target.value)}
                      />
                    </label>
                    <label className="text-xs">
                      Processo ID
                      <input
                        className={inputClassConferencia}
                        value={processoIdRev}
                        onChange={(e) => setProcessoIdRev(e.target.value)}
                      />
                    </label>
                    <label className="text-xs">
                      Nº interno
                      <input
                        className={inputClassConferencia}
                        value={numeroInternoRev}
                        onChange={(e) => setNumeroInternoRev(e.target.value)}
                      />
                    </label>
                    {formClausula.tipoRemuneracao !== TIPO_REMUNERACAO_PERCENTUAL && (
                      <label className="text-xs">
                        Valor fixo (R$)
                        <input
                          className={inputClassConferencia}
                          value={formClausula.valorFixo}
                          onChange={(e) =>
                            setFormClausula((f) => ({ ...f, valorFixo: e.target.value }))
                          }
                        />
                      </label>
                    )}
                    {(formClausula.tipoRemuneracao === TIPO_REMUNERACAO_PERCENTUAL ||
                      formClausula.tipoRemuneracao === TIPO_REMUNERACAO_MISTO) && (
                      <label className="text-xs">
                        % proveito
                        <input
                          className={inputClassConferencia}
                          value={formClausula.percentualProveito}
                          onChange={(e) =>
                            setFormClausula((f) => ({ ...f, percentualProveito: e.target.value }))
                          }
                        />
                      </label>
                    )}
                  </div>
                  <label className="text-xs">
                    Objeto
                    <textarea
                      className={inputClassConferencia}
                      rows={2}
                      value={objetoContrato}
                      onChange={(e) => setObjetoContrato(e.target.value)}
                    />
                  </label>
                  {!pdfUrl && itemAtual?.clausulaExtraidaTexto ? (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-slate-600">Cláusula extraída</summary>
                      <pre className="mt-1 max-h-32 overflow-y-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-[11px]">
                        {itemAtual.clausulaExtraidaTexto}
                      </pre>
                    </details>
                  ) : null}
                </div>
              </div>

              {processoIdRev ? (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50/50 px-3 py-2">
                  <p className="mb-1 flex items-center gap-1 text-xs font-semibold text-emerald-900">
                    <Wallet className="h-3.5 w-3.5" />
                    Conta corrente do processo {processoIdRev}
                  </p>
                  <p className="text-xs text-emerald-800">
                    Saldo: {formatMoeda(financeiro.resumo?.saldo)} ·{' '}
                    {financeiro.resumo?.totalLancamentos ?? financeiro.creditos.length} lançamento(s)
                  </p>
                  {financeiro.creditos.length > 0 ? (
                    <ul className="mt-1 max-h-24 overflow-y-auto text-[11px] text-emerald-900">
                      {financeiro.creditos.map((l) => (
                        <li key={l.id}>
                          {l.dataLancamento} · {formatMoeda(Math.abs(Number(l.valor)))} ·{' '}
                          {(l.descricao || '').slice(0, 50)}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-[11px] text-emerald-700">Nenhum crédito vinculado ao processo.</p>
                  )}
                </div>
              ) : null}

              {conciliacao ? (
                <div className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm">
                  <p className="flex items-center gap-1 font-semibold text-indigo-900">
                    <Shield className="h-4 w-4" />
                    Conciliação retroativa
                  </p>
                  <p className="text-xs text-indigo-800">
                    Quitadas: {conciliacao.parcelasQuitadas} · Revisar: {conciliacao.parcelasParaRevisar} ·
                    Passivo: {conciliacao.parcelasPassivo}
                  </p>
                  <button
                    type="button"
                    className="mt-2 text-xs text-indigo-700 hover:underline"
                    onClick={() => {
                      setConciliacao(null);
                      avancarProximo();
                      void carregarFila();
                    }}
                  >
                    Próximo contrato
                  </button>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>

      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-slate-200 pt-2">
        <div className="flex gap-1">
          <button
            type="button"
            disabled={indice <= 0 || carregando}
            onClick={voltarAnterior}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" /> Anterior
          </button>
          <button
            type="button"
            disabled={indice >= filaVisivel.length - 1 || carregando}
            onClick={avancarProximo}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-2 py-1.5 text-sm disabled:opacity-40"
          >
            Próximo <ChevronRight className="h-4 w-4" />
          </button>
          <button
            type="button"
            disabled={carregando}
            onClick={() => void salvarRascunho()}
            className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
          >
            Salvar rascunho
          </button>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            disabled={carregando || !itemAtual}
            onClick={() => void rejeitar()}
            className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50"
          >
            <X className="h-4 w-4" /> Rejeitar
          </button>
          <button
            type="button"
            disabled={carregando || !itemAtual || qualAtual.bloqueios.length > 0}
            onClick={() => void aprovar()}
            className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Aprovar
          </button>
          {conciliacao ? (
            <button
              type="button"
              onClick={() => {
                setConciliacao(null);
                avancarProximo();
                void carregarFila();
              }}
              className="inline-flex items-center gap-1 rounded-lg border border-indigo-300 px-3 py-1.5 text-sm text-indigo-800"
            >
              <SkipForward className="h-4 w-4" /> Continuar
            </button>
          ) : null}
        </div>
      </div>

      {erro ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {erro}
        </p>
      ) : null}
      {sucesso ? <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sucesso}</p> : null}

      {onFechar ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={onFechar}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
          >
            Fechar
          </button>
        </div>
      ) : null}
    </div>
  );
}
