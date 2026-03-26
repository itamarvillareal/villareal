import { useMemo, useState, useEffect } from 'react';
import { Search, X, Link2 } from 'lucide-react';
import { buscarParesClienteProcPorTexto } from '../data/buscaClienteProcFinanceiro';

/**
 * Modal para pesquisar cliente + processo por nome, réu, autor ou nº (histórico local)
 * e aplicar cod. cliente / proc. no lançamento do Financeiro sem sair da tela.
 */
export function ModalVinculoClienteProcFinanceiro({ aberto, onFechar, resumoLancamento, onAplicar }) {
  const [termo, setTermo] = useState('');

  useEffect(() => {
    if (aberto) setTermo('');
  }, [aberto]);

  const resultados = useMemo(() => buscarParesClienteProcPorTexto(termo, { maxResults: 150 }), [termo]);

  if (!aberto) return null;

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
            <h2 id="modal-vinculo-financeiro-titulo" className="text-base font-bold text-slate-800 flex items-center gap-2">
              <Link2 className="w-5 h-5 text-indigo-600 shrink-0" aria-hidden />
              Vincular cliente e processo
            </h2>
            <p className="text-xs text-slate-600 mt-1">
              Pesquise pelo <strong>nome do cliente</strong>, <strong>CPF/CNPJ</strong>, <strong>autor</strong>,{' '}
              <strong>réu</strong>, tipo de ação ou trecho do <strong>nº do processo</strong>. Depois clique na linha
              para gravar <strong>Cod. cliente</strong> e <strong>Proc.</strong> neste lançamento — sem abrir o cadastro.
            </p>
            {resumoLancamento ? (
              <p className="text-xs text-indigo-900 bg-indigo-50 border border-indigo-100 rounded px-2 py-1 mt-2">
                {resumoLancamento}
              </p>
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
          ) : resultados.length === 0 ? (
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
                  {resultados.map((r, idx) => (
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
