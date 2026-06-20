import { useCallback, useEffect, useState } from 'react';
import { Loader2, Settings2, X } from 'lucide-react';
import { useCloseOnEscape } from '../../hooks/useCloseOnEscape.js';
import { montarClausula3TextoContratoHonorarios } from '../../repositories/documentosRepository.js';
import {
  FORMAS_PAGAMENTO_HONORARIOS,
  INTERVALO_PARCELA_MENSAL,
  INTERVALO_PARCELA_UNICA,
  TIPO_REMUNERACAO_MISTO,
  TIPO_REMUNERACAO_PERCENTUAL,
  TIPO_REMUNERACAO_VALOR_FIXO,
  TIPOS_REMUNERACAO,
  clausula3FormParaApi,
  estadoInicialClausula3,
  parcelamentoAtivo,
  valorParcelavelSugerido,
} from './contratoHonorariosClausula3.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

export function ContratoHonorariosClausula3Modal({
  open,
  onClose,
  initialForm,
  processoApiId,
  onApply,
}) {
  const [form, setForm] = useState(estadoInicialClausula3);
  const [preview, setPreview] = useState('');
  const [carregandoPreview, setCarregandoPreview] = useState(false);
  const [erro, setErro] = useState('');

  useCloseOnEscape(open, onClose, { enabled: !carregandoPreview });

  useEffect(() => {
    if (!open) return;
    setErro('');
    setForm(initialForm ? { ...estadoInicialClausula3(), ...initialForm } : estadoInicialClausula3());
  }, [open, initialForm]);

  const atualizarPreview = useCallback(async (formAtual) => {
    setCarregandoPreview(true);
    setErro('');
    try {
      const dados = clausula3FormParaApi(formAtual);
      const resp = await montarClausula3TextoContratoHonorarios(dados);
      setPreview(resp?.texto || '');
    } catch (e) {
      setErro(e?.message || 'Falha ao montar texto da cláusula.');
      setPreview('');
    } finally {
      setCarregandoPreview(false);
    }
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const t = window.setTimeout(() => {
      void atualizarPreview(form);
    }, 350);
    return () => window.clearTimeout(t);
  }, [open, form, atualizarPreview]);

  const patch = (p) => setForm((f) => ({ ...f, ...p }));

  const handleToggleRecebiveis = (checked) => {
    const next = { ...form, gerarRecebiveis: checked };
    if (checked && !next.valorTotalParcelas) {
      const sugerido = valorParcelavelSugerido(form);
      if (sugerido) next.valorTotalParcelas = sugerido;
    }
    if (checked && processoApiId && Number(next.quantidadeParcelas) <= 1) {
      next.quantidadeParcelas = '1';
    }
    setForm(next);
  };

  const validar = () => {
    if (form.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO || form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO) {
      const v = Number(String(form.valorFixo).replace(/\./g, '').replace(',', '.'));
      if (!Number.isFinite(v) || v <= 0) {
        return 'Informe o valor fixo dos honorários.';
      }
    }
    if (form.tipoRemuneracao !== TIPO_REMUNERACAO_VALOR_FIXO) {
      const p = Number(String(form.percentualProveito).replace(',', '.'));
      if (!Number.isFinite(p) || p <= 0) {
        return 'Informe o percentual sobre o proveito econômico.';
      }
    }
    if (parcelamentoAtivo(form)) {
      if (!processoApiId) {
        return 'Para gerar recebíveis, abra a tela a partir de um processo (conta corrente).';
      }
      const total = Number(String(form.valorTotalParcelas).replace(/\./g, '').replace(',', '.'));
      const qtd = Number(form.quantidadeParcelas);
      if (!Number.isFinite(total) || total <= 0) {
        return 'Informe o valor total a parcelar.';
      }
      if (!Number.isFinite(qtd) || qtd <= 0) {
        return 'Informe a quantidade de parcelas.';
      }
      if (!form.primeiroVencimento) {
        return 'Informe o vencimento da primeira parcela.';
      }
    }
    return '';
  };

  const handleApply = () => {
    const msg = validar();
    if (msg) {
      setErro(msg);
      return;
    }
    const dados = clausula3FormParaApi(form);
    onApply({ form: { ...form }, dados, texto: preview });
    onClose();
  };

  if (!open) return null;

  const mostraPercentual =
    form.tipoRemuneracao === TIPO_REMUNERACAO_PERCENTUAL || form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO;
  const mostraValorFixo =
    form.tipoRemuneracao === TIPO_REMUNERACAO_VALOR_FIXO || form.tipoRemuneracao === TIPO_REMUNERACAO_MISTO;

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
                  placeholder="0,00"
                />
              </label>
            ) : null}
          </div>

          <div className="rounded-lg border border-slate-200 p-4 dark:border-slate-700">
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input
                type="checkbox"
                className="mt-1"
                checked={form.gerarRecebiveis}
                onChange={(e) => handleToggleRecebiveis(e.target.checked)}
              />
              <span>
                <span className="block font-medium">Gerar recebíveis no financeiro do processo</span>
                <span className="text-slate-600 dark:text-slate-400">
                  Cria parcelas a receber vinculadas à conta corrente do processo (honorários contratuais).
                </span>
              </span>
            </label>

            {parcelamentoAtivo(form) ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-sm sm:col-span-2">
                  <span className="mb-1 block font-medium">Valor total a parcelar (R$)</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    className={inputClass}
                    value={form.valorTotalParcelas}
                    onChange={(e) => patch({ valorTotalParcelas: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Quantidade de parcelas</span>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={form.quantidadeParcelas}
                    onChange={(e) => patch({ quantidadeParcelas: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Primeiro vencimento</span>
                  <input
                    type="date"
                    className={inputClass}
                    value={form.primeiroVencimento}
                    onChange={(e) => patch({ primeiroVencimento: e.target.value })}
                  />
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Intervalo</span>
                  <select
                    className={inputClass}
                    value={form.intervaloParcelas}
                    onChange={(e) => patch({ intervaloParcelas: e.target.value })}
                  >
                    <option value={INTERVALO_PARCELA_MENSAL}>Mensal</option>
                    <option value={INTERVALO_PARCELA_UNICA}>Parcela única</option>
                  </select>
                </label>
                <label className="block text-sm">
                  <span className="mb-1 block font-medium">Forma de pagamento</span>
                  <select
                    className={inputClass}
                    value={form.formaPagamento}
                    onChange={(e) => patch({ formaPagamento: e.target.value })}
                  >
                    {FORMAS_PAGAMENTO_HONORARIOS.map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>

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
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
            onClick={handleApply}
          >
            Aplicar ao contrato
          </button>
        </div>
      </div>
    </div>
  );
}
