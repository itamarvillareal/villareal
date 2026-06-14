import { ContaBadge } from '../shared/ContaBadge.jsx';
import { formatDataBrCompleta, formatMoeda } from '../shared/financeiroFormat.js';
import { CLASSE_BOTAO_APROVAR_CONTA, varsCorConta } from '../shared/contaCores.js';
import {
  rotuloConfianca,
  rotuloDescricaoComData,
  rotuloAlvoPadrao,
  rotuloBotaoPrincipal,
  textoEscopoLancamentos,
  valorFixoPadrao,
  padraoConfiancaPerfeita,
  qtdDivergentes,
} from './analisesUtils.js';

const CLASSE_BOTAO_MEDIA =
  'border border-amber-700 bg-amber-600 text-white hover:bg-amber-700 dark:bg-amber-600 dark:border-amber-500 dark:hover:bg-amber-500 dark:text-white';

export function RecorrenciaCard({
  padrao,
  fading,
  selected = false,
  onToggleSelect,
  selectionDisabled = false,
  onAplicar,
  onDescartar,
  precisaoValor = 'EXATO',
  lancamentosDivergentes = [],
  busy,
}) {
  const isMedia = String(padrao?.confianca ?? '').toUpperCase() === 'MEDIA';
  const modoAprox = precisaoValor === 'TODOS';
  const modoSoNome = precisaoValor === 'IGNORAR_VALOR';
  const modoExato = precisaoValor === 'EXATO';
  const valorFixo = valorFixoPadrao(padrao);
  const valorExibir =
    padrao?.valorModal != null && (valorFixo || modoExato)
      ? padrao.valorModal
      : padrao?.valorTipico;
  const mostrarTilde = !valorFixo && !modoExato;
  const codigo = padrao?.contaCodigo ?? 'N';
  const consistenciaPct = Math.round(Number(padrao?.consistenciaConta ?? 0) * 100);
  const partesLabel = [padrao?.parteCliente, padrao?.parteOposta].filter(Boolean).join(' x ');
  const confiancaPerfeita = padraoConfiancaPerfeita(padrao);
  const tituloPadrao = rotuloDescricaoComData(padrao, formatDataBrCompleta);
  const escopoTexto = textoEscopoLancamentos(padrao, precisaoValor);
  const alvoTexto = rotuloAlvoPadrao(padrao);
  const botaoLabel = rotuloBotaoPrincipal(padrao, precisaoValor);
  const nDivergente = qtdDivergentes(padrao);

  const bordaModo =
    modoSoNome
      ? 'border-orange-400 dark:border-orange-600 ring-1 ring-orange-300/60 dark:ring-orange-700/50'
      : modoAprox
        ? 'border-amber-400 dark:border-amber-600 ring-1 ring-amber-300/50 dark:ring-amber-700/40'
        : '';

  return (
    <article
      className={`rounded-lg border p-4 transition-all duration-300 ${
        fading ? 'opacity-0 scale-[0.98]' : 'opacity-100'
      } ${
        selected
          ? 'border-blue-500 dark:border-blue-400 ring-2 ring-blue-400/50 dark:ring-blue-500/40 bg-blue-50/40 dark:bg-blue-950/20'
          : isMedia
            ? 'border-amber-600 dark:border-amber-500 bg-amber-200/90 dark:bg-amber-950/55 ring-1 ring-amber-500/80 dark:ring-amber-600/70'
            : bordaModo || 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'
      }`}
      aria-busy={busy}
    >
      <div className="flex flex-wrap items-start gap-3 justify-between">
        <label className="flex items-start gap-3 min-w-0 flex-1 cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            disabled={selectionDisabled || busy}
            onChange={() => onToggleSelect?.(padrao)}
            className="mt-1 rounded border-slate-300 dark:border-slate-600 shrink-0"
            aria-label={`Selecionar ${tituloPadrao}`}
          />
          <div className="min-w-0 flex-1 space-y-1.5">
            <p
              className="text-sm font-medium text-slate-900 dark:text-slate-100 truncate"
              title={tituloPadrao}
            >
              {padrao?.descricaoExemplo ?? '—'}
              {padrao?.dataExemplo ? (
                <span className="text-slate-600 dark:text-slate-300 font-normal">
                  {' '}
                  · {formatDataBrCompleta(padrao.dataExemplo)}
                </span>
              ) : null}
            </p>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              {padrao?.bancoNome ?? 'Banco'}
              {mostrarTilde ? ' · ~' : ' · '}
              {formatMoeda(valorExibir)}
            </p>
            <div className="flex flex-wrap gap-1.5">
              {isMedia ? (
                <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-600 text-white border border-amber-700 dark:bg-amber-600 dark:border-amber-500">
                  confiança média — revisar
                </span>
              ) : null}
              {confiancaPerfeita ? (
                <span className="inline-flex text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-600 text-white border border-emerald-700 dark:bg-emerald-600 dark:border-emerald-500">
                  100% consistência
                </span>
              ) : null}
              {valorFixo && padrao?.valorModal != null ? (
                <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  valor fixo {formatMoeda(padrao.valorModal)}
                </span>
              ) : null}
              {modoSoNome && nDivergente > 0 ? (
                <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-orange-50 text-orange-800 border border-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:border-orange-800">
                  valor difere — confirmar
                </span>
              ) : null}
              {modoAprox ? (
                <span className="inline-flex text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                  inclui aproximados
                </span>
              ) : null}
            </div>
            <p className="text-xs font-medium text-violet-700 dark:text-violet-300 truncate" title={alvoTexto}>
              {alvoTexto}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400">{escopoTexto}</p>
            {partesLabel ? (
              <p className="text-xs text-slate-500 dark:text-slate-500 truncate" title={partesLabel}>
                Partes: {partesLabel}
              </p>
            ) : null}
            {modoSoNome && lancamentosDivergentes.length > 0 ? (
              <ul className="mt-1 space-y-1 rounded-md border border-orange-200 dark:border-orange-800 bg-orange-50/60 dark:bg-orange-950/20 divide-y divide-orange-100 dark:divide-orange-900/50">
                {lancamentosDivergentes.map((item, idx) => (
                  <li
                    key={`${item.dataLancamento ?? ''}-${item.descricao ?? ''}-${idx}`}
                    className="px-2.5 py-1.5 text-[11px] text-orange-900 dark:text-orange-200"
                  >
                    <p className="truncate font-medium" title={item.descricao}>
                      {item.dataLancamento ? formatDataBrCompleta(item.dataLancamento) : '—'}
                      {item.descricao ? ` · ${item.descricao}` : ''}
                    </p>
                    <p>
                      valor {formatMoeda(item.valor)}
                      {padrao?.valorModal != null ? (
                        <span className="text-orange-700/80 dark:text-orange-300/80">
                          {' '}
                          · histórico ~{formatMoeda(padrao.valorModal)}
                        </span>
                      ) : null}
                    </p>
                  </li>
                ))}
              </ul>
            ) : null}
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {Number(padrao?.mesesCobertos ?? 0).toLocaleString('pt-BR')} de 12 meses ·{' '}
              {Number(padrao?.ocorrenciasHistorico ?? 0).toLocaleString('pt-BR')} históricos · consistência{' '}
              {consistenciaPct}% · confiança {rotuloConfianca(padrao?.confianca)}
            </p>
          </div>
        </label>
        <div
          className={`flex flex-col items-stretch gap-2 shrink-0 min-w-[140px] ${
            isMedia ? 'rounded-md border border-amber-700/40 bg-amber-300/35 dark:bg-amber-950/50 dark:border-amber-600/50 p-2.5' : ''
          }`}
        >
          <div className="flex items-center justify-end gap-1.5 pb-0.5">
            <ContaBadge codigo={codigo} size="sm" title={padrao?.contaNome} />
          </div>
          <button
            type="button"
            disabled={busy}
            onClick={() => onAplicar?.(padrao)}
            className={`text-xs px-3 py-2 rounded-md disabled:opacity-50 w-full font-medium ${
              modoSoNome
                ? 'border border-orange-400 bg-orange-100 text-orange-950 hover:bg-orange-200 dark:bg-orange-950/50 dark:border-orange-600 dark:text-orange-100 dark:hover:bg-orange-900/60'
                : isMedia
                  ? CLASSE_BOTAO_MEDIA
                  : modoAprox
                    ? 'border border-amber-400 bg-amber-100 text-amber-950 hover:bg-amber-200 dark:bg-amber-950/50 dark:border-amber-600 dark:text-amber-100'
                    : `${CLASSE_BOTAO_APROVAR_CONTA} text-white`
            }`}
            style={!modoSoNome && !isMedia && !modoAprox ? varsCorConta(codigo) : undefined}
          >
            {botaoLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => onDescartar?.(padrao)}
            className="text-xs px-3 py-1.5 rounded-md border border-slate-300 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 disabled:opacity-50 w-full"
            title="Não mostrar este padrão nas análises"
          >
            Descartar
          </button>
        </div>
      </div>
    </article>
  );
}
