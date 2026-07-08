import { memo } from 'react';
import { formatarDataBrInput, resolverAliasHojeEmTexto } from '../../services/hjDateAliasService.js';
import { formatBRL, normalizarTextoDataBRparaSalvar, parseBRL } from './calculosTitulosGridUtils.js';

if (import.meta.env.DEV) {
  // Remover após validação de profiling em dev.
  console.info('[TitulosGrid] módulo carregado (console.count ativo por render)');
}

/**
 * Grade da aba Títulos — somente apresentação e edição via callbacks (sem fetch/recálculo/autosave).
 */
const TitulosGrid = memo(function TitulosGrid({
  titulosPaginaCompletos,
  resumoPagina,
  resumoGeral,
  pagina,
  totalPaginas,
  inicio,
  fim,
  titulosTotalLength,
  rodadaTitulosLength,
  aceitarPagamento,
  modoAlteracao,
  showAvisoParcelasVazias,
  isLoading,
  onTituloFieldChange,
  onFocusTituloCampo,
  onAbrirDatasEspeciais,
  onPaginaAnterior,
  onPaginaProxima,
}) {
  if (import.meta.env.DEV) {
    console.count('TitulosGrid render');
  }

  const linhas = Array.isArray(titulosPaginaCompletos) ? titulosPaginaCompletos : [];
  const resumoPag = resumoPagina ?? {};
  const resumoG = resumoGeral ?? {};

  // Índice global da primeira linha sem valor na página — garante que o próximo débito
  // seja sempre editável, mesmo que `rodadaTitulosLength` (estado bruto) esteja defasado.
  let linhasComValorNoInicio = 0;
  for (const r of linhas) {
    if (String(r?.valorInicial ?? '').trim() !== '') linhasComValorNoInicio += 1;
    else break;
  }
  const limiteEdicao = Math.max(rodadaTitulosLength, inicio + linhasComValorNoInicio);

  const inputCellClass =
    'w-full px-1 py-0.5 max-lg:py-2 max-lg:text-base border border-slate-300 rounded text-sm tabular-nums';
  const stickyColNum =
    'sticky left-0 z-20 bg-inherit shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)] max-lg:shadow-[3px_0_6px_-2px_rgba(15,23,42,0.18)]';
  const stickyColData =
    'sticky left-12 z-20 bg-inherit shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)] max-lg:shadow-[3px_0_6px_-2px_rgba(15,23,42,0.18)]';

  return (
    <>
      {showAvisoParcelasVazias && (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-200 rounded px-3 py-2 mb-2">
          Há parcelas importadas, mas a grade de <strong>Títulos</strong> (débitos/taxas 100–108) está vazia.
          Reimporte os txt de cálculo ou use <strong>Importar débitos (Excel)</strong>. Parcelamento e pagamentos
          ficam nas abas <strong>Parcelamento</strong> e <strong>Pagamento</strong> — não substituem os títulos
          atualizados do Excel.
        </p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <p className="text-sm text-slate-600">
          Página {String(pagina).padStart(2, '0')} — Linhas {inicio + 1} a {Math.min(fim, titulosTotalLength)} (de{' '}
          {titulosTotalLength})
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
        <table className="w-full min-w-[720px] lg:min-w-[880px] text-sm border-collapse">
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
                <span className="lg:hidden">Vencimento</span>
                <span className="hidden lg:inline">Data de Vencimento</span>
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[108px] whitespace-nowrap">
                <span className="lg:hidden">Valor inicial</span>
                <span className="hidden lg:inline">Valor inicial do título</span>
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[100px] whitespace-nowrap">
                <span className="lg:hidden">Atualiz.</span>
                <span className="hidden lg:inline">Atualização Monetária</span>
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[72px] whitespace-nowrap">
                <span className="lg:hidden">Dias</span>
                <span className="hidden lg:inline">Dias de Atraso</span>
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">
                Juros
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[72px]">
                Multa
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">
                <span className="lg:hidden">Hon.</span>
                <span className="hidden lg:inline">Honorários</span>
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
                <tr key={`titulo-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td
                    className={`border border-slate-200 px-2 py-1 text-slate-600 cursor-pointer hover:bg-slate-50 ${stickyColNum}`}
                    onDoubleClick={() => {
                      if (podeEditarLinha) onAbrirDatasEspeciais(globalIdx);
                    }}
                    title="Duplo clique: Configurações Especiais"
                  >
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
                        value={row.dataVencimento || ''}
                        onChange={(e) => {
                          const v = e.target.value;
                          const r = resolverAliasHojeEmTexto(v, 'br');
                          onTituloFieldChange(globalIdx, { dataVencimento: r ?? formatarDataBrInput(v) });
                        }}
                        onBlur={(e) =>
                          onTituloFieldChange(globalIdx, {
                            dataVencimento: normalizarTextoDataBRparaSalvar(e.target.value),
                          })
                        }
                        onFocus={() => onFocusTituloCampo?.(globalIdx, 'dataVencimento')}
                        className={`${inputCellClass} min-w-0 max-w-full box-border px-1`}
                      />
                    ) : (
                      <span className="block truncate text-sm tabular-nums" title={row.dataVencimento || undefined}>
                        {row.dataVencimento}
                      </span>
                    )}
                  </td>
                  <td className="border border-slate-200 px-2 py-1">
                    {podeEditarLinha ? (
                      <input
                        type="text"
                        value={row.valorInicial}
                        onChange={(e) => {
                          onTituloFieldChange(globalIdx, {
                            valorInicial: e.target.value,
                          });
                        }}
                        onBlur={(e) => {
                          const raw = String(e.target.value ?? '');
                          const rawTrim = raw.trim();
                          if (rawTrim === '') {
                            onTituloFieldChange(globalIdx, { valorInicial: '' });
                            return;
                          }
                          const n = parseBRL(rawTrim);
                          onTituloFieldChange(globalIdx, {
                            valorInicial: formatBRL(n),
                          });
                        }}
                        onFocus={() => onFocusTituloCampo?.(globalIdx, 'valorInicial')}
                        className={inputCellClass}
                      />
                    ) : (
                      row.valorInicial
                    )}
                  </td>
                  <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                    {podeEditarLinha && modoAlteracao ? (
                      <input
                        type="text"
                        value={row.atualizacaoMonetaria}
                        onChange={(e) => onTituloFieldChange(globalIdx, { atualizacaoMonetaria: e.target.value })}
                        onBlur={(e) =>
                          onTituloFieldChange(globalIdx, {
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
                        inputMode="numeric"
                        value={row.diasAtraso}
                        onChange={(e) => onTituloFieldChange(globalIdx, { diasAtraso: e.target.value })}
                        onBlur={(e) => {
                          const n = Number(String(e.target.value ?? '').replace(/\D/g, ''));
                          onTituloFieldChange(globalIdx, {
                            diasAtraso: n ? String(Math.max(0, Math.floor(n))) : '0',
                          });
                        }}
                        className={inputCellClass}
                      />
                    ) : (
                      row.diasAtraso
                    )}
                  </td>
                  <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                    {podeEditarLinha && modoAlteracao ? (
                      <input
                        type="text"
                        value={row.juros}
                        onChange={(e) => onTituloFieldChange(globalIdx, { juros: e.target.value })}
                        onBlur={(e) =>
                          onTituloFieldChange(globalIdx, { juros: formatBRL(parseBRL(e.target.value)) })
                        }
                        className={inputCellClass}
                      />
                    ) : (
                      row.juros
                    )}
                  </td>
                  <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                    {podeEditarLinha && modoAlteracao ? (
                      <input
                        type="text"
                        value={row.multa}
                        onChange={(e) => onTituloFieldChange(globalIdx, { multa: e.target.value })}
                        onBlur={(e) =>
                          onTituloFieldChange(globalIdx, { multa: formatBRL(parseBRL(e.target.value)) })
                        }
                        className={inputCellClass}
                      />
                    ) : (
                      row.multa
                    )}
                  </td>
                  <td className={`border border-slate-200 px-2 py-1 ${modoAlteracao ? 'text-red-600 font-medium' : ''}`}>
                    {podeEditarLinha && modoAlteracao ? (
                      <input
                        type="text"
                        value={row.honorarios}
                        onChange={(e) => onTituloFieldChange(globalIdx, { honorarios: e.target.value })}
                        onBlur={(e) =>
                          onTituloFieldChange(globalIdx, { honorarios: formatBRL(parseBRL(e.target.value)) })
                        }
                        className={inputCellClass}
                      />
                    ) : (
                      row.honorarios
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
              <td className="border border-slate-300 px-2 py-1">{resumoPag.valorInicial}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.atualizacao}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.diasAtraso}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.juros}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.multa}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.honorarios}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoPag.total}</td>
            </tr>
            <tr className="bg-slate-100 font-medium">
              <td
                className="border border-slate-300 px-2 py-1 bg-slate-100 sticky left-0 z-20 min-w-[10.5rem] shadow-[2px_0_4px_-2px_rgba(15,23,42,0.12)]"
                colSpan={2}
              >
                {resumoG.qtd}
              </td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.valorInicial}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.atualizacao}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.diasAtraso}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.juros}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.multa}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.honorarios}</td>
              <td className="border border-slate-300 px-2 py-1">{resumoG.total}</td>
            </tr>
          </tfoot>
        </table>
      </div>
    </>
  );
});

export default TitulosGrid;
