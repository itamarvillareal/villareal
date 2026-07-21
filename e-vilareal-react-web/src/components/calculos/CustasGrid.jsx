import { memo } from 'react';
import { formatarDataBrInput, resolverAliasHojeEmTexto } from '../../services/hjDateAliasService.js';
import { formatBRL, normalizarTextoDataBRparaSalvar, parseBRL } from './calculosTitulosGridUtils.js';

/**
 * Grade da aba Custas Judiciais — somente apresentação e edição via callbacks.
 */
const CustasGrid = memo(function CustasGrid({
  custasPaginaCompletos,
  resumoPagina,
  resumoGeral,
  pagina,
  totalPaginas,
  inicio,
  fim,
  custasTotalLength,
  rodadaCustasLength,
  aceitarPagamento,
  modoAlteracao,
  isLoading,
  onCustasFieldChange,
  onFocusCustasCampo,
  onPaginaAnterior,
  onPaginaProxima,
}) {
  const linhas = Array.isArray(custasPaginaCompletos) ? custasPaginaCompletos : [];
  const resumoPag = resumoPagina ?? {};
  const resumoG = resumoGeral ?? {};

  let linhasComValorNoInicio = 0;
  for (const r of linhas) {
    if (String(r?.valor ?? '').trim() !== '') linhasComValorNoInicio += 1;
    else break;
  }
  const limiteEdicao = Math.max(rodadaCustasLength, inicio + linhasComValorNoInicio);

  const inputCellClass =
    'w-full px-1 py-0.5 max-lg:py-2 max-lg:text-base border border-slate-300 rounded text-sm tabular-nums';
  const stickyColNum =
    'sticky left-0 z-20 bg-inherit shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)] max-lg:shadow-[3px_0_6px_-2px_rgba(15,23,42,0.18)]';
  const stickyColData =
    'sticky left-12 z-20 bg-inherit shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)] max-lg:shadow-[3px_0_6px_-2px_rgba(15,23,42,0.18)]';

  return (
    <>
      <p className="text-xs text-slate-700 mb-2 rounded border border-slate-200 bg-slate-50 px-2 py-1.5 leading-snug">
        Registre aqui os <strong>gastos com custas judiciais</strong> (data de pagamento e valor). A atualização
        monetária e os juros seguem os parâmetros globais da aba <strong>Títulos</strong> —{' '}
        <strong>sem multa e sem honorários</strong> por linha. O total atualizado entra no{' '}
        <strong>valor a pagar</strong> e no <strong>parcelamento</strong>.
      </p>

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm text-slate-600">
          Página {String(pagina).padStart(2, '0')} — Linhas {inicio + 1} a {Math.min(fim, custasTotalLength)} (de{' '}
          {custasTotalLength})
          {isLoading ? ' — carregando…' : ''}
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            disabled={isLoading || pagina <= 1}
            onClick={onPaginaAnterior}
            className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            Anterior
          </button>
          <button
            type="button"
            disabled={isLoading || pagina >= totalPaginas}
            onClick={onPaginaProxima}
            className="px-2 py-1 text-xs rounded border border-slate-300 bg-white hover:bg-slate-50 disabled:opacity-50"
          >
            Próxima
          </button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500 mb-1 lg:hidden" aria-hidden>
        Deslize horizontalmente para ver todas as colunas →
      </p>

      <div
        className={`max-w-full overflow-x-auto border border-slate-300 rounded bg-white isolate [-webkit-overflow-scrolling:touch] ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
        aria-busy={isLoading || undefined}
      >
        <table className="w-full min-w-[640px] lg:min-w-[760px] text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th
                className={`border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-12 bg-slate-100 ${stickyColNum}`}
              >
                #
              </th>
              <th
                className={`border border-slate-300 px-1.5 py-1.5 text-left font-semibold text-slate-700 w-[7rem] min-w-[7rem] max-w-[7rem] whitespace-normal text-[11px] leading-tight bg-slate-100 ${stickyColData}`}
              >
                Data de Pagamento
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[108px] whitespace-nowrap">
                Valor
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">
                Atualização Monetária
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">
                Juros
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[96px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((row, idx) => {
              const globalIdx = inicio + idx;
              const podeEditarLinha =
                (!aceitarPagamento || modoAlteracao) && globalIdx <= limiteEdicao;
              return (
                <tr key={`custas-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td className={`border border-slate-200 px-2 py-1 text-slate-600 ${stickyColNum}`}>
                    {String(globalIdx + 1).padStart(3, '0')}
                  </td>
                  <td
                    className={`border border-slate-200 px-1 py-1 w-[7rem] min-w-[7rem] max-w-[7rem] align-top ${stickyColData}`}
                  >
                    {podeEditarLinha ? (
                      <input
                        type="text"
                        inputMode="numeric"
                        placeholder=""
                        autoComplete="off"
                        value={row.dataPagamento || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          const r = resolverAliasHojeEmTexto(v, 'br');
                          onCustasFieldChange(globalIdx, { dataPagamento: r ?? formatarDataBrInput(v) });
                        }}
                        onBlur={(e) =>
                          onCustasFieldChange(globalIdx, {
                            dataPagamento: normalizarTextoDataBRparaSalvar(e.target.value),
                          })
                        }
                        onFocus={() => onFocusCustasCampo?.(globalIdx, 'dataPagamento')}
                        className={`${inputCellClass} min-w-0 max-w-full box-border px-1`}
                      />
                    ) : (
                      <span className="block truncate text-sm tabular-nums" title={row.dataPagamento || undefined}>
                        {row.dataPagamento}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {podeEditarLinha ? (
                      <input
                        type="text"
                        value={row.valor}
                        onChange={(e) => onCustasFieldChange(globalIdx, { valor: e.target.value })}
                        onBlur={(e) => {
                          const rawTrim = String(e.target.value ?? '').trim();
                          if (rawTrim === '') {
                            onCustasFieldChange(globalIdx, { valor: '' });
                            return;
                          }
                          onCustasFieldChange(globalIdx, { valor: formatBRL(parseBRL(rawTrim)) });
                        }}
                        onFocus={() => onFocusCustasCampo?.(globalIdx, 'valor')}
                        className={inputCellClass}
                      />
                    ) : (
                      row.valor
                    )}
                  </td>
                  <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                    {podeEditarLinha && modoAlteracao ? (
                      <input
                        type="text"
                        value={row.atualizacaoMonetaria}
                        onChange={(e) => onCustasFieldChange(globalIdx, { atualizacaoMonetaria: e.target.value })}
                        onBlur={(e) =>
                          onCustasFieldChange(globalIdx, {
                            atualizacaoMonetaria: formatBRL(parseBRL(e.target.value)),
                          })
                        }
                        className={inputCellClass}
                      />
                    ) : (
                      row.atualizacaoMonetaria
                    )}
                  </td>
                  <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                    {podeEditarLinha && modoAlteracao ? (
                      <input
                        type="text"
                        value={row.juros}
                        onChange={(e) => onCustasFieldChange(globalIdx, { juros: e.target.value })}
                        onBlur={(e) =>
                          onCustasFieldChange(globalIdx, { juros: formatBRL(parseBRL(e.target.value)) })
                        }
                        className={inputCellClass}
                      />
                    ) : (
                      row.juros
                    )}
                  </td>
                  <td className={`border border-slate-200 px-2 py-1 font-medium ${modoAlteracao ? 'text-red-600' : ''}`}>
                    {row.total}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-medium">
              <td
                className="border border-slate-300 px-2 py-1 bg-slate-100 sticky left-0 z-20 min-w-[10.5rem] shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]"
                colSpan={2}
              >
                {resumoPag.qtd}
              </td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.valor}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.atualizacao}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.juros}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.total}</td>
            </tr>
            <tr className="bg-slate-100 font-medium">
              <td
                className="border border-slate-300 px-2 py-1 bg-slate-100 sticky left-0 z-20 min-w-[10.5rem] shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]"
                colSpan={2}
              >
                {resumoG.qtd}
              </td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.valor}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.atualizacao}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.juros}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
});

export default CustasGrid;
