import { useState } from 'react';
import { reverterImportacao } from '../../repositories/condominioInadimplenciaRepository.js';

function botaoSecundario() {
  return 'rounded px-3 py-1.5 text-sm font-medium border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 text-slate-800 dark:text-slate-100 hover:bg-slate-50 dark:hover:bg-slate-800';
}

/**
 * Referência da sessão de importação, reversão por DELETE e relatório de contagens.
 * @param {{ importacaoId?: string | null }} props
 */
export function BlocoReversaoImportacao({ importacaoId }) {
  const id = importacaoId && String(importacaoId).trim();
  const [modalOpen, setModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [relatorio, setRelatorio] = useState(null);
  const [revertido, setRevertido] = useState(false);
  const [erroLocal, setErroLocal] = useState(null);

  if (!id) return null;

  const confirmarReversao = async () => {
    setErroLocal(null);
    setLoading(true);
    try {
      const data = await reverterImportacao(id);
      setRelatorio(data);
      setRevertido(true);
      setModalOpen(false);
    } catch (e) {
      setErroLocal(e?.message || String(e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-4 border-t border-slate-200 pt-4 dark:border-slate-700 space-y-3">
      <p className="break-all text-xs text-slate-500 dark:text-slate-400">
        <span className="font-medium text-slate-600 dark:text-slate-500">Importação (referência / log):</span>{' '}
        <span className="font-mono">{id}</span>
      </p>

      {!revertido && (
        <button
          type="button"
          className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
          disabled={loading}
          onClick={() => {
            setErroLocal(null);
            setModalOpen(true);
          }}
        >
          Reverter esta importação
        </button>
      )}

      {revertido && (
        <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">Importação revertida com sucesso</p>
      )}

      {erroLocal && <p className="text-sm text-red-700 dark:text-red-300">{erroLocal}</p>}

      {relatorio && (
        <div className="space-y-1 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900/80">
          <p className="font-medium text-slate-800 dark:text-slate-200">Relatório da reversão</p>
          <ul className="space-y-0.5 text-slate-700 dark:text-slate-300">
            <li>
              Andamentos removidos: <strong>{relatorio.andamentosRemovidos ?? 0}</strong>
            </li>
            <li>
              Cálculos removidos: <strong>{relatorio.calculosRemovidos ?? 0}</strong>
            </li>
            <li>
              Partes removidas: <strong>{relatorio.partesRemovidas ?? 0}</strong>
            </li>
            <li>
              Processos removidos: <strong>{relatorio.processosRemovidos ?? 0}</strong>
            </li>
            <li>
              Contatos removidos: <strong>{relatorio.contatosRemovidos ?? 0}</strong>
            </li>
            <li>
              Endereços removidos: <strong>{relatorio.enderecosRemovidos ?? 0}</strong>
            </li>
            <li>
              Pessoas removidas: <strong>{relatorio.pessoasRemovidas ?? 0}</strong>
            </li>
          </ul>
        </div>
      )}

      {modalOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="reversao-importacao-titulo"
        >
          <div className="w-full max-w-md space-y-4 rounded-lg border border-slate-200 bg-white p-4 shadow-lg dark:border-slate-700 dark:bg-slate-900">
            <p id="reversao-importacao-titulo" className="text-sm text-slate-800 dark:text-slate-100">
              Serão apagados todos os registros gravados com este <span className="font-mono text-xs">importacaoId</span>
              : processos, cálculos, partes, pessoas novas, contatos e endereços criados na importação de débitos e na
              planilha (sessão unificada). Deseja continuar?
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button
                type="button"
                className={botaoSecundario()}
                disabled={loading}
                onClick={() => setModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:pointer-events-none disabled:opacity-50"
                disabled={loading}
                onClick={() => void confirmarReversao()}
              >
                {loading ? 'A reverter…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
