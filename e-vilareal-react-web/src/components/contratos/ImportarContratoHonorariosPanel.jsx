import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Check,
  ChevronLeft,
  FileText,
  Loader2,
  Shield,
  Upload,
  X,
} from 'lucide-react';
import {
  TIPOS_REMUNERACAO,
  TIPO_REMUNERACAO_PERCENTUAL,
  TIPO_REMUNERACAO_VALOR_FIXO,
  TIPO_REMUNERACAO_MISTO,
  clausula3DadosParaForm,
  clausula3FormParaApi,
  estadoInicialClausula3,
  formatarMoedaCampo,
} from '../../pages/documentos/contratoHonorariosClausula3.js';
import {
  aprovarImportacao,
  conciliarRetroativoImportacao,
  listarFilaImportacao,
  obterImportacao,
  rejeitarImportacao,
  salvarRevisaoImportacao,
  uploadLoteImportacao,
} from '../../repositories/contratosHonorariosImportacaoRepository.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

function badgeConfianca(score) {
  const n = Number(score ?? 0);
  if (n >= 70) return 'bg-emerald-100 text-emerald-800';
  if (n >= 40) return 'bg-amber-100 text-amber-900';
  return 'bg-red-100 text-red-800';
}

function extracaoParaForm(dados) {
  if (!dados) return estadoInicialClausula3();
  return clausula3DadosParaForm(
    {
      tipoRemuneracao: dados.tipoRemuneracao || TIPO_REMUNERACAO_PERCENTUAL,
      percentualProveito: dados.percentualProveito,
      valorFixo: dados.valorFixo,
      temParcelamento: dados.temParcelamento !== false,
      gerarRecebiveis: dados.gerarRecebiveis !== false,
      quantidadeParcelas: dados.quantidadeParcelas,
      valorTotalParcelas: dados.valorTotalParcelas,
      primeiroVencimento: dados.primeiroVencimento,
      intervaloParcelas: dados.intervaloParcelas || 'MENSAL',
      formaPagamento: dados.formaPagamento || 'PIX',
      parcelas: dados.parcelas || [],
    },
    dados.dataContrato,
  );
}

/**
 * Painel de importação de contratos celebrados: upload → fila → revisão → aprovação.
 */
