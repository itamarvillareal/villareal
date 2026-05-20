import { memo } from 'react';
import { resolverAliasHojeEmTexto } from '../../services/hjDateAliasService.js';
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

      <div
        className={`overflow-x-auto border border-slate-300 rounded bg-white ${isLoading ? 'opacity-60 pointer-events-none' : ''}`}
        aria-busy={isLoading || undefined}
      >
        <table className="w-full table-fixed text-sm border-collapse">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 w-12">#</th>
              <th className="border border-slate-300 px-1.5 py-1.5 text-left font-semibold text-slate-700 w-[7rem] min-w-0 max-w-[7rem] whitespace-normal text-[11px] leading-tight">
                Data de Vencimento
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[120px]">
                Valor inicial do título
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[120px]">
                Atualização Monetária
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">
                Dias de Atraso
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[90px]">
                Juros
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">
                Multa
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[80px]">
                Honorários
              </th>
              <th className="border border-slate-300 px-2 py-1.5 text-left font-semibold text-slate-700 min-w-[100px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {linhas.map((row, idx) => {
              const globalIdx = inicio + idx;
              const podeEditarLinha =
                globalIdx < rodadaTitulosLength && (!aceitarPagamento || modoAlteracao);
              return (
                <tr key={`titulo-${globalIdx}`} className={globalIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}>
                  <td
                    className="border border-slate-200 px-2 py-1 text-slate-600 cursor-pointer hover:bg-slate-50"
                    onDoubleClick={() => {
                      if (podeEditarLinha) onAbrirDatasEspeciais(globalIdx);
                    }}
                    title="Duplo clique: Configurações Especiais"
                  >
                    {String(globalIdx + 1).padStart(3, '0')}
                  </td>
                  <td className="border border-slate-200 px-1 py-1 w-[7rem] min-w-0 max-w-[7rem] align-top">
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
                          onTituloFieldChange(globalIdx, { dataVencimento: r ?? v });
                        }}
                        onBlur={(e) =>
                          onTituloFieldChange(globalIdx, {
                            dataVencimento: normalizarTextoDataBRparaSalvar(e.target.value),
                          })
                        }
                        className="w-full min-w-0 max-w-full box-border px-1 py-0.5 border border-slate-300 rounded text-sm tabular-nums"
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
                        className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
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
                        className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
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
                        className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
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
                        className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
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
                        className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
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
                        className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm"
                      />
                    ) : (
                      row.honorarios
                    )}
                  </td>
                  <td className={`border border-slate-200 px-2 py-1 font-medium ${modoAlteracao ? 'text-red-600' : ''}`}>
                    {podeEditarLinha && modoAlteracao ? (
                      <input
                        type="text"
                        value={row.total}
                        onChange={(e) => onTituloFieldChange(globalIdx, { total: e.target.value })}
                        onBlur={(e) =>
                          onTituloFieldChange(globalIdx, { total: formatBRL(parseBRL(e.target.value)) })
                        }
                        className="w-full px-1 py-0.5 border border-slate-300 rounded text-sm font-medium"
                      />
                    ) : (
                      row.total
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="bg-slate-100 font-medium">
              <td className="border border-slate-300 px-2 py-1" colSpan={2}>
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
              <td className="border border-slate-300 px-2 py-1" colSpan={2}>
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
