import { useCallback, useEffect, useState } from 'react';
import { Loader2, Settings2, X } from 'lucide-react';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { montarClausula3TextoContratoHonorarios } from '../../../repositories/documentosRepository.js';
import {
  FORMAS_PAGAMENTO_HONORARIOS,
  FORMA_PAGAMENTO_PIX,
  PIX_CNPJ_ESCRITORIO,
  TIPO_REMUNERACAO_MISTO,
  TIPO_REMUNERACAO_PERCENTUAL,
  TIPO_REMUNERACAO_VALOR_FIXO,
  TIPOS_REMUNERACAO,
  INTERVALO_PARCELA_MENSAL,
  INTERVALO_PARCELA_UNICA,
  clausula3FormParaApi,
  estadoInicialClausula3,
  formatarMoedaCampo,
  mostraDataPagamento,
  parseMoedaBR,
  parcelamentoAtivo,
  recalcularParcelasForm,
  resolverParcelasForm,
  atualizarParcelaForm,
  valorParcelavelSugerido,
} from '../contratoHonorariosClausula3.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

const inputTabelaClass =
  'w-full min-w-[7rem] rounded-md border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-900';

export function ContratoHonorariosClausula3Modal({
  open,
  onClose,
  initialForm,
  processoApiId,
  pessoaId,
  onApply,
}) {
  const [form, setForm] = useState(estadoInicialClausula3);
  const [preview, setPreview] = useState('');
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState('');

  useCloseOnEscape(open, onClose, { enabled: !carregandoPreview });

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(
      initialForm
        ? (() => {
            const base = {
              ...estadoInicialClausula3(),
              ...initialForm,
              valorFixo: initialForm.valorFixo ? formatarMoedaCampo(initialForm.valorFixo) : '',
              valorTotalParcelas: initialForm.valorTotalParcelas
                ? formatarMoedaCampo(initialForm.valorTotalParcelas)
                : '',
              parcelas: Array.isArray(initialForm.parcelas) ? initialForm.parcelas : [],
            };
            if (parcelamentoAtivo(base) && base.parcelas.length === 0) {
              return recalcularParcelasForm(base);
            }
            return base;
          })()
        : estadoInicialClausula3(),
    );
  }, [open, initialForm]);

  const atualizarPreview = useCallback(async (formAtual) => {
    setCarregandoPreview(true);
    setErro('');
    try {
      const dados = clausula3FormParaApi(formAtual);
      const resp = await montarClausula3TextoContratoHonorarios(dados, { pessoaId });
      setPreview(resp?.texto || '');
    } catch (e) {
      setErro(e?.message || 'Falha ao montar texto da cláusula.');
      setPreview('');
    } finally {
      setCarregandoPreview(false);
    }
  }, [pessoaId]);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      void atualizarPreview(form);
    }, 350);
    return () => window.clearTimeout(t);
  }, [open, form, atualizarPreview]);

  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  const patchParcelamento = (p) => {
    setForm((f) => {
      const next = { ...f, ...p };
      if (parcelamentoAtivo(next)) {
        return recalcularParcelasForm(next);
      }
      return next;
    });
  };

  const patchParcela = (indice, patchParc) => {
    setForm((f) => atualizarParcelaForm(f, indice, patchParc));
  };

  const handleToggleParcelamento = (checked) => {
    const next = { ...form, temParcelamento: checked };
    if (checked && !next.valorTotalParcelas) {
      const sugerido = valorParcelavelSugerido(form);
      if (sugerido) next.valorTotalParcelas = formatarMoedaCampo(sugerido);
    }
    if (checked && Number(next.quantidadeParcelas) < 2) {
      next.quantidadeParcelas = '2';
    }
    setForm(recalcularParcelasForm(next));
  };

  const handleToggleRecebiveis = (checked) => {
    setForm((f) => {
      const next = { ...f, gerarRecebiveis: checked };
      if (checked && parcelamentoAtivo(f)) {
        if (!f.valorTotalParcelas) {
          next.valorTotalParcelas =
            formatarMoedaCampo(valorParcelavelSugerido(f)) || f.valorTotalParcelas;
        }
        return recalcularParcelasForm(next);
      }
      return next;
    });
  };

  const validar = () => {
    if (form.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO || form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO) {
      const v = parseMoedaBR(form.valorFixo);
      if (v == null || v <= 0) {
        return 'Informe o valor fixo dos honorários.';
      }
    }
    if (form.tipoRemuneracao !== TIPO_REMUNERACAO_VALOR_FIXO) {
      const p = Number(String(form.percentualProveito).replace(',', '.'));
      if (!Number.isFinite(p) || p <= 0) {
        return 'Informe o percentual sobre o proveito econômico.';
      }
    }
    if (mostraDataPagamento(form) && !form.primeiroVencimento) {
      return 'Informe a data do pagamento.';
    }
    if (parcelamentoAtivo(form)) {
      const total = parseMoedaBR(form.valorTotalParcelas) ?? parseMoedaBR(form.valorFixo);
      const qtd = Number(form.quantidadeParcelas);
      if (total == null || total <= 0) {
        return 'Informe o valor total a parcelar.';
      }
      if (!Number.isFinite(qtd) || qtd <= 0) {
        return 'Informe a quantidade de parcelas.';
      }
      if (!form.primeiroVencimento) {
        return 'Informe o vencimento da primeira parcela.';
      }
    }
    if (form.gerarRecebiveis) {
      if (!processoApiId) {
        return 'Para gerar recebíveis, abra a tela a partir de um processo (conta corrente).';
      }
      if (!parcelamentoAtivo(form) && mostraDataPagamento(form)) {
        const v = parseMoedaBR(form.valorFixo);
        if (v == null || v <= 0) {
          return 'Informe o valor fixo para gerar recebíveis.';
        }
        if (!form.primeiroVencimento) {
          return 'Informe a data do pagamento.';
        }
      } else if (!parcelamentoAtivo(form)) {
        return 'Configure valor fixo com data de pagamento ou parcelamento para gerar recebíveis.';
      }
    }
    return '';
  };

  const handleApply = async () => {
    const msg = validar();
    if (msg) {
      setErro(msg);
      return;
    }
    const dados = clausula3FormParaApi(form);
    setSalvando(true);
    setErro('');
    try {
      const ok = await onApply({ form: { ...form }, dados, texto: preview });
      if (ok !== false) onClose();
    } catch (e) {
      setErro(e?.message || 'Falha ao salvar contratação.');
    } finally {
      setSalvando(false);
    }
  };

  if (!open) return null;

  const mostraPercentual =
    form.tipoRemuneracao === TIPO_REMUNERACAO_PERCENTUAL || form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO;
  const mostraValorFixo =
    form.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO || form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO;
  const parcelasPreview = resolverParcelasForm(form);
  const podeGerarRecebiveisFinanceiro =
    Boolean(processoApiId) && (parcelamentoAtivo(form) || mostraDataPagamento(form));

  function valorParcelaExibicao(parcela, idx) {
    const custom = form.parcelas?.[idx]?.valorDisplay;
    if (custom != null && String(custom).trim() !== '') return custom;
    return formatarMoedaCampo(parcela.valor);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-clausula3-titulo"
        className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4 dark:border-slate-700">
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-indigo-600" aria-hidden />
            <h2 id="modal-clausula3-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Cláusula 3ª — Remuneração e parcelamento
            </h2>
          </div>
          <button
            type="button"
            className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="flex-1 space-y-4 overflow-y-auto px-5 py-4">
          {!processoApiId ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-100">
              Sem processo vinculado: o contrato será gerado, mas recebíveis no financeiro exigem abrir pelo processo.
            </div>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 block font-medium">Tipo de remuneração</span>
            <select
              className={inputClass}
              value={form.tipoRemuneracao}
              onChange={(e) => patch({ tipoRemuneracao: e.target.value })}
            >
              {TIPOS_REMUNERACAO.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
          </label>

          <div className="grid gap-3 sm:grid-cols-2">
            {mostraPercentual ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Percentual (%)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  value={form.percentualProveito}
                  onChange={(e) => patch({ percentualProveito: e.target.value })}
                  placeholder="35"
                />
              </label>
            ) : null}
            {mostraValorFixo ? (
              <label className="block text-sm">
                <span className="mb-1 block font-medium">Valor fixo (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  className={inputClass}
                  value={form.valorFixo}
                  onChange={(e) => patch({ valorFixo: e.target.value })}
                  onBlur={(e) => patch({ valorFixo: formatarMoedaCampo(e.target.value) })}
                  placeholder="0,00"
                />
              </label>
            ) : null}
          </div>

          <fieldset className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <legend className="px-1 text-sm font-medium">Forma de pagamento</legend>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              {FORMAS_PAGAMENTO_HONORARIOS.map((f) => (
                <label
                  key={f.id}
                  className={`flex cursor-pointer gap-3 rounded-lg border px-3 py-2.5 text-sm transition-colors ${
                    form.formaPagamento === f.id
                      ? 'border-indigo-400 bg-indigo-50 dark:border-indigo-700 dark:bg-indigo-950/40'
                      : 'border-slate-200 hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <input
                    type="radio"
                    name="formaPagamentoClausula3"
                    className="mt-0.5"
                    checked={form.formaPagamento === f.id}
                    onChange={() => patch({ formaPagamento: f.id })}
                  />
                  <span>
                    <span className="block font-medium">{f.label}</span>
                    <span className="text-slate-600 dark:text-slate-400">{f.descricao}</span>
                  </span>
                </label>
              ))}
            </div>
            {form.formaPagamento === FORMA_PAGAMENTO_PIX ? (
              <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                O contrato incluirá pagamento via PIX — CNPJ {PIX_CNPJ_ESCRITORIO}.
              </p>
            ) : null}
            {mostraDataPagamento(form) ? (
              <label className="mt-3 block text-sm">
                <span className="mb-1 block font-medium">Data do pagamento</span>
                <input
                  type="date"
                  className={inputClass}
                  value={form.primeiroVencimento}
                  onChange={(e) => patch({ primeiroVencimento: e.target.value })}
                />
              </label>
            ) : null}
          </fieldset>

          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.temParcelamento}
                onChange={(e) => handleToggleParcelamento(e.target.checked)}
              />
              <span>
                <span className="block font-medium">Parcelar valores no contrato</span>
                <span className="text-slate-600 dark:text-slate-400">
                  Divide o valor fixo/entrada em parcelas com vencimentos — o texto entra na Cláusula 3ª.
                </span>
              </span>
            </label>

            {parcelamentoAtivo(form) ? (
              <div className="mt-4 space-y-4">
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-sm sm:col-span-2">
                    <span className="mb-1 block font-medium">Valor total a parcelar (R$)</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      className={inputClass}
                      value={form.valorTotalParcelas}
                      onChange={(e) => patchParcelamento({ valorTotalParcelas: e.target.value })}
                      onBlur={(e) =>
                        patchParcelamento({ valorTotalParcelas: formatarMoedaCampo(e.target.value) })
                      }
                      placeholder={formatarMoedaCampo(valorParcelavelSugerido(form)) || '0,00'}
                    />
                    {mostraValorFixo && form.valorFixo ? (
                      <span className="mt-1 block text-xs text-slate-500">
                        Sugestão: usar o valor fixo informado ({formatarMoedaCampo(form.valorFixo)}).
                      </span>
                    ) : null}
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Quantidade de parcelas</span>
                    <input
                      type="number"
                      min={1}
                      className={inputClass}
                      value={form.quantidadeParcelas}
                      onChange={(e) => patchParcelamento({ quantidadeParcelas: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Primeiro vencimento</span>
                    <input
                      type="date"
                      className={inputClass}
                      value={form.primeiroVencimento}
                      onChange={(e) => patchParcelamento({ primeiroVencimento: e.target.value })}
                    />
                  </label>
                  <label className="block text-sm">
                    <span className="mb-1 block font-medium">Intervalo</span>
                    <select
                      className={inputClass}
                      value={form.intervaloParcelas}
                      onChange={(e) => patchParcelamento({ intervaloParcelas: e.target.value })}
                    >
                      <option value={INTERVALO_PARCELA_MENSAL}>Mensal</option>
                      <option value={INTERVALO_PARCELA_UNICA}>Parcela única</option>
                    </select>
                  </label>
                </div>

                {parcelasPreview.length > 0 ? (
                  <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
                    <table className="min-w-full text-left text-sm">
                      <thead className="bg-slate-50 text-slate-600 dark:bg-slate-800/60 dark:text-slate-300">
                        <tr>
                          <th className="px-3 py-2 font-medium">Parcela</th>
                          <th className="px-3 py-2 font-medium">Valor</th>
                          <th className="px-3 py-2 font-medium">Vencimento</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parcelasPreview.map((p, idx) => (
                          <tr key={p.numero} className="border-t border-slate-200 dark:border-slate-700">
                            <td className="px-3 py-2 align-middle">
                              {p.numero}/{parcelasPreview.length}
                            </td>
                            <td className="px-3 py-2 align-middle">
                              <input
                                type="text"
                                inputMode="decimal"
                                className={inputTabelaClass}
                                value={valorParcelaExibicao(p, idx)}
                                onChange={(e) => patchParcela(idx, { valorDisplay: e.target.value })}
                                onBlur={(e) => {
                                  const valor = parseMoedaBR(formatarMoedaCampo(e.target.value));
                                  patchParcela(idx, {
                                    valor: valor != null && valor >= 0 ? valor : p.valor,
                                    valorDisplay: undefined,
                                  });
                                }}
                                aria-label={`Valor da parcela ${p.numero}`}
                              />
                            </td>
                            <td className="px-3 py-2 align-middle">
                              <input
                                type="date"
                                className={inputTabelaClass}
                                value={p.dataVencimento || ''}
                                onChange={(e) =>
                                  patchParcela(idx, { dataVencimento: e.target.value || p.dataVencimento })
                                }
                                aria-label={`Vencimento da parcela ${p.numero}`}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>

          {podeGerarRecebiveisFinanceiro ? (
            <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-slate-200 p-4 text-sm dark:border-slate-700">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.gerarRecebiveis}
                onChange={(e) => handleToggleRecebiveis(e.target.checked)}
              />
              <span>
                <span className="block font-medium">Gerar recebíveis no financeiro do processo</span>
                <span className="text-slate-600 dark:text-slate-400">
                  {parcelamentoAtivo(form)
                    ? 'Cria as parcelas a receber na conta corrente do processo.'
                    : 'Cria o lançamento a receber (pagamento único) na conta corrente do processo.'}
                </span>
              </span>
            </label>
          ) : null}

          <label className="block text-sm">
            <span className="mb-1 flex items-center gap-2 font-medium">
              Texto gerado (Cláusula 3ª)
              {carregandoPreview ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" aria-hidden /> : null}
            </span>
            <textarea
              readOnly
              rows={5}
              className={`${inputClass} bg-slate-50 dark:bg-slate-800/60`}
              value={preview}
            />
          </label>

          {erro ? <p className="text-sm text-red-600">{erro}</p> : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-200 px-5 py-4 dark:border-slate-700">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
            onClick={onClose}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
            onClick={() => void handleApply()}
            disabled={salvando || carregandoPreview}
          >
            {salvando ? (
              <>
                <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden />
                Salvando…
              </>
            ) : (
              'Salvar contratação'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