export function ImportarContratoHonorariosPanel({
  codigoCliente,
  processoId,
  onFechar,
}) {
  const [etapa, setEtapa] = useState('upload');
  const [arquivos, setArquivos] = useState([]);
  const [loteId, setLoteId] = useState('');
  const [fila, setFila] = useState([]);
  const [itemAtual, setItemAtual] = useState(null);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState('');
  const [sucesso, setSucesso] = useState('');
  const [conciliacao, setConciliacao] = useState(null);

  const [roteamento, setRoteamento] = useState('HONORARIOS');
  const [formClausula, setFormClausula] = useState(estadoInicialClausula3());
  const [dataContrato, setDataContrato] = useState('');
  const [objetoContrato, setObjetoContrato] = useState('');
  const [processoIdRev, setProcessoIdRev] = useState(processoId ? String(processoId) : '');
  const [expectativaValor, setExpectativaValor] = useState('');
  const [forcarAtualizacao, setForcarAtualizacao] = useState(false);

  const carregarFila = useCallback(async () => {
    const res = await listarFilaImportacao({
      importacaoLoteId: loteId || undefined,
      codigoCliente: codigoCliente || undefined,
      size: 50,
    });
    const itens = res?.content ?? res ?? [];
    setFila(Array.isArray(itens) ? itens : []);
  }, [loteId, codigoCliente]);

  useEffect(() => {
    if (etapa === 'fila' && loteId) {
      const t = window.setInterval(() => void carregarFila(), 8000);
      return () => window.clearInterval(t);
    }
    return undefined;
  }, [etapa, loteId, carregarFila]);

  async function enviarLote() {
    if (!arquivos.length) {
      setErro('Selecione ao menos um PDF.');
      return;
    }
    setCarregando(true);
    setErro('');
    try {
      const res = await uploadLoteImportacao({
        arquivos,
        codigoCliente: codigoCliente || undefined,
        processoId: processoId ? Number(processoId) : undefined,
      });
      setLoteId(res.importacaoLoteId);
      setFila(res.itens || []);
      setEtapa('fila');
      setSucesso(`${res.totalEnfileirados} PDF(s) enfileirado(s). Extração em andamento…`);
    } catch (e) {
      setErro(e?.message || 'Falha no upload.');
    } finally {
      setCarregando(false);
    }
  }

  async function abrirRevisao(item) {
    setCarregando(true);
    setErro('');
    try {
      const full = await obterImportacao(item.importacaoId);
      setItemAtual(full);
      const dados = full.dadosAprovados || full.dadosExtraidos;
      setFormClausula(extracaoParaForm(dados));
      setDataContrato(dados?.dataContrato || '');
      setObjetoContrato(dados?.objetoContrato || '');
      setRoteamento(
        dados?.temCasoVinculado === false ? 'MENSALISTA' : full.roteamentoTipo || 'HONORARIOS',
      );
      setProcessoIdRev(
        full.processoId ? String(full.processoId) : processoId ? String(processoId) : '',
      );
      if (dados?.percentualProveito && dados?.valorCausaExtraido) {
        const est =
          (Number(dados.valorCausaExtraido) * Number(dados.percentualProveito)) / 100;
        setExpectativaValor(formatarMoedaCampo(String(est.toFixed(2))));
      }
      setConciliacao(null);
      setEtapa('revisao');
    } catch (e) {
      setErro(e?.message || 'Falha ao carregar item.');
    } finally {
      setCarregando(false);
    }
  }

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
      const res = await aprovarImportacao(itemAtual.importacaoId, {
        roteamentoTipo: roteamento,
        processoId: processoIdRev ? Number(processoIdRev) : null,
        processoStub: {
          codigoCliente: codigoCliente || itemAtual.codigoCliente,
          numeroInterno: null,
          numeroCnj: itemAtual.dadosExtraidos?.numeroCnjExtraido || null,
          descricao: objetoContrato || 'Contrato importado',
          pessoaId: null,
        },
        dadosAprovados: dadosRevisaoApi,
        forcarAtualizacao,
        expectativaValorEstimado: expectativaValor ? Number(expectativaValor.replace(/\./g, '').replace(',', '.')) : null,
        expectativaBaseTipo: 'ESTIMATIVA',
        expectativaValorCausaRef: itemAtual.dadosExtraidos?.valorCausaExtraido || null,
      });
      setItemAtual(res);
      setSucesso('Contrato importado e integrado ao organismo vivo.');
      if (roteamento === 'HONORARIOS') {
        const conc = await conciliarRetroativoImportacao(itemAtual.importacaoId);
        setConciliacao(conc);
        setEtapa('conciliacao');
      } else {
        setEtapa('fila');
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
      setEtapa('fila');
      await carregarFila();
      setSucesso('Importação rejeitada.');
    } catch (e) {
      setErro(e?.message || 'Falha ao rejeitar.');
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden p-3 sm:p-4">
      {etapa === 'upload' ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            Envie PDFs de contratos já celebrados. A extração IA enfileira para revisão — nada é
            aprovado automaticamente.
          </p>
          <label className="flex cursor-pointer flex-col items-center gap-2 rounded-xl border-2 border-dashed border-indigo-300 bg-indigo-50/50 px-4 py-8 text-center hover:bg-indigo-50">
            <Upload className="h-8 w-8 text-indigo-600" aria-hidden />
            <span className="text-sm font-medium text-indigo-900">Selecionar PDFs (lote)</span>
            <input
              type="file"
              accept="application/pdf,.pdf"
              multiple
              className="sr-only"
              onChange={(e) => setArquivos(Array.from(e.target.files || []))}
            />
          </label>
          {arquivos.length ? (
            <p className="text-xs text-slate-600">{arquivos.length} arquivo(s) selecionado(s)</p>
          ) : null}
          <button
            type="button"
            disabled={carregando || !arquivos.length}
            onClick={() => void enviarLote()}
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            Enviar lote
          </button>
        </div>
      ) : null}

      {etapa === 'fila' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <div className="flex items-center justify-between gap-2">
            <button
              type="button"
              className="text-sm text-indigo-700 hover:underline"
              onClick={() => setEtapa('upload')}
            >
              + Novo lote
            </button>
            <button type="button" className="text-sm text-slate-600" onClick={() => void carregarFila()}>
              Atualizar fila
            </button>
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto rounded-lg border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead className="sticky top-0 bg-slate-100 text-xs uppercase text-slate-600">
                <tr>
                  <th className="px-2 py-2">Arquivo</th>
                  <th className="px-2 py-2">Status</th>
                  <th className="px-2 py-2">Conf.</th>
                  <th className="px-2 py-2" />
                </tr>
              </thead>
              <tbody>
                {fila.map((it) => (
                  <tr key={it.importacaoId} className="border-t border-slate-100">
                    <td className="max-w-[200px] truncate px-2 py-2" title={it.pdfNomeArquivo}>
                      {it.pdfNomeArquivo}
                    </td>
                    <td className="px-2 py-2">{it.status}</td>
                    <td className="px-2 py-2">
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-medium ${badgeConfianca(it.scoreConfianca)}`}
                      >
                        {it.scoreConfianca ?? '—'}%
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right">
                      {['EXTRAIDO', 'EM_REVISAO'].includes(it.status) ? (
                        <button
                          type="button"
                          className="text-indigo-700 hover:underline"
                          onClick={() => void abrirRevisao(it)}
                        >
                          Revisar
                        </button>
                      ) : null}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}

      {etapa === 'revisao' && itemAtual ? (
        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
          <button
            type="button"
            className="inline-flex items-center gap-1 text-sm text-slate-600"
            onClick={() => setEtapa('fila')}
          >
            <ChevronLeft className="h-4 w-4" /> Voltar à fila
          </button>
          {itemAtual.conflitoContratoExistente ? (
            <div className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <AlertTriangle className="mr-1 inline h-4 w-4" />
              Processo já tem contrato (id {itemAtual.contratoExistenteId}). Marque forçar atualização
              para substituir (não altera parcelas pagas).
              <label className="mt-2 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={forcarAtualizacao}
                  onChange={(e) => setForcarAtualizacao(e.target.checked)}
                />
                Atualizar contrato existente
              </label>
            </div>
          ) : null}
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <h3 className="mb-2 text-xs font-bold uppercase text-slate-500">Cláusula extraída</h3>
              <pre className="max-h-[420px] overflow-y-auto whitespace-pre-wrap text-xs text-slate-800">
                {itemAtual.clausulaExtraidaTexto || '—'}
              </pre>
            </div>
            <div className="space-y-3 rounded-lg border border-indigo-200 bg-white p-3">
              <h3 className="text-xs font-bold uppercase text-indigo-600">Interpretação (editável)</h3>
              <label className="block text-sm">
                Roteamento
                <select
                  className={inputClass}
                  value={roteamento}
                  onChange={(e) => setRoteamento(e.target.value)}
                >
                  <option value="HONORARIOS">Honorários (processo)</option>
                  <option value="MENSALISTA">Mensalista (sem caso)</option>
                </select>
              </label>
              <label className="block text-sm">
                Tipo remuneração
                <select
                  className={inputClass}
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
              <div className="grid grid-cols-2 gap-2">
                <label className="text-sm">
                  Data contrato
                  <input
                    type="date"
                    className={inputClass}
                    value={dataContrato}
                    onChange={(e) => setDataContrato(e.target.value)}
                  />
                </label>
                <label className="text-sm">
                  Processo ID
                  <input
                    className={inputClass}
                    value={processoIdRev}
                    onChange={(e) => setProcessoIdRev(e.target.value)}
                    placeholder="ID API ou stub"
                  />
                </label>
              </div>
              {(formClausula.tipoRemuneracao === TIPO_REMUNERACAO_PERCENTUAL ||
                formClausula.tipoRemuneracao === TIPO_REMUNERACAO_MISTO) && (
                <label className="text-sm">
                  Expectativa estimada (R$)
                  <input
                    className={inputClass}
                    value={expectativaValor}
                    onChange={(e) => setExpectativaValor(e.target.value)}
                    placeholder="Carteira contingente"
                  />
                </label>
              )}
              {formClausula.tipoRemuneracao !== TIPO_REMUNERACAO_PERCENTUAL && (
                <label className="text-sm">
                  Valor fixo / mensal (R$)
                  <input
                    className={inputClass}
                    value={formClausula.valorFixo}
                    onChange={(e) =>
                      setFormClausula((f) => ({ ...f, valorFixo: e.target.value }))
                    }
                  />
                </label>
              )}
              {(formClausula.tipoRemuneracao === TIPO_REMUNERACAO_PERCENTUAL ||
                formClausula.tipoRemuneracao === TIPO_REMUNERACAO_MISTO) && (
                <label className="text-sm">
                  % proveito
                  <input
                    className={inputClass}
                    value={formClausula.percentualProveito}
                    onChange={(e) =>
                      setFormClausula((f) => ({ ...f, percentualProveito: e.target.value }))
                    }
                  />
                </label>
              )}
              <label className="text-sm">
                Objeto
                <textarea
                  className={inputClass}
                  rows={2}
                  value={objetoContrato}
                  onChange={(e) => setObjetoContrato(e.target.value)}
                />
              </label>
              <div className="flex flex-wrap gap-2 pt-2">
                <button
                  type="button"
                  disabled={carregando}
                  onClick={() => void aprovar()}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50"
                >
                  {carregando ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  Aprovar importação
                </button>
                <button
                  type="button"
                  disabled={carregando}
                  onClick={() => void rejeitar()}
                  className="inline-flex items-center gap-1 rounded-lg border border-red-300 px-3 py-2 text-sm text-red-700 hover:bg-red-50"
                >
                  <X className="h-4 w-4" /> Rejeitar
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {etapa === 'conciliacao' && conciliacao ? (
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-800">
            <Shield className="h-4 w-4 text-indigo-600" />
            Conciliação retroativa (somente sugestões — sem auto-commit)
          </h3>
          <div className="grid grid-cols-3 gap-2 text-center text-sm">
            <div className="rounded-lg bg-emerald-50 p-2">
              <p className="text-xs text-emerald-700">Quitadas</p>
              <p className="font-bold">{conciliacao.parcelasQuitadas}</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-2">
              <p className="text-xs text-amber-800">Para revisar</p>
              <p className="font-bold">{conciliacao.parcelasParaRevisar}</p>
            </div>
            <div className="rounded-lg bg-red-50 p-2">
              <p className="text-xs text-red-800">Passivo</p>
              <p className="font-bold">{conciliacao.parcelasPassivo}</p>
              <p className="text-xs">R$ {conciliacao.valorPassivo}</p>
            </div>
          </div>
          {!conciliacao.extratoCoberto ? (
            <p className="text-sm text-amber-800">
              Extrato não cobre o período — importe no Financeiro antes de confiar na conciliação.
            </p>
          ) : null}
          <button
            type="button"
            className="text-sm text-indigo-700 hover:underline"
            onClick={() => {
              setEtapa('fila');
              void carregarFila();
            }}
          >
            Voltar à fila
          </button>
        </div>
      ) : null}

      {erro ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">
          {erro}
        </p>
      ) : null}
      {sucesso ? (
        <p className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800">{sucesso}</p>
      ) : null}

      {onFechar ? (
        <div className="mt-auto flex justify-end border-t border-slate-200 pt-2">
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
