import { useEffect, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import { useCloseOnEscape } from '../../../hooks/useCloseOnEscape.js';
import { CLAUSULAS_HOMOLOGACAO_PADRAO } from '../../../data/peticaoHomologacaoAcordoBuilder.js';

const inputClass =
  'w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900';

const labelClass = 'mb-1 block text-sm font-medium text-slate-700 dark:text-slate-300';

export function ModalHomologacaoAcordo({
  open,
  onClose,
  onConfirm,
  loading = false,
  dimensoesAceitas = [],
  dimensaoSelecionada,
  onDimensaoChange,
  enderecamento,
  onEnderecamentoChange,
  data,
  onDataChange,
  resumoCalculo,
  boletos = [],
  initialClausulas,
}) {
  const [clausulas, setClausulas] = useState(CLAUSULAS_HOMOLOGACAO_PADRAO);
  const [erro, setErro] = useState('');

  useCloseOnEscape(open, onClose, { enabled: !loading });

  useEffect(() => {
    if (!open) return;
    setErro('');
    setClausulas({ ...CLAUSULAS_HOMOLOGACAO_PADRAO, ...(initialClausulas || {}) });
  }, [open, initialClausulas]);

  if (!open) return null;

  const handleConfirm = () => {
    setErro('');
    if (!String(enderecamento ?? '').trim()) {
      setErro('Informe o endereçamento.');
      return;
    }
    if (!String(clausulas.formaPagamentoTexto ?? '').trim()) {
      setErro('Informe a forma de pagamento.');
      return;
    }
    onConfirm({ clausulas });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-homologacao-titulo"
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900"
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <h2 id="modal-homologacao-titulo" className="text-lg font-semibold text-slate-900 dark:text-slate-50">
              Homologatória de Acordo
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Revise cláusulas e forma de pagamento antes de visualizar a prévia do PDF.
            </p>
          </div>
          <button
            type="button"
            className="rounded-md p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            onClick={onClose}
            disabled={loading}
            aria-label="Fechar"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {resumoCalculo ? (
          <div className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <div className="flex flex-wrap gap-x-6 gap-y-1 text-slate-700 dark:text-slate-200">
              <span>
                <strong>{resumoCalculo.titulos}</strong> título(s)
              </span>
              <span>
                Total: <strong>{resumoCalculo.total}</strong>
              </span>
              <span>
                Boletos: <strong>{boletos.length}</strong>
              </span>
            </div>
          </div>
        ) : null}

        {dimensaoSelecionada != null && Number.isFinite(Number(dimensaoSelecionada)) ? (
          <p className="mb-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200">
            Dimensão do acordo: <strong>{dimensaoSelecionada}</strong>
            {dimensoesAceitas.length > 1 ? (
              <span className="text-slate-500 dark:text-slate-400"> — última com cálculo aceito</span>
            ) : null}
          </p>
        ) : null}

        <label className="mb-4 block">
          <span className={labelClass}>Endereçamento *</span>
          <textarea
            rows={3}
            className={inputClass}
            value={enderecamento}
            onChange={(e) => onEnderecamentoChange?.(e.target.value)}
            disabled={loading}
          />
        </label>

        <label className="mb-4 block">
          <span className={labelClass}>Data</span>
          <input
            type="text"
            placeholder="dd/mm/aaaa"
            className={inputClass}
            value={data}
            onChange={(e) => onDataChange?.(e.target.value)}
            disabled={loading}
          />
        </label>

        <fieldset className="mb-4 space-y-3 rounded-lg border border-slate-200 p-4 dark:border-slate-700">
          <legend className="px-1 text-sm font-semibold text-slate-800 dark:text-slate-200">Cláusulas do acordo</legend>

          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block text-sm">
              <span className={labelClass}>Multa (%)</span>
              <input
                type="text"
                className={inputClass}
                value={clausulas.multaPercent}
                onChange={(e) => setClausulas((c) => ({ ...c, multaPercent: e.target.value }))}
                disabled={loading}
              />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>Juros (% a.m.)</span>
              <input
                type="text"
                className={inputClass}
                value={clausulas.jurosPercent}
                onChange={(e) => setClausulas((c) => ({ ...c, jurosPercent: e.target.value }))}
                disabled={loading}
              />
            </label>
            <label className="block text-sm">
              <span className={labelClass}>Honorários (%)</span>
              <input
                type="text"
                className={inputClass}
                value={clausulas.honorariosPercent}
                onChange={(e) => setClausulas((c) => ({ ...c, honorariosPercent: e.target.value }))}
                disabled={loading}
              />
            </label>
          </div>

          <label className="block text-sm">
            <span className={labelClass}>Forma de pagamento *</span>
            <textarea
              rows={2}
              className={inputClass}
              value={clausulas.formaPagamentoTexto}
              onChange={(e) => setClausulas((c) => ({ ...c, formaPagamentoTexto: e.target.value }))}
              disabled={loading}
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-2">
            {[
              ['incluirArt1335', 'Art. 1.335, III, CC'],
              ['incluirIrrevogavel', 'Irrevogável / 2 vias'],
              ['incluirDesistenciaRecursos', 'Desistência de recursos (487 III b)'],
              ['incluirCustas90', 'Dispensa custas (art. 90 §3)'],
              ['incluirArt922', 'Aguardar em cartório (art. 922)'],
            ].map(([key, rotulo]) => (
              <label key={key} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                <input
                  type="checkbox"
                  checked={clausulas[key] !== false}
                  onChange={(e) => setClausulas((c) => ({ ...c, [key]: e.target.checked }))}
                  disabled={loading}
                />
                {rotulo}
              </label>
            ))}
          </div>
        </fieldset>

        {boletos.length > 0 ? (
          <div className="mb-4 rounded-lg border border-slate-200 px-4 py-3 text-sm dark:border-slate-700">
            <p className="mb-2 font-medium text-slate-700 dark:text-slate-200">Boletos no texto da peça</p>
            <ul className="space-y-1 text-slate-600 dark:text-slate-400">
              {boletos.map((b, i) => (
                <li key={`${b.vencimento}-${i}`}>
                  {i + 1}º — {b.valorParcela} — venc. {b.vencimento}
                </li>
              ))}
            </ul>
          </div>
        ) : null}

        {erro ? (
          <p className="mb-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {erro}
          </p>
        ) : null}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
            onClick={onClose}
            disabled={loading}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 disabled:opacity-60"
            onClick={handleConfirm}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                Gerando prévia…
              </>
            ) : (
              'Visualizar prévia'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
